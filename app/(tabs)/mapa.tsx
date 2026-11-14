import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import MapView, { Marker,  PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MapaPantalla() {
  const [ubicacion, setUbicacion] = useState<Location.LocationObject | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);



  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setMensajeError('Se denegó el permiso para acceder a la ubicación.');
        return;
      }

      try {
        // 1. Intenta obtener la ubicación de forma rápida sin forzar el sensor físico
        let location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUbicacion(location);
      } catch (error) {
        // 2. Si falla (muy común bajo techo), cargamos Gualeguaychú por defecto
        console.warn("Fallo el GPS, usando coordenadas por defecto.");
        setUbicacion({
          coords: {
            latitude: -33.0094,
            longitude: -58.5111,
            altitude: null,
            accuracy: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null
          },
          timestamp: Date.now()
        });
      }
    })();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {mensajeError ? (
        <View style={styles.centro}><Text style={styles.error}>{mensajeError}</Text></View>
      ) : !ubicacion ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" color="#007BFF" />
          <Text>Cargando interfaz del mapa...</Text>
        </View>
      ) : (
        <MapView 
         
          style={styles.mapa}
          //provider={PROVIDER_GOOGLE} // Fuerzas el uso del motor nativo de Google Maps
          showsUserLocation={true} 
          showsMyLocationButton={true}
          initialRegion={{
            latitude: ubicacion.coords.latitude,
            longitude: ubicacion.coords.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          <Marker 
            coordinate={{ 
              latitude: ubicacion.coords.latitude, 
              longitude: ubicacion.coords.longitude 
            }}
            title="Centro del Mapa"
          />
        </MapView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mapa: { flex: 1, width: '100%' }, 
  error: { color: 'red', fontSize: 16, textAlign: 'center', padding: 20 }
});