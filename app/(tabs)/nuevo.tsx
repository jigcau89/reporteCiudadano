// app/(tabs)/nuevo.tsx
import * as Network from 'expo-network';
import { servicioSincronizacion } from '../../src/servicios/sincronizacion';
import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Button, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAudioRecorder, RecordingPresets, AudioModule } from 'expo-audio';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { servicioArchivos } from '../../src/servicios/archivos';
import { servicioDB } from '../../src/servicios/baseDeDatos';

const TIPOS_PROBLEMA = ['Bache', 'Luminaria', 'Basura', 'Rama o árbol', 'Agua o cloaca', 'Semáforo', 'Vereda', 'Otro'];

export default function NuevoReportePantalla() {
  const [permisoCamara, pedirPermisoCamara] = useCameraPermissions();
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [tipoSeleccionado, setTipoSeleccionado] = useState<string>('');
  const [descripcion, setDescripcion] = useState<string>('');
  
  // Grabador real de expo-audio
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [grabando, setGrabando] = useState<boolean>(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<boolean>(false);
  
  const camaraRef = useRef<CameraView>(null);

  if (!permisoCamara) {
    return <View style={styles.centro}><Text>Cargando permisos...</Text></View>;
  }

  if (!permisoCamara.granted) {
    return (
      <SafeAreaView style={styles.centro}>
        <Text style={styles.textoError}>Para reportar un problema, necesitamos acceso a la cámara para la foto obligatoria.</Text>
        <Button title="Otorgar Permiso" onPress={pedirPermisoCamara} />
      </SafeAreaView>
    );
  }

  const tomarFoto = async () => {
    if (camaraRef.current) {
      const foto = await camaraRef.current.takePictureAsync({ quality: 0.5 });
      if (foto) setFotoUri(foto.uri);
    }
  };

  const iniciarGrabacion = async () => {
    try {
      const permiso = await AudioModule.requestRecordingPermissionsAsync();
      if (!permiso.granted) {
        Alert.alert('Permiso denegado', 'Necesitamos acceso al micrófono para grabar la nota de voz.');
        return;
      }
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setGrabando(true);
    } catch (error) {
      console.error('Error al iniciar grabación:', error);
      Alert.alert('Error', 'No se pudo iniciar la grabación de audio.');
    }
  };

  const detenerGrabacion = async () => {
    try {
      await audioRecorder.stop();
      setGrabando(false);
      if (audioRecorder.uri) {
        setAudioUri(audioRecorder.uri);
      }
    } catch (error) {
      console.error('Error al detener grabación:', error);
      setGrabando(false);
    }
  };

  const descartarAudio = () => setAudioUri(null);

  const enviarReporte = async () => {
    if (!tipoSeleccionado) {
      Alert.alert("Falta información", "Por favor, selecciona qué tipo de problema es.");
      return;
    }

    setEnviando(true);

    try {
      // 1. Validamos permisos de GPS
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'El reporte requiere tu ubicación.');
        setEnviando(false);
        return;
      }

      // 2. RECUPERAMOS EL RESPALDO DEL GPS OFFLINE
      let lat = -33.0094; // Centro de Gualeguaychú por defecto
      let lon = -58.5111;

      try {
        let ubicacion = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        lat = ubicacion.coords.latitude;
        lon = ubicacion.coords.longitude;
      } catch (errorGPS) {
        console.warn("GPS falló al estar offline, usando última conocida...");
        let ultimaUbicacion = await Location.getLastKnownPositionAsync();
        if (ultimaUbicacion) {
          lat = ultimaUbicacion.coords.latitude;
          lon = ultimaUbicacion.coords.longitude;
        }
      }

      //geocodificaion inversa tolerante a fallas de red
      let direccionDetectada = `Coord: ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      try {
        const estadoRedPrevio = await Network.getNetworkStateAsync();
        if (estadoRedPrevio.isConnected && estadoRedPrevio.isInternetReachable) {
          const direcciones = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
          if (direcciones && direcciones.length > 0) {
            const dir = direcciones[0];
            if (dir.street) {
              direccionDetectada = dir.streetNumber ? `${dir.street} ${dir.streetNumber}` : dir.street;
            } else if (dir.name) {
              direccionDetectada = dir.name;
            }
          }
        }
      } catch (errorGeo) {
        console.warn("Sin red para traducir calle ahora, se resolverá al sincronizar.");
      }

      // 3. Persistencia de archivos en carpeta segura
      let fotoPersistente = null;
      if (fotoUri) {
        fotoPersistente = await servicioArchivos.guardarPersistente(fotoUri, 'fotos');
      }

      let audioPersistente = null;
      if (audioUri) {
        audioPersistente = await servicioArchivos.guardarPersistente(audioUri, 'audios');
      }

      // 4. Guardamos en la base de datos local (SQLite) incluyendo la dirección
      await servicioDB.encolarReporte({
        tipoId: tipoSeleccionado,
        descripcion: descripcion,
        fotoUri: fotoPersistente,
        audioUri: audioPersistente,
        latitud: lat,
        longitud: lon,
        direccion: direccionDetectada
      });

      // 5. Verificamos la red en el momento exacto
      const estadoRed = await Network.getNetworkStateAsync();

      if (estadoRed.isConnected && estadoRed.isInternetReachable) {
        await servicioSincronizacion.procesarCola();
        Alert.alert(
          "Reporte Enviado", 
          "Tu reporte se ha guardado y se está enviando a la Municipalidad."
        );
      } else {
        Alert.alert(
          "Reporte Guardado Offline", 
          "Tu reporte está seguro en tu teléfono. Se enviará solo cuando recuperes la señal."
        );
      }

      // Limpiamos el formulario
      setFotoUri(null);
      setTipoSeleccionado('');
      setDescripcion('');
      setAudioUri(null);

    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Ocurrió un problema interno al guardar el reporte.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {fotoUri ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex1}>
          <ScrollView contentContainerStyle={styles.scrollFormulario}>
            <View style={styles.cabeceraFoto}>
              <Image source={{ uri: fotoUri }} style={styles.miniaturaFoto} />
              <TouchableOpacity style={styles.botonSecundario} onPress={() => setFotoUri(null)} disabled={enviando}>
                <Text style={styles.textoBotonSecundario}>Cambiar foto</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.labelFormulario}>¿Qué pasa?</Text>
            <View style={styles.contenedorChips}>
              {TIPOS_PROBLEMA.map((tipo) => (
                <TouchableOpacity 
                  key={tipo} 
                  style={[styles.chip, tipoSeleccionado === tipo && styles.chipActivo]}
                  onPress={() => setTipoSeleccionado(tipo)}
                  disabled={enviando}
                >
                  <Text style={[styles.textoChip, tipoSeleccionado === tipo && styles.textoChipActivo]}>{tipo}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.labelFormulario}>Contanos (opcional)</Text>
            <TextInput
              style={styles.inputDescripcion}
              placeholder="Escribe más detalles aquí..."
              multiline={true}
              numberOfLines={3}
              value={descripcion}
              onChangeText={setDescripcion}
              editable={!enviando}
            />

            <View style={styles.contenedorAudio}>
              {audioUri ? (
                <View style={styles.filaAudio}>
                  <Text style={styles.textoAudioExito}>✓ Audio grabado listo</Text>
                  <TouchableOpacity style={styles.botonDescartar} onPress={descartarAudio} disabled={enviando}>
                    <Text style={styles.textoBotonDescartar}>Borrar</Text>
                  </TouchableOpacity>
                </View>
              ) : grabando ? (
                <TouchableOpacity style={styles.botonGrabando} onPress={detenerGrabacion}>
                  <Text style={styles.textoBotonGrabando}>⏹ Detener grabación...</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.botonGrabar} onPress={iniciarGrabacion} disabled={enviando}>
                  <Text style={styles.textoBotonGrabar}>🎤 Grabar nota de voz</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity 
              style={[styles.botonEnviar, enviando && styles.botonEnviando]} 
              onPress={enviarReporte}
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
            <TouchableOpacity style={styles.botonCaptura} onPress={tomarFoto}>
              <View style={styles.circuloInterno} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  flex1: { flex: 1 },
  textoError: { fontSize: 16, textAlign: 'center', marginBottom: 20 },
  contenedorControlesOverlay: { position: 'absolute', bottom: 40, width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  botonCaptura: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255, 255, 255, 0.3)', justifyContent: 'center', alignItems: 'center' },
  circuloInterno: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff' },
  scrollFormulario: { padding: 20 },
  cabeceraFoto: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, backgroundColor: '#f9f9f9', padding: 10, borderRadius: 8 },
  miniaturaFoto: { width: 60, height: 60, borderRadius: 8, marginRight: 15 },
  botonSecundario: { padding: 8, backgroundColor: '#e9ecef', borderRadius: 6 },
  textoBotonSecundario: { color: '#495057', fontWeight: 'bold' },
  labelFormulario: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  contenedorChips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20 },
  chip: { backgroundColor: '#e9ecef', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 20, marginRight: 10, marginBottom: 10 },
  chipActivo: { backgroundColor: '#007BFF' },
  textoChip: { color: '#495057', fontSize: 14, fontWeight: '500' },
  textoChipActivo: { color: '#fff', fontWeight: 'bold' },
  inputDescripcion: { backgroundColor: '#f4f4f4', borderRadius: 8, padding: 15, fontSize: 16, minHeight: 80, textAlignVertical: 'top', marginBottom: 15 },
  contenedorAudio: { marginBottom: 30 },
  botonGrabar: { backgroundColor: '#e3f2fd', padding: 15, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#90caf9' },
  textoBotonGrabar: { color: '#1565c0', fontSize: 16, fontWeight: 'bold' },
  botonGrabando: { backgroundColor: '#ffebee', padding: 15, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#ef9a9a' },
  textoBotonGrabando: { color: '#c62828', fontSize: 16, fontWeight: 'bold' },
  filaAudio: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#e8f5e9', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#a5d6a7' },
  textoAudioExito: { color: '#2e7d32', fontSize: 16, fontWeight: 'bold' },
  botonDescartar: { padding: 5 },
  textoBotonDescartar: { color: '#c62828', fontWeight: 'bold' },
  botonEnviar: { backgroundColor: '#28a745', padding: 18, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  botonEnviando: { backgroundColor: '#6c757d' },
  textoBotonEnviar: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});