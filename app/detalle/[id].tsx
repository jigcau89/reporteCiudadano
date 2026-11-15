// app/detalle/[id].tsx
import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, Image, ActivityIndicator, ScrollView,
  TouchableOpacity, TextInput, Alert, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useAudioPlayer } from 'expo-audio';
//import * as ImagePicker from 'expo-image-picker';
import { servicioReportes, NOMBRES_TIPOS } from '../../src/servicios/reportes';
import { servicioAuth } from '../../src/servicios/auth';
import { Reporte, CambioDeEstado, Usuario, Cuadrilla, EstadoReporte } from '../../src/tipos';

const ESTADOS_OPCIONES: EstadoReporte[] = ['recibido', 'en_revision', 'asignado', 'resuelto', 'rechazado'];

export default function DetalleReporte() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [cambios, setCambios] = useState<CambioDeEstado[]>([]);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cuadrillas, setCuadrillas] = useState<Cuadrilla[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarQR, setMostrarQR] = useState(false);

  // Estados del formulario exclusivo para el Operador (Área 4 del PRD)
  const [nuevoEstado, setNuevoEstado] = useState<EstadoReporte>('en_revision');
  const [comentarioOp, setComentarioOp] = useState('');
  const [cuadrillaSeleccionada, setCuadrillaSeleccionada] = useState<string | null>(null);
  const [duplicadoDeInput, setDuplicadoDeInput] = useState('');
  const [fotoArregloUri, setFotoArregloUri] = useState<string | null>(null);
  const [guardandoOp, setGuardandoOp] = useState(false);

  // Reproductor de nota de voz con expo-audio
  const player = useAudioPlayer(reporte?.audioUrl || null);

  const cargarTodo = async () => {
    setCargando(true);
    const [perf, rep] = await Promise.all([
      servicioAuth.obtenerUsuarioLocal(),
      id ? servicioReportes.obtenerPorId(id) : Promise.resolve(null),
    ]);
    setUsuario(perf);

    if (rep) {
      setReporte(rep);
      setNuevoEstado(rep.estado);
      setCuadrillaSeleccionada(rep.cuadrillaId);
      setDuplicadoDeInput(rep.duplicadoDe || '');
      const hist = await servicioReportes.obtenerCambios(rep.id);
      setCambios(hist);
    }

    if (perf?.rol === 'operador') {
      const cList = await servicioReportes.obtenerCuadrillas();
      setCuadrillas(cList);
    }
    setCargando(false);
  };

  useEffect(() => {
    cargarTodo();
  }, [id]);

  const elegirFotoArreglo = async () => {
  try {
    const ImagePicker = require('expo-image-picker');
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
    });
    if (!res.canceled && res.assets.length > 0) {
      setFotoArregloUri(res.assets[0].uri);
    }
  } catch {
    Alert.alert(
      'Galería no compilada aún',
      'Ejecuta npx expo run:android para habilitar la carga desde galería.'
    );
  }
};

  const guardarCambioOperador = async () => {
    if (!reporte) return;
    // PRD: "Un reclamo rechazado tiene que decir por qué. 'Rechazado' a secas genera más enojo que no contestar."
    if (nuevoEstado === 'rechazado' && !comentarioOp.trim()) {
      Alert.alert('Motivo obligatorio', 'Para rechazar un reclamo debes escribir por qué en el comentario.');
      return;
    }

    setGuardandoOp(true);
    const res = await servicioReportes.gestionarPorOperador(reporte.id, {
      estado: nuevoEstado,
      comentario: comentarioOp,
      cuadrillaId: cuadrillaSeleccionada,
      duplicadoDe: duplicadoDeInput || null,
      fotoArregloUriLocal: fotoArregloUri,
    });
    setGuardandoOp(false);

    if (res.exito) {
      Alert.alert('Actualizado', res.mensaje);
      setComentarioOp('');
      setFotoArregloUri(null);
      cargarTodo();
    } else {
      Alert.alert('Atención', res.mensaje);
    }
  };

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color="#007BFF" />
      </View>
    );
  }

  if (!reporte) {
    return (
      <SafeAreaView style={styles.centro}>
        <Text style={styles.textoError}>Reporte no encontrado.</Text>
        <TouchableOpacity style={styles.botonVolver} onPress={() => router.back()}>
          <Text style={styles.textoBotonVolver}>← Volver</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const fotosProblema = reporte.fotos?.filter((f) => f.momento !== 'arreglo') || [];
  const fotosArreglo = reporte.fotos?.filter((f) => f.momento === 'arreglo') || [];
  const ultimoMotivoRechazo = cambios.find((c) => c.estado === 'rechazado')?.comentario;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <ScrollView style={styles.container}>
        {/* Barra superior con botón Volver y botón QR para ventanilla */}
        <View style={styles.barraSuperior}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.textoBotonVolver}>← Volver</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.botonQR} onPress={() => setMostrarQR(true)}>
            <Text style={styles.textoBotonQR}>🏁 Mostrar QR en mostrador</Text>
          </TouchableOpacity>
        </View>

        {/* Fotografías del problema */}
        {fotosProblema.length > 0 && (
          <ScrollView horizontal pagingEnabled>
            {fotosProblema.map((f, idx) => (
              <Image key={f.id || idx} source={{ uri: f.url }} style={styles.imagen} />
            ))}
          </ScrollView>
        )}

        {/* Tarjeta principal del reclamo */}
        <View style={styles.tarjeta}>
          <Text style={styles.codigo}>Seguimiento: {reporte.codigo}</Text>
          <Text style={styles.direccion}>
            {NOMBRES_TIPOS[reporte.tipoId] || reporte.tipoId} — {reporte.direccion}
          </Text>
          <Text style={styles.estado}>
            Estado: {reporte.estado.replace('_', ' ').toUpperCase()}
          </Text>
          <Text style={styles.metaTexto}>
            👥 {reporte.adhesiones} vecinos se sumaron • 📍 Zona: {reporte.zonaId?.replace('zon-', '').toUpperCase()}
          </Text>
          {reporte.cuadrillaId && (
            <Text style={styles.metaTexto}>👷 Cuadrilla asignada: {reporte.cuadrillaId}</Text>
          )}
          {reporte.duplicadoDe && (
            <Text style={[styles.metaTexto, { color: '#d9534f' }]}>
              🔗 Marcado como duplicado de: {reporte.duplicadoDe}
            </Text>
          )}

          {/* Motivo destacado si fue RECHAZADO */}
          {reporte.estado === 'rechazado' && (
            <View style={styles.cajaRechazo}>
              <Text style={styles.tituloRechazo}>Motivo del rechazo:</Text>
              <Text style={styles.textoRechazo}>
                {ultimoMotivoRechazo || 'Reclamo desestimado por el operador municipal.'}
              </Text>
            </View>
          )}

          {/* Foto del ARREGLO cuando está resuelto (Área 2 del PRD) */}
          {fotosArreglo.length > 0 && (
            <View style={styles.cajaArreglo}>
              <Text style={styles.tituloArreglo}>✅ Fotografía del problema resuelto:</Text>
              <Image source={{ uri: fotosArreglo[0].url }} style={styles.imagenArreglo} />
            </View>
          )}

          <View style={styles.separador} />

          <Text style={styles.tituloSeccion}>Descripción del vecino:</Text>
          <Text style={styles.descripcion}>
            {reporte.descripcion || 'Sin descripción escrita.'}
          </Text>

          {/* Reproductor de Nota de Voz con expo-audio */}
          {reporte.audioUrl && (
            <TouchableOpacity style={styles.botonAudio} onPress={() => player.play()}>
              <Text style={styles.textoBotonAudio}>▶️ Escuchar nota de voz grabada</Text>
            </TouchableOpacity>
          )}

          <View style={styles.separador} />

          {/* LÍNEA DE TIEMPO: "Qué fue pasando" (Área 2 del PRD) */}
          <Text style={styles.tituloSeccion}>¿Qué fue pasando?</Text>
          <View style={styles.itemHistorial}>
            <Text style={styles.fechaHistorial}>
              {new Date(reporte.creadoEn).toLocaleDateString('es-AR')} — RECIBIDO
            </Text>
            <Text style={styles.comentarioHistorial}>Reclamo ingresado por el vecino.</Text>
          </View>
          {cambios.map((c) => (
            <View key={c.id} style={styles.itemHistorial}>
              <Text style={styles.fechaHistorial}>
                {new Date(c.fechaHora).toLocaleDateString('es-AR')} — {c.estado.replace('_', ' ').toUpperCase()}
              </Text>
              {c.comentario && (
                <Text style={styles.comentarioHistorial}>"{c.comentario}"</Text>
              )}
            </View>
          ))}
        </View>

        {/* PANEL EXCLUSIVO DEL OPERADOR MUNICIPAL (Oculto para el vecino según Área 4 del PRD) */}
        {usuario?.rol === 'operador' && (
          <View style={styles.panelOperador}>
            <Text style={styles.tituloPanelOperador}>🛠️ Gestión del Operador Municipal</Text>

            <Text style={styles.labelOp}>1. Cambiar estado:</Text>
            <View style={styles.chipsRow}>
              {ESTADOS_OPCIONES.map((est) => (
                <TouchableOpacity
                  key={est}
                  style={[styles.chipOp, nuevoEstado === est && styles.chipOpActivo]}
                  onPress={() => setNuevoEstado(est)}
                >
                  <Text style={[styles.textoChipOp, nuevoEstado === est && { color: '#fff' }]}>
                    {est.replace('_', ' ').toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.labelOp}>2. Motivo / Comentario para el vecino:</Text>
            <TextInput
              style={styles.inputOp}
              placeholder="Ej: Verificado en el lugar / Rechazado por..."
              value={comentarioOp}
              onChangeText={setComentarioOp}
              multiline
            />

            <Text style={styles.labelOp}>3. Asignar a Cuadrilla:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {cuadrillas.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.chipOp, cuadrillaSeleccionada === c.id && styles.chipOpActivo]}
                  onPress={() => setCuadrillaSeleccionada(c.id)}
                >
                  <Text style={[styles.textoChipOp, cuadrillaSeleccionada === c.id && { color: '#fff' }]}>
                    {c.nombre}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.labelOp}>4. ¿Es duplicado de otro reporte? (ID o código):</Text>
            <TextInput
              style={styles.inputOpSimple}
              placeholder="Ej: rep-00412 (dejar vacío si no es duplicado)"
              value={duplicadoDeInput}
              onChangeText={setDuplicadoDeInput}
            />

            <Text style={styles.labelOp}>5. Foto del arreglo (al resolver):</Text>
            <TouchableOpacity style={styles.botonSubirArreglo} onPress={elegirFotoArreglo}>
              <Text style={styles.textoSubirArreglo}>
                {fotoArregloUri ? '✓ Foto del arreglo seleccionada' : '📷 Adjuntar foto del arreglo'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.botonGuardarOp}
              onPress={guardarCambioOperador}
              disabled={guardandoOp}
            >
              {guardandoOp ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.textoGuardarOp}>GUARDAR CAMBIOS DEL REPORTE</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* MODAL DEL CÓDIGO QR PARA MOSTRAR EN VENTANILLA */}
      <Modal visible={mostrarQR} transparent animationType="fade">
        <View style={styles.fondoModal}>
          <View style={styles.cajaQR}>
            <Text style={styles.tituloQR}>Mostrá este QR en ventanilla</Text>
            <Text style={styles.subtituloQR}>{reporte.codigo}</Text>
            <Image
              source={{
                uri: `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(reporte.id)}`
              }}
              style={{ width: 220, height: 220, marginVertical: 15 }}
            />
            <Text style={{ fontSize: 13, color: '#555', textAlign: 'center', marginBottom: 15 }}>
              El operador municipal puede escanearlo desde su app para abrir el reclamo sin tipear.
            </Text>
            <TouchableOpacity style={styles.botonGuardarOp} onPress={() => setMostrarQR(false)}>
              <Text style={styles.textoGuardarOp}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  textoError: { fontSize: 16, color: '#333', marginBottom: 10 },
  barraSuperior: {
    height: 54, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#ddd'
  },
  botonVolver: { padding: 10 },
  textoBotonVolver: { fontSize: 16, color: '#007BFF', fontWeight: 'bold' },
  botonQR: { backgroundColor: '#e3f2fd', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
  textoBotonQR: { color: '#007BFF', fontWeight: 'bold', fontSize: 13 },
  imagen: { width: 380, height: 240, backgroundColor: '#ccc' },
  tarjeta: { backgroundColor: '#fff', margin: 15, padding: 20, borderRadius: 10, elevation: 3 },
  codigo: { fontSize: 14, color: '#666', fontWeight: 'bold', marginBottom: 4 },
  direccion: { fontSize: 20, fontWeight: 'bold', color: '#222', marginBottom: 6 },
  estado: { fontSize: 15, fontWeight: 'bold', color: '#C1440E', marginBottom: 6 },
  metaTexto: { fontSize: 13, color: '#555', marginBottom: 4 },
  cajaRechazo: { backgroundColor: '#ffebee', padding: 12, borderRadius: 8, marginTop: 10, borderLeftWidth: 4, borderLeftColor: '#c62828' },
  tituloRechazo: { fontWeight: 'bold', color: '#c62828', marginBottom: 4 },
  textoRechazo: { color: '#333', fontSize: 14 },
  cajaArreglo: { backgroundColor: '#e8f5e9', padding: 12, borderRadius: 8, marginTop: 12 },
  tituloArreglo: { fontWeight: 'bold', color: '#2e7d32', marginBottom: 8 },
  imagenArreglo: { width: '100%', height: 180, borderRadius: 8 },
  separador: { height: 1, backgroundColor: '#eee', marginVertical: 15 },
  tituloSeccion: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  descripcion: { fontSize: 16, color: '#444', lineHeight: 22 },
  botonAudio: { backgroundColor: '#e3f2fd', padding: 14, borderRadius: 8, marginTop: 12, alignItems: 'center' },
  textoBotonAudio: { color: '#1565c0', fontWeight: 'bold', fontSize: 15 },
  itemHistorial: { borderLeftWidth: 3, borderLeftColor: '#007BFF', paddingLeft: 12, marginBottom: 12 },
  fechaHistorial: { fontSize: 13, fontWeight: 'bold', color: '#333' },
  comentarioHistorial: { fontSize: 14, color: '#555', fontStyle: 'italic', marginTop: 2 },
  panelOperador: { backgroundColor: '#fff', marginHorizontal: 15, marginBottom: 30, padding: 20, borderRadius: 10, borderWidth: 2, borderColor: '#007BFF' },
  tituloPanelOperador: { fontSize: 18, fontWeight: 'bold', color: '#004085', marginBottom: 15 },
  labelOp: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 6 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  chipOp: { backgroundColor: '#e9ecef', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, marginRight: 8, marginBottom: 8 },
  chipOpActivo: { backgroundColor: '#007BFF' },
  textoChipOp: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  inputOp: { backgroundColor: '#f4f4f4', borderRadius: 8, padding: 12, minHeight: 65, marginBottom: 12, textAlignVertical: 'top' },
  inputOpSimple: { backgroundColor: '#f4f4f4', borderRadius: 8, padding: 12, marginBottom: 12 },
  botonSubirArreglo: { backgroundColor: '#e8f5e9', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#a5d6a7' },
  textoSubirArreglo: { color: '#2e7d32', fontWeight: 'bold' },
  botonGuardarOp: { backgroundColor: '#007BFF', padding: 16, borderRadius: 8, alignItems: 'center', width: '100%' },
  textoGuardarOp: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  fondoModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  cajaQR: { backgroundColor: '#fff', padding: 24, borderRadius: 12, alignItems: 'center', width: '90%' },
  tituloQR: { fontSize: 18, fontWeight: 'bold', color: '#222' },
  subtituloQR: { fontSize: 15, color: '#007BFF', fontWeight: 'bold', marginTop: 4 }
});