import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { servicioAuth } from '../src/servicios/auth';

export default function PantallaInicio() {
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [cargando, setCargando] = useState(true);
  const [procesandoLogin, setProcesandoLogin] = useState(false);

  // Hook que se ejecuta al abrir la aplicación
  useEffect(() => {
    const revisarSesion = async () => {
      const haySesion = await servicioAuth.tieneSesionGuardada();
      
      if (haySesion) {
        // Disparamos la lectura de huella dactilar
        const biometriaExitosa = await servicioAuth.validarBiometria();
        if (biometriaExitosa) {
          router.replace('/(tabs)');
          return;
        } else {
          Alert.alert('Autenticación fallida', 'No se pudo verificar la identidad.');
        }
      }
      // Si no hay sesión o falló la biometría, mostramos el formulario
      setCargando(false);
    };

    revisarSesion();
  }, []);

  const manejarIngreso = async () => {
    if (!email || !clave) {
      Alert.alert('Datos incompletos', 'Ingresa tu correo y contraseña.');
      return;
    }
    // Llama al servicio que guarda el token encriptado
    setProcesandoLogin(true);
    const resultado = await servicioAuth.iniciarSesion(email, clave);
    setProcesandoLogin(false);
    
    if (resultado.exito) {
      // Navegamos a la aplicación principal eliminando el historial de navegación
      router.replace('/(tabs)');
    } else {
      Alert.alert('Error de acceso', resultado.mensaje);
    }
  };
  
    


  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color="#007BFF" />
        <Text style={styles.textoCarga}>Verificando seguridad...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <Text style={styles.titulo}>Reporte Ciudadano</Text>
      <Text style={styles.subtitulo}>Municipalidad de Gualeguaychú</Text>
      
      <View style={styles.formulario}>
        <TextInput
          style={styles.input}
          placeholder="Correo electrónico"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          editable={!procesandoLogin}
        />
        
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          secureTextEntry={true}
          value={clave}
          onChangeText={setClave}
          editable={!procesandoLogin}
        />

        <TouchableOpacity 
          style={[styles.boton, procesandoLogin && styles.botonDesactivado]} 
          onPress={manejarIngreso}
          disabled={procesandoLogin}
        >
          {procesandoLogin ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.textoBoton}>Ingresar</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5', padding: 20 },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  textoCarga: { marginTop: 15, fontSize: 16, color: '#555' },
  titulo: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  subtitulo: { fontSize: 16, color: '#666', marginBottom: 40 },
  formulario: { width: '100%', maxWidth: 400 },
  input: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 15, fontSize: 16, borderWidth: 1, borderColor: '#ddd' },
  boton: { backgroundColor: '#007BFF', padding: 15, borderRadius: 8, alignItems: 'center', height: 55, justifyContent: 'center' },
  botonDesactivado: { backgroundColor: '#a0c4ff' },
  textoBoton: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});

// import React from 'react';
// import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
// import { router } from 'expo-router';

// export default function PantallaInicio() {
//   return (
//     <View style={styles.container}>
//       <Text style={styles.titulo}>Reporte Ciudadano</Text>
//       <Text style={styles.subtitulo}>Municipalidad de Gualeguaychú</Text>
      
//       {/* Botón con un área táctil adecuada[cite: 5] */}
//       <TouchableOpacity 
//         style={styles.boton} 
//         //onPress={() => router.push('/(tabs)/reportes')}
//         onPress={() => router.replace('/(tabs)')}
//       >
//         <Text style={styles.textoBoton}>Ingresar como Vecino</Text>
//       </TouchableOpacity>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5', padding: 20 },
//   titulo: { fontSize: 28, fontWeight: 'bold', color: '#333' },
//   subtitulo: { fontSize: 16, color: '#666', marginBottom: 40 },
//   boton: { backgroundColor: '#007BFF', padding: 15, borderRadius: 8, width: '100%', alignItems: 'center' },
//   textoBoton: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
// });

// import React, { useState, useEffect } from 'react';
// import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
// import * as Location from 'expo-location';

// export default function IndexScreen() {
//   const [ubicacion, setUbicacion] = useState<Location.LocationObject | null>(null);
//   const [mensajeError, setMensajeError] = useState<string | null>(null);

//   // Hook que se ejecuta al cargar la pantalla (similar a onCreate en Android)
//   useEffect(() => {
//     (async () => {
//       // 1. Solicitamos permiso al usuario
//       let { status } = await Location.requestForegroundPermissionsAsync();
//       if (status !== 'granted') {
//         setMensajeError('Se denegó el permiso para acceder a la ubicación.');
//         return;
//       }

//       // 2. Leemos las coordenadas del GPS[cite: 9]
//       let location = await Location.getCurrentPositionAsync({});
//       setUbicacion(location);
//     })();
//   }, []);

//   return (
//     <View style={styles.container}>
//       <Text style={styles.titulo}>Mi Ubicación GPS</Text>
      
//       {mensajeError ? (
//         <Text style={styles.error}>{mensajeError}</Text>
//       ) : !ubicacion ? (
//         <ActivityIndicator size="large" color="#0000ff" />
//       ) : (
//         <View style={styles.tarjeta}>
//           <Text style={styles.texto}>Latitud: {ubicacion.coords.latitude}</Text>
//           <Text style={styles.texto}>Longitud: {ubicacion.coords.longitude}</Text>
//           <Text style={styles.texto}>Altitud: {ubicacion.coords.altitude || 'N/A'}</Text>
//         </View>
//       )}
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0', padding: 20 },
//   titulo: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
//   tarjeta: { backgroundColor: '#fff', padding: 20, borderRadius: 10, elevation: 3, width: '100%' },
//   texto: { fontSize: 16, marginBottom: 10, color: '#333' },
//   error: { color: 'red', fontSize: 16, textAlign: 'center' }
// });


///-----------------------------------------------
// import React from 'react';
// import { StyleSheet, Text, View, FlatList, TouchableOpacity, Alert } from 'react-native';

// // Simulamos datos que te servirán para cualquiera de los 5 TFI (Directorio, Guía, Reservas)
// const datosDePrueba = [
//   { id: '1', titulo: 'Parque Central', subtitulo: 'Actividades al aire libre' },
//   { id: '2', titulo: 'Polideportivo Municipal', subtitulo: 'Canchas disponibles' },
//   { id: '3', titulo: 'Centro Histórico', subtitulo: 'Monumentos y museos' },
// ];

// export default function IndexScreen() {
//   // Las Tarjetas (Cards) agrupan información de forma estructurada y visualmente atractiva[cite: 8]
//   const renderItem = ({ item }: { item: any }) => (
//     <TouchableOpacity 
//       style={styles.tarjeta} 
//       onPress={() => Alert.alert("Seleccionaste:", item.titulo)}
//     >
//       <Text style={styles.tituloTarjeta}>{item.titulo}</Text>
//       <Text style={styles.subtituloTarjeta}>{item.subtitulo}</Text>
//     </TouchableOpacity>
//   );

//   return (
//     <View style={styles.container}>
//       <Text style={styles.tituloPantalla}>Directorio / Guía</Text>
      
//       {/* Componente para mostrar colecciones de forma vertical optimizando la memoria[cite: 8] */}
//       <FlatList
//         data={datosDePrueba}
//         keyExtractor={item => item.id}
//         renderItem={renderItem}
//         contentContainerStyle={styles.lista}
//       />
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: '#f0a4a4', paddingTop: 50 },
//   tituloPantalla: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
//   lista: { paddingHorizontal: 20, paddingBottom: 20 },
//   tarjeta: { 
//     backgroundColor: '#c3d2e4', 
//     padding: 20, 
//     borderRadius: 10, 
//     marginBottom: 15,
//     elevation: 3 // Genera la sombra característica de las Cards en Android
//   },
//   tituloTarjeta: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
//   subtituloTarjeta: { fontSize: 14, color: '#666' }
// });