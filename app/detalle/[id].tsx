// app/detalle/[id].tsx
import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Image, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { servicioReportes } from '../../src/servicios/reportes';
import { Reporte } from '../../src/tipos';

export default function DetalleReporte() {
  // Extraemos el ID directamente de la URL de navegación
  const { id } = useLocalSearchParams<{ id: string }>();
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const cargarDetalle = async () => {
      if (id) {
        const datos = await servicioReportes.obtenerPorId(id);
        setReporte(datos);
      }
      setCargando(false);
    };
    cargarDetalle();
  }, [id]);

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color="#007BFF" />
      </View>
    );
  }

  if (!reporte) {
    return (
      <View style={styles.centro}>
        <Text>Reporte no encontrado.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
    <ScrollView style={styles.container}>
      {/* Botón de retroceso con un área táctil mínima recomendada de 44x44 puntos[cite: 1] */}
      <TouchableOpacity style={styles.botonVolver} onPress={() => router.back()}>
        <Text style={styles.textoBotonVolver}>← Volver a la bandeja</Text>
      </TouchableOpacity>

      {reporte.fotos.length > 0 ? (
        <Image source={{ uri: reporte.fotos[0].url }} style={styles.imagen} />
      ) : (
        <View style={styles.sinImagen}><Text>Sin fotografía</Text></View>
      )}

      {/* Tarjeta para agrupar la información visualmente atractiva e intuitiva[cite: 1] */}
      <View style={styles.tarjeta}>
        <Text style={styles.codigo}>{reporte.codigo}</Text>
        <Text style={styles.estado}>Estado: {reporte.estado.replace('_', ' ').toUpperCase()}</Text>
        <Text style={styles.direccion}>{reporte.direccion}</Text>
        
        <View style={styles.separador} />
        
        <Text style={styles.tituloSeccion}>Descripción del vecino:</Text>
        <Text style={styles.descripcion}>{reporte.descripcion || "Sin descripción escrita (sólo imagen/audio)."}</Text>
        
        <View style={styles.separador} />
        
        <Text style={styles.tituloSeccion}>Coordenadas GPS:</Text>
        <Text style={styles.descripcion}>Lat: {reporte.coordenadas.latitud}, Lon: {reporte.coordenadas.longitud}</Text>
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  botonVolver: { 
    padding: 15, // Asegura el tamaño táctil correcto[cite: 1]
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#ddd' 
  },
  textoBotonVolver: { fontSize: 16, color: '#007BFF', fontWeight: 'bold' },
  imagen: { width: '100%', height: 250, backgroundColor: '#ccc' },
  sinImagen: { width: '100%', height: 250, backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center' },
  tarjeta: { 
    backgroundColor: '#fff', 
    margin: 15, 
    padding: 20, 
    borderRadius: 8, 
    elevation: 3, 
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1 
  },
  codigo: { fontSize: 14, color: '#888', marginBottom: 5 },
  estado: { fontSize: 14, fontWeight: 'bold', color: '#C1440E', marginBottom: 10 },
  direccion: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  separador: { height: 1, backgroundColor: '#eee', marginVertical: 15 },
  tituloSeccion: { fontSize: 16, fontWeight: 'bold', color: '#555', marginBottom: 5 },
  descripcion: { fontSize: 16, color: '#444', lineHeight: 24 }
});