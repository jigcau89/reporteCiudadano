import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { servicioReportes } from '../../src/servicios/reportes';
import { servicioSincronizacion } from '../../src/servicios/sincronizacion';
import { Reporte } from '../../src/tipos';

export default function BandejaReportes() {
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const cargarDatosYSincronizar = async () => {
    setCargando(true);

    // 1. Intentamos sincronizar la cola local en su propio bloque aislado
    try {
      const reportesSubidos = await servicioSincronizacion.procesarCola();
      if (reportesSubidos > 0) {
        Alert.alert('Sincronización Exitosa', `Se enviaron ${reportesSubidos} reportes pendientes.`);
      }
    } catch (errorSync) {
      console.log("Pausa en sincronización local:", errorSync);
    }

    // 2. Descargamos la bandeja del servidor independientemente de lo anterior
    try {
      const respuesta = await servicioReportes.obtenerTodos();
      if (respuesta && respuesta.datos) {
        setReportes(respuesta.datos);
      }
    } catch (errorRed) {
      console.log("Modo offline o error al actualizar bandeja.");
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  };

  // Este hook garantiza que la función corra CADA VEZ que tocas la pestaña "Mis Reportes"
  useFocusEffect(
    useCallback(() => {
      cargarDatosYSincronizar();
      
      // Cleanup: Opcional, pero bueno para liberar memoria al irse a otra pestaña
      return () => {
        // No es estrictamente necesario vaciar el estado, pero ayuda a debuggear
      };
    }, [])
  );

  const alRefrescar = () => {
    setRefrescando(true);
    cargarDatosYSincronizar();
  };

  const renderItem = ({ item }: { item: Reporte }) => (
    <TouchableOpacity 
      style={styles.tarjeta}
      onPress={() => router.push(`/detalle/${item.id}`)}
    >
      <Text style={styles.estado}>{item.estado.replace('_', ' ').toUpperCase()}</Text>
      <Text style={styles.direccion}>{item.direccion}</Text>
      <Text style={styles.codigo}>ID: {item.codigo}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {cargando && !refrescando ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" color="#007BFF" />
          <Text style={styles.textoCarga}>Actualizando bandeja...</Text>
        </View>
      ) : (
        <FlatList
          data={reportes}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.lista}
          refreshControl={
            <RefreshControl refreshing={refrescando} onRefresh={alRefrescar} colors={["#007BFF"]} />
          }
          // Mensaje amigable si la lista queda vacía (muy común en offline puro)
          ListEmptyComponent={
            <View style={styles.centro}>
              <Text style={{color: '#666'}}>No hay reportes para mostrar.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  textoCarga: { marginTop: 10, color: '#666' },
  lista: { padding: 15, flexGrow: 1 },
  tarjeta: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 15, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1 },
  estado: { fontSize: 12, fontWeight: 'bold', color: '#007BFF', marginBottom: 5 },
  direccion: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  codigo: { fontSize: 12, color: '#888' }
});