import { Tabs } from 'expo-router';
import React from 'react';
//import Ionicons from '@expo/vector-icons/Ionicons';
import Ionicons from '@react-native-vector-icons/ionicons';
export default function LayoutTabs() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#007BFF', headerShown: false }}>
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: 'Mis Reportes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={size} color={color} />
          ),
        }} 
      />
      <Tabs.Screen 
        name="mapa" 
        options={{ 
          title: 'Mapa Público',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map-outline" size={size} color={color} />
          ),
        }} 
      />
      <Tabs.Screen 
        name="nuevo" 
        options={{ 
          title: 'Nuevo Reporte',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle-outline" size={size} color={color} />
          ),
        }} 
      />
    </Tabs>
  );
}

// // app/_layout.tsx
// import { Stack } from 'expo-router';
// import { useEffect } from 'react';
// import { Platform } from 'react-native';
// import * as Notifications from 'expo-notifications';
// import { servicioDB } from '../../src/servicios/baseDeDatos';

// export default function LayoutPrincipal() {
//   useEffect(() => {
//     servicioDB.inicializar();

//     const configurarNotificaciones = async () => {
//       if (Platform.OS === 'android') {
//         await Notifications.setNotificationChannelAsync('default', {
//           name: 'Avisos generales',
//           importance: Notifications.AndroidImportance.MAX,
//           vibrationPattern: [0, 250, 250, 250],
//         });
//       }

//       const { status } = await Notifications.getPermissionsAsync();
//       if (status !== 'granted') {
//         await Notifications.requestPermissionsAsync();
//       }
//     };

//     configurarNotificaciones();
//   }, []);

//   return (
//     <Stack screenOptions={{ headerShown: false }}>
//       <Stack.Screen name="index" />
//       <Stack.Screen name="(tabs)" />
//     </Stack>
//   );
// }
// app/(tabs)/_layout.tsx