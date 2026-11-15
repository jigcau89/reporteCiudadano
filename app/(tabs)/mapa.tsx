// app/(tabs)/mapa.tsx
import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, ScrollView, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { servicioReportes, NOMBRES_TIPOS, calcularDistanciaMetros } from '../../src/servicios/reportes';
import { Reporte, EstadoReporte } from '../../src/tipos';

const COLORES_ESTADO: Record<EstadoReporte, string> = {
  recibido: '#dc3545',     // Rojo
  en_revision: '#fd7e14',  // Naranja
  asignado: '#007BFF',     // Azul
  resuelto: '#28a745',     // Verde
  rechazado: '#6c757d',    // Gris
};

const FILTROS_ESTADO: { label: string; valor: string }[] = [
  { label: 'Todos', valor: '' },
  { label: 'Recibido', valor: 'recibido' },
  { label: 'En revisión', valor: 'en_revision' },
  { label: 'Asignado', valor: 'asignado' },
  { label: 'Resuelto', valor: 'resuelto' },
  { label: 'Rechazado', valor: 'rechazado' },
];

const FILTROS_TIPO: { label: string; valor: string }[] = [
  { label: 'Todos los tipos', valor: '' },
  { label: 'Bache', valor: 'tip-bache' },
  { label: 'Luminaria', valor: 'tip-luminaria' },
  { label: 'Basura', valor: 'tip-basura' },
  { label: 'Rama', valor: 'tip-rama' },
  { label: 'Agua/Cloaca', valor: 'tip-agua' },
  { label: 'Semáforo', valor: 'tip-semaforo' },
  { label: 'Vereda', valor: 'tip-vereda' },
  { label: 'Otro', valor: 'tip-otro' },
];

export default function MapaPantalla() {
  const [ubicacionUsuario, setUbicacionUsuario] = useState({ latitude: -33.0089, longitude: -58.5142 });
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [cargando, setCargando] = useState(true);

  const [estadoFiltro, setEstadoFiltro] = useState<string>('');
  const [tipoFiltro, setTipoFiltro] = useState<string>('');
  const [reporteSeleccionado, setReporteSeleccionado] = useState<Reporte | null>(null);

  const cargarMapaYReportes = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const enGchu = loc.coords.latitude <= -32.90 && loc.coords.latitude >= -33.10;
        if (enGchu) {
          setUbicacionUsuario({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }
      }
    } catch {}

    try {
      const lista = await servicioReportes.obtenerPublicos({
        estado: estadoFiltro || undefined,
        tipoId: tipoFiltro || undefined,
      });
      setReportes(lista);
    } catch {
      console.log('Modo offline en mapa público');
    } finally {
      setCargando(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      cargarMapaYReportes();
    }, [estadoFiltro, tipoFiltro])
  );

  const manejarAdhesion = async (rep: Reporte) => {
    const res = await servicioReportes.adherirse(rep.id);
    Alert.alert('Vecinos sumados', res.mensaje);
    cargarMapaYReportes();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* BARRA DE FILTROS POR ESTADO Y POR TIPO (Área 3 del PRD) */}
      <View style={styles.barraFiltros}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
          {FILTROS_ESTADO.map((f) => (
            <TouchableOpacity
              key={f.valor}
              style={[styles.chipFiltro, estadoFiltro === f.valor && styles.chipFiltroActivo]}
              onPress={() => setEstadoFiltro(f.valor)}
            >
              <Text style={[styles.textoChipFiltro, estadoFiltro === f.valor && styles.textoChipActivo]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {FILTROS_TIPO.map((t) => (
            <TouchableOpacity
              key={t.valor}
              style={[styles.chipFiltroTipo, tipoFiltro === t.valor && styles.chipFiltroActivo]}
              onPress={() => setTipoFiltro(t.valor)}
            >
              <Text style={[styles.textoChipFiltro, tipoFiltro === t.valor && styles.textoChipActivo]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" color="#007BFF" />
          <Text>Cargando mapa de Gualeguaychú...</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <MapView
            style={styles.mapa}
            showsUserLocation={true}
            showsMyLocationButton={true}
            initialRegion={{
              latitude: ubicacionUsuario.latitude,
              longitude: ubicacionUsuario.longitude,
              latitudeDelta: 0.035,
              longitudeDelta: 0.035,
            }}
          >
            {reportes.map((rep) => (
              <Marker
                key={rep.id}
                coordinate={{
                  latitude: rep.coordenadas.latitud,
                  longitude: rep.coordenadas.longitud,
                }}
                pinColor={COLORES_ESTADO[rep.estado] || '#007BFF'}
                onPress={() => setReporteSeleccionado(rep)}
              />
            ))}
          </MapView>

          {/* TARJETA FLOTANTE DEL REPORTE SELECCIONADO EN EL MAPA */}
          {reporteSeleccionado && (
            <View style={styles.tarjetaInferior}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[styles.badgeEstado, { color: COLORES_ESTADO[reporteSeleccionado.estado] }]}>
                  ● {reporteSeleccionado.estado.replace('_', ' ').toUpperCase()}
                </Text>
                <TouchableOpacity onPress={() => setReporteSeleccionado(null)}>
                  <Text style={{ fontWeight: 'bold', color: '#888', fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.tituloTarjeta}>
                {NOMBRES_TIPOS[reporteSeleccionado.tipoId] || reporteSeleccionado.tipoId} — {reporteSeleccionado.direccion}
              </Text>
              <Text style={styles.distanciaTexto}>
                📍 A {Math.round(calcularDistanciaMetros(
                  ubicacionUsuario.latitude,
                  ubicacionUsuario.longitude,
                  reporteSeleccionado.coordenadas.latitud,
                  reporteSeleccionado.coordenadas.longitud
                ))} metros de tu ubicación • 👥 {reporteSeleccionado.adhesiones} vecinos sumados
              </Text>

              <View style={styles.filaBotonesTarjeta}>
                <TouchableOpacity
                  style={styles.botonSumarme}
                  onPress={() => manejarAdhesion(reporteSeleccionado)}
                >
                  <Text style={styles.textoBotonBlanco}>🙋‍♂️ Sumarme (+1)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.botonVerDetalle}
                  onPress={() => router.push(`/detalle/${reporteSeleccionado.id}`)}
                >
                  <Text style={styles.textoBotonBlanco}>Ver seguimiento →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mapa: { flex: 1, width: '100%' },
  barraFiltros: { paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee' },
  chipFiltro: { backgroundColor: '#f1f3f5', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, marginRight: 6 },
  chipFiltroTipo: { backgroundColor: '#e9ecef', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, marginRight: 6 },
  chipFiltroActivo: { backgroundColor: '#007BFF' },
  textoChipFiltro: { fontSize: 13, color: '#333', fontWeight: '500' },
  textoChipActivo: { color: '#fff', fontWeight: 'bold' },
  tarjetaInferior: {
    position: 'absolute', bottom: 15, left: 15, right: 15,
    backgroundColor: '#fff', padding: 16, borderRadius: 12, elevation: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2
  },
  badgeEstado: { fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  tituloTarjeta: { fontSize: 17, fontWeight: 'bold', color: '#222' },
  distanciaTexto: { fontSize: 13, color: '#555', marginVertical: 6 },
  filaBotonesTarjeta: { flexDirection: 'row', gap: 10, marginTop: 8 },
  botonSumarme: { flex: 1, backgroundColor: '#28a745', padding: 12, borderRadius: 8, alignItems: 'center' },
  botonVerDetalle: { flex: 1, backgroundColor: '#007BFF', padding: 12, borderRadius: 8, alignItems: 'center' },
  textoBotonBlanco: { color: '#fff', fontWeight: 'bold', fontSize: 14 }
});