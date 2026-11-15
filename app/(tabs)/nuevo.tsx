// app/(tabs)/nuevo.tsx
import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  Linking,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
//import * as ImagePicker from 'expo-image-picker';
import { useAudioRecorder, RecordingPresets, AudioModule } from "expo-audio";
import * as Location from "expo-location";
import * as Network from "expo-network";
//import * as Haptics from 'expo-haptics';
import MapView, { Marker } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { servicioArchivos } from "../../src/servicios/archivos";
import { servicioDB } from "../../src/servicios/baseDeDatos";
import { servicioSincronizacion } from "../../src/servicios/sincronizacion";
import { servicioReportes, NOMBRES_TIPOS } from "../../src/servicios/reportes";
import { Reporte } from "../../src/tipos";

const TIPOS_PROBLEMA = [
  "Bache",
  "Luminaria",
  "Basura",
  "Rama o árbol",
  "Agua o cloaca",
  "Semáforo",
  "Vereda",
  "Otro",
];

export default function NuevoReportePantalla() {
  const [permisoCamara, pedirPermisoCamara] = useCameraPermissions();
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [fotoUri2, setFotoUri2] = useState<string | null>(null);
  const [capturandoSegunda, setCapturandoSegunda] = useState<boolean>(false);

  const [tipoSeleccionado, setTipoSeleccionado] = useState<string>("");
  const [descripcion, setDescripcion] = useState<string>("");

  // Ubicación y corrección manual en el mapa (Área 1 del PRD)
  const [coordenadas, setCoordenadas] = useState({
    latitud: -33.0089,
    longitud: -58.5142,
  });
  const [direccionTexto, setDireccionTexto] = useState<string>(
    "Detectando ubicación...",
  );
  const [mostrarMapaModal, setMostrarMapaModal] = useState<boolean>(false);
  const [permisoGpsDenegado, setPermisoGpsDenegado] = useState<boolean>(false);

  // Detección de duplicados a menos de 50m (Área 3 del PRD)
  const [cercanos50m, setCercanos50m] = useState<Reporte[]>([]);
  const [mostrarModalCercanos, setMostrarModalCercanos] =
    useState<boolean>(false);

  // Grabador de expo-audio
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [grabando, setGrabando] = useState<boolean>(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<boolean>(false);

  const camaraRef = useRef<CameraView>(null);

  // Obtenemos ubicación automáticamente apenas entra a crear el reporte
  useEffect(() => {
    obtenerUbicacionInicial();
  }, []);

  const traducirCoordenadasACalle = async (lat: number, lon: number) => {
    try {
      const red = await Network.getNetworkStateAsync();
      if (red.isConnected && red.isInternetReachable) {
        const dirs = await Location.reverseGeocodeAsync({
          latitude: lat,
          longitude: lon,
        });
        if (dirs && dirs.length > 0) {
          const d = dirs[0];
          if (d.street) {
            setDireccionTexto(
              d.streetNumber ? `${d.street} ${d.streetNumber}` : d.street,
            );
            return;
          } else if (d.name) {
            setDireccionTexto(d.name);
            return;
          }
        }
      }
    } catch {}
    setDireccionTexto(`Coord: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
  };

  const obtenerUbicacionInicial = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        // PRD: "Si niega la ubicación, que igual pueda reportar poniendo el punto a mano en el mapa"
        setPermisoGpsDenegado(true);
        setDireccionTexto("Ubicación manual (ajustar en el mapa)");
        return;
      }
      setPermisoGpsDenegado(false);

      let lat = -33.0089;
      let lon = -58.5142;
      try {
        const ub = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        lat = ub.coords.latitude;
        lon = ub.coords.longitude;
      } catch {
        const ult = await Location.getLastKnownPositionAsync();
        if (ult) {
          lat = ult.coords.latitude;
          lon = ult.coords.longitude;
        }
      }

      // Si está en el emulador (California), centramos en Gualeguaychú para que pueda mover el pin ahí
      const enGchu =
        lat <= -32.9 && lat >= -33.1 && lon <= -58.4 && lon >= -58.6;
      if (!enGchu) {
        lat = -33.0089;
        lon = -58.5142;
      }

      setCoordenadas({ latitud: lat, longitud: lon });
      await traducirCoordenadasACalle(lat, lon);
    } catch {
      setDireccionTexto("Rocamora 1240 (ajustable en mapa)");
    }
  };

  if (!permisoCamara) {
    return (
      <View style={styles.centro}>
        <Text>Cargando cámara...</Text>
      </View>
    );
  }

  // PRD: "Si el vecino no da permiso de cámara, no puede reportar, y la app tiene que explicárselo con buenos modos y ofrecerle abrir la configuración"
  if (!permisoCamara.granted) {
    return (
      <SafeAreaView style={styles.centro}>
        <Text style={styles.tituloPermiso}>Necesitamos tu cámara 📷</Text>
        <Text style={styles.textoError}>
          Sacar una foto del problema es obligatorio para poder registrar el
          reclamo y enviar a la cuadrilla correcta. Por favor, habilita el
          permiso.
        </Text>
        <TouchableOpacity
          style={styles.botonPrimario}
          onPress={pedirPermisoCamara}
        >
          <Text style={styles.textoBotonEnviar}>Dar permiso de cámara</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.botonSecundario, { marginTop: 12 }]}
          onPress={() => Linking.openSettings()}
        >
          <Text style={styles.textoBotonSecundario}>
            Abrir Configuración del teléfono
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const tomarFoto = async () => {
    if (camaraRef.current) {
      const foto = await camaraRef.current.takePictureAsync({ quality: 0.5 });
      if (foto) {
        if (capturandoSegunda) {
          setFotoUri2(foto.uri);
          setCapturandoSegunda(false);
        } else {
          setFotoUri(foto.uri);
        }
      }
    }
  };

  const elegirDeGaleria = async (esSegunda = false) => {
    try {
      const ImagePicker = require("expo-image-picker");
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.6,
      });
      if (!res.canceled && res.assets.length > 0) {
        if (esSegunda) {
          setFotoUri2(res.assets[0].uri);
          setCapturandoSegunda(false);
        } else {
          setFotoUri(res.assets[0].uri);
        }
      }
    } catch {
      Alert.alert(
        "Galería no compilada aún",
        "Por ahora usa la cámara en vivo o ejecuta npx expo run:android para activar la galería.",
      );
    }
  };

  const iniciarGrabacion = async () => {
    try {
      const permiso = await AudioModule.requestRecordingPermissionsAsync();
      if (!permiso.granted) {
        Alert.alert(
          "Permiso denegado",
          "Necesitamos acceso al micrófono para grabar la nota de voz.",
        );
        return;
      }
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setGrabando(true);
    } catch {
      Alert.alert("Error", "No se pudo iniciar la grabación de audio.");
    }
  };

  const detenerGrabacion = async () => {
    try {
      await audioRecorder.stop();
      setGrabando(false);
      if (audioRecorder.uri) setAudioUri(audioRecorder.uri);
    } catch {
      setGrabando(false);
    }
  };

  // Paso previo al envío: revisa si hay reportes a menos de 50 metros
  const verificarDuplicadosYEnviar = async () => {
    if (!tipoSeleccionado) {
      Alert.alert(
        "Falta información",
        "Por favor, selecciona qué tipo de problema es.",
      );
      return;
    }

    setEnviando(true);
    try {
      const estadoRed = await Network.getNetworkStateAsync();
      if (estadoRed.isConnected && estadoRed.isInternetReachable) {
        const cercanos = await servicioReportes.buscarCercanos(
          coordenadas.latitud,
          coordenadas.longitud,
          50,
        );
        if (cercanos.length > 0) {
          // PRD: "Vibración al detectar un reporte duplicado cerca"
          //await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          try {
            const Haptics = require("expo-haptics");
            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            );
          } catch {}
          setCercanos50m(cercanos);
          setMostrarModalCercanos(true);
          setEnviando(false);
          return;
        }
      }
      await guardarYEnviarDefinitivo();
    } catch {
      await guardarYEnviarDefinitivo();
    }
  };

  const sumarseAReporteCercano = async (reporteExistente: Reporte) => {
    setMostrarModalCercanos(false);
    setEnviando(true);
    const res = await servicioReportes.adherirse(reporteExistente.id);
    //await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const Haptics = require("expo-haptics");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    setEnviando(false);
    Alert.alert(
      "¡Te sumaste al reclamo!",
      `${res.mensaje}\n\nNúmero de seguimiento: ${reporteExistente.codigo}\nCuantos más vecinos se suman, más prioridad tiene en Obras.`,
    );
    setFotoUri(null);
    setFotoUri2(null);
    setTipoSeleccionado("");
    setDescripcion("");
    setAudioUri(null);
  };

  const guardarYEnviarDefinitivo = async () => {
    setMostrarModalCercanos(false);
    setEnviando(true);

    try {
      let fotoPersistente = null;
      if (fotoUri) {
        fotoPersistente = await servicioArchivos.guardarPersistente(
          fotoUri,
          "fotos",
        );
      }
      let fotoPersistente2 = null;
      if (fotoUri2) {
        fotoPersistente2 = await servicioArchivos.guardarPersistente(
          fotoUri2,
          "fotos",
        );
      }

      let audioPersistente = null;
      if (audioUri) {
        audioPersistente = await servicioArchivos.guardarPersistente(
          audioUri,
          "audios",
        );
      }

      const idFila = await servicioDB.encolarReporte({
        tipoId: tipoSeleccionado,
        descripcion: descripcion,
        fotoUri: fotoPersistente,
        fotoUri2: fotoPersistente2,
        audioUri: audioPersistente,
        latitud: coordenadas.latitud,
        longitud: coordenadas.longitud,
        direccion: direccionTexto,
      });

      // PRD: "Vibración al confirmar el envío"
      //await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      try {
        const Haptics = require("expo-haptics");
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
      } catch {}
      const estadoRed = await Network.getNetworkStateAsync();
      const codigoProv = `GCHU-2026-${String(idFila).padStart(5, "0")}`;

      if (estadoRed.isConnected && estadoRed.isInternetReachable) {
        await servicioSincronizacion.procesarCola();
        Alert.alert(
          "✅ Reporte Enviado",
          `Tu reclamo ya fue recibido por la Municipalidad.\n\nNúmero de seguimiento:\n${codigoProv}`,
        );
      } else {
        Alert.alert(
          "📦 Guardado en tu teléfono (Sin Señal)",
          `Constancia provisoria: ${codigoProv}\n\nSe subirá solo cuando vuelva la conexión, sin que tengas que hacer nada.`,
        );
      }

      setFotoUri(null);
      setFotoUri2(null);
      setTipoSeleccionado("");
      setDescripcion("");
      setAudioUri(null);
    } catch (error) {
      console.error(error);
      Alert.alert(
        "Error",
        "Ocurrió un problema interno al guardar el reporte.",
      );
    } finally {
      setEnviando(false);
    }
  };

  const mostrandoCamara = !fotoUri || capturandoSegunda;

  return (
    <SafeAreaView style={styles.container}>
      {!mostrandoCamara ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.flex1}
        >
          <ScrollView contentContainerStyle={styles.scrollFormulario}>
            {/* SECCIÓN FOTOS (Obligatoria + 2da foto opcional) */}
            <Text style={styles.labelFormulario}>
              1. Fotografías del problema
            </Text>
            <View style={styles.cabeceraFoto}>
              <Image source={{ uri: fotoUri! }} style={styles.miniaturaFoto} />
              <View style={{ flex: 1 }}>
                <TouchableOpacity
                  style={styles.botonSecundario}
                  onPress={() => setFotoUri(null)}
                  disabled={enviando}
                >
                  <Text style={styles.textoBotonSecundario}>
                    Cambiar foto 1
                  </Text>
                </TouchableOpacity>

                {fotoUri2 ? (
                  <View style={styles.filaFoto2}>
                    <Image
                      source={{ uri: fotoUri2 }}
                      style={styles.miniaturaFotoChica}
                    />
                    <TouchableOpacity onPress={() => setFotoUri2(null)}>
                      <Text style={styles.textoBotonDescartar}>
                        Quitar 2da foto
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ flexDirection: "row", marginTop: 8, gap: 8 }}>
                    <TouchableOpacity
                      style={styles.botonSecundario}
                      onPress={() => setCapturandoSegunda(true)}
                    >
                      <Text style={styles.textoBotonSecundario}>
                        + 2da foto (Cámara)
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.botonSecundario}
                      onPress={() => elegirDeGaleria(true)}
                    >
                      <Text style={styles.textoBotonSecundario}>+ Galería</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            {/* SECCIÓN TIPO DE PROBLEMA */}
            <Text style={styles.labelFormulario}>2. ¿Qué pasa?</Text>
            <View style={styles.contenedorChips}>
              {TIPOS_PROBLEMA.map((tipo) => (
                <TouchableOpacity
                  key={tipo}
                  style={[
                    styles.chip,
                    tipoSeleccionado === tipo && styles.chipActivo,
                  ]}
                  onPress={() => setTipoSeleccionado(tipo)}
                  disabled={enviando}
                >
                  <Text
                    style={[
                      styles.textoChip,
                      tipoSeleccionado === tipo && styles.textoChipActivo,
                    ]}
                  >
                    {tipo}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* SECCIÓN DÓNDE + CORREGIR EN EL MAPA (Requisito Área 1 del PRD) */}
            <Text style={styles.labelFormulario}>
              3. ¿Dónde está el problema?
            </Text>
            <View style={styles.cajaUbicacion}>
              <View style={{ flex: 1 }}>
                <Text style={styles.textoDireccion}>{direccionTexto}</Text>
                <Text style={styles.textoCoord}>
                  Lat: {coordenadas.latitud.toFixed(4)} | Lon:{" "}
                  {coordenadas.longitud.toFixed(4)}
                  {permisoGpsDenegado
                    ? " (Sin permiso GPS)"
                    : " (Tomado del GPS)"}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.botonCorregirMapa}
                onPress={() => setMostrarMapaModal(true)}
              >
                <Text style={styles.textoCorregirMapa}>
                  📍 Corregir en el mapa
                </Text>
              </TouchableOpacity>
            </View>

            {/* SECCIÓN DESCRIPCIÓN Y AUDIO */}
            <Text style={styles.labelFormulario}>
              4. Contanos (escrito o por voz)
            </Text>
            <TextInput
              style={styles.inputDescripcion}
              placeholder="Escribe más detalles aquí (opcional)..."
              multiline={true}
              numberOfLines={3}
              value={descripcion}
              onChangeText={setDescripcion}
              editable={!enviando}
            />

            <View style={styles.contenedorAudio}>
              {audioUri ? (
                <View style={styles.filaAudio}>
                  <Text style={styles.textoAudioExito}>
                    ✓ Nota de voz grabada
                  </Text>
                  <TouchableOpacity
                    style={styles.botonDescartar}
                    onPress={() => setAudioUri(null)}
                    disabled={enviando}
                  >
                    <Text style={styles.textoBotonDescartar}>Borrar</Text>
                  </TouchableOpacity>
                </View>
              ) : grabando ? (
                <TouchableOpacity
                  style={styles.botonGrabando}
                  onPress={detenerGrabacion}
                >
                  <Text style={styles.textoBotonGrabando}>
                    ⏹ Detener grabación...
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.botonGrabar}
                  onPress={iniciarGrabacion}
                  disabled={enviando}
                >
                  <Text style={styles.textoBotonGrabar}>
                    🎤 Grabar nota de voz
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[styles.botonEnviar, enviando && styles.botonEnviando]}
              onPress={verificarDuplicadosYEnviar}
              disabled={enviando}
            >
              {enviando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.textoBotonEnviar}>ENVIAR REPORTE</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.flex1}>
          <CameraView style={styles.flex1} facing="back" ref={camaraRef} />
          <View style={styles.contenedorControlesOverlay}>
            <TouchableOpacity
              style={styles.botonGaleriaOverlay}
              onPress={() => elegirDeGaleria(capturandoSegunda)}
            >
              <Text style={styles.textoGaleriaOverlay}>🖼️ Galería</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.botonCaptura} onPress={tomarFoto}>
              <View style={styles.circuloInterno} />
            </TouchableOpacity>

            {capturandoSegunda ? (
              <TouchableOpacity
                style={styles.botonGaleriaOverlay}
                onPress={() => setCapturandoSegunda(false)}
              >
                <Text style={styles.textoGaleriaOverlay}>Cancelar</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 85 }} />
            )}
          </View>
        </View>
      )}

      {/* MODAL PARA CORREGIR EL PUNTO ARRASTRÁNDOLO EN EL MAPA */}
      <Modal visible={mostrarMapaModal} animationType="slide">
        <SafeAreaView style={styles.flex1}>
          <View style={styles.headerModal}>
            <Text style={styles.tituloModal}>
              Tocá o arrastrá el pin al lugar exacto
            </Text>
            <Text style={styles.subtituloModal}>{direccionTexto}</Text>
          </View>
          <MapView
            style={styles.flex1}
            initialRegion={{
              latitude: coordenadas.latitud,
              longitude: coordenadas.longitud,
              latitudeDelta: 0.008,
              longitudeDelta: 0.008,
            }}
            onPress={(e) => {
              const { latitude, longitude } = e.nativeEvent.coordinate;
              setCoordenadas({ latitud: latitude, longitud: longitude });
              traducirCoordenadasACalle(latitude, longitude);
            }}
          >
            <Marker
              draggable
              coordinate={{
                latitude: coordenadas.latitud,
                longitude: coordenadas.longitud,
              }}
              title="Lugar del reclamo"
              description="Mantén presionado y arrastra para corregir"
              onDragEnd={(e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                setCoordenadas({ latitud: latitude, longitud: longitude });
                traducirCoordenadasACalle(latitude, longitude);
              }}
            />
          </MapView>
          <View style={styles.footerModal}>
            <TouchableOpacity
              style={styles.botonEnviar}
              onPress={() => setMostrarMapaModal(false)}
            >
              <Text style={styles.textoBotonEnviar}>
                Confirmar esta ubicación
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* MODAL DE REPORTES EXISTENTES A MENOS DE 50 METROS (Área 3 del PRD) */}
      <Modal visible={mostrarModalCercanos} transparent animationType="fade">
        <View style={styles.fondoModalOscuro}>
          <View style={styles.cajaModalCercanos}>
            <Text style={styles.tituloAlerta50m}>
              ⚠️ Ya hay un reclamo a menos de 50 metros
            </Text>
            <Text style={styles.subtituloAlerta50m}>
              ¿Es el mismo problema? Si te sumás en vez de crear otro, sube en
              la lista de prioridad de Obras:
            </Text>

            <ScrollView style={{ maxHeight: 220, marginVertical: 10 }}>
              {cercanos50m.map((rep) => (
                <View key={rep.id} style={styles.itemCercano}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "bold", color: "#333" }}>
                      {NOMBRES_TIPOS[rep.tipoId] || rep.tipoId} -{" "}
                      {rep.direccion}
                    </Text>
                    <Text style={{ fontSize: 13, color: "#666" }}>
                      {rep.descripcion || "Sin descripción"} ({rep.adhesiones}{" "}
                      vecinos sumados)
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.botonSumarmeModal}
                    onPress={() => sumarseAReporteCercano(rep)}
                  >
                    <Text style={{ color: "#fff", fontWeight: "bold" }}>
                      Es este (+1)
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.botonCrearIgual}
              onPress={guardarYEnviarDefinitivo}
            >
              <Text style={styles.textoCrearIgual}>
                No es el mismo, crear mi reporte nuevo
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centro: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 25,
  },
  flex1: { flex: 1 },
  tituloPermiso: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#333",
  },
  textoError: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    color: "#555",
    lineHeight: 22,
  },
  botonPrimario: {
    backgroundColor: "#007BFF",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  contenedorControlesOverlay: {
    position: "absolute",
    bottom: 40,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  botonCaptura: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "rgba(255,255,255,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  circuloInterno: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#fff",
  },
  botonGaleriaOverlay: {
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  textoGaleriaOverlay: { color: "#fff", fontWeight: "bold", fontSize: 15 },
  scrollFormulario: { padding: 20 },
  cabeceraFoto: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 8,
  },
  miniaturaFoto: { width: 75, height: 75, borderRadius: 8, marginRight: 15 },
  miniaturaFotoChica: {
    width: 45,
    height: 45,
    borderRadius: 6,
    marginRight: 10,
  },
  filaFoto2: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  botonSecundario: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#e9ecef",
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  textoBotonSecundario: { color: "#333", fontWeight: "bold", fontSize: 13 },
  labelFormulario: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#222",
    marginBottom: 10,
  },
  contenedorChips: { flexDirection: "row", flexWrap: "wrap", marginBottom: 15 },
  chip: {
    backgroundColor: "#e9ecef",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 22,
    marginRight: 10,
    marginBottom: 10,
  },
  chipActivo: { backgroundColor: "#007BFF" },
  textoChip: { color: "#495057", fontSize: 16, fontWeight: "500" },
  textoChipActivo: { color: "#fff", fontWeight: "bold" },
  cajaUbicacion: {
    backgroundColor: "#eef6ff",
    padding: 14,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#b8daff",
    flexDirection: "row",
    alignItems: "center",
  },
  textoDireccion: { fontSize: 16, fontWeight: "bold", color: "#004085" },
  textoCoord: { fontSize: 12, color: "#555", marginTop: 4 },
  botonCorregirMapa: {
    backgroundColor: "#007BFF",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginLeft: 10,
  },
  textoCorregirMapa: { color: "#fff", fontWeight: "bold", fontSize: 13 },
  inputDescripcion: {
    backgroundColor: "#f4f4f4",
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 15,
  },
  contenedorAudio: { marginBottom: 25 },
  botonGrabar: {
    backgroundColor: "#e3f2fd",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#90caf9",
  },
  textoBotonGrabar: { color: "#1565c0", fontSize: 16, fontWeight: "bold" },
  botonGrabando: {
    backgroundColor: "#ffebee",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ef9a9a",
  },
  textoBotonGrabando: { color: "#c62828", fontSize: 16, fontWeight: "bold" },
  filaAudio: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#e8f5e9",
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#a5d6a7",
  },
  textoAudioExito: { color: "#2e7d32", fontSize: 16, fontWeight: "bold" },
  botonDescartar: { padding: 5 },
  textoBotonDescartar: { color: "#c62828", fontWeight: "bold" },
  botonEnviar: {
    backgroundColor: "#28a745",
    padding: 18,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  botonEnviando: { backgroundColor: "#6c757d" },
  textoBotonEnviar: { color: "#fff", fontSize: 17, fontWeight: "bold" },
  headerModal: {
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#ddd",
  },
  tituloModal: { fontSize: 18, fontWeight: "bold", color: "#222" },
  subtituloModal: { fontSize: 14, color: "#007BFF", marginTop: 4 },
  footerModal: { padding: 16, backgroundColor: "#fff" },
  fondoModalOscuro: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 20,
  },
  cajaModalCercanos: { backgroundColor: "#fff", borderRadius: 12, padding: 20 },
  tituloAlerta50m: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#d9534f",
    marginBottom: 6,
  },
  subtituloAlerta50m: { fontSize: 14, color: "#555" },
  itemCercano: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  botonSumarmeModal: {
    backgroundColor: "#007BFF",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 6,
    marginLeft: 10,
  },
  botonCrearIgual: { marginTop: 10, padding: 12, alignItems: "center" },
  textoCrearIgual: {
    color: "#555",
    fontWeight: "bold",
    textDecorationLine: "underline",
  },
});
