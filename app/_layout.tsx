import { Stack } from 'expo-router';
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { servicioDB } from '../src/servicios/baseDeDatos';

export default function LayoutPrincipal() {
  // Preparamos la base de datos local ni bien arranca la app
  useEffect(() => {
    servicioDB.inicializar();

    // Solicitamos permisos de notificaciones al usuario al iniciar la app
    const pedirPermisosNotificaciones = async () => {
      const { status: estadoActual } = await Notifications.getPermissionsAsync();
      if (estadoActual !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }
    };
    pedirPermisosNotificaciones();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Pantalla de inicio de sesión o bienvenida */}
      <Stack.Screen name="index" />
      {/* Grupo de pestañas (tabs) para la app principal */}
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
// import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
// import * as SplashScreen from 'expo-splash-screen';
// import { useColorScheme } from 'react-native';

// import { AnimatedSplashOverlay } from '@/components/animated-icon';
// import AppTabs from '@/components/app-tabs';

// SplashScreen.preventAutoHideAsync();

// export default function TabLayout() {
//   const colorScheme = useColorScheme();
//   return (
//     <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
//       <AnimatedSplashOverlay />
//       <AppTabs />
//     </ThemeProvider>
//   );
// }
