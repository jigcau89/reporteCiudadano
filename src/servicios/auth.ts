// src/servicios/auth.ts
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { api } from '../api/cliente';

const CLAVE_TOKEN = 'token_sesion_ciudadano';

export const servicioAuth = {
  iniciarSesion: async (email: string, clave: string): Promise<{ exito: boolean; mensaje?: string }> => {
    try {
      // Petición real a la API
      const respuesta = await api.post('/auth/ingreso', { email, contrasena: clave });
      
      // Extraemos el token del sobre "datos" que especifica la documentación
      const token = respuesta.data.datos.token;
      
      // Se guarda de forma encriptada
      await SecureStore.setItemAsync(CLAVE_TOKEN, token);
      return { exito: true };
    } catch (error: any) {
      // Leemos el mensaje de error estructurado que manda la API (ej. CREDENCIALES_INVALIDAS)
      const mensajeError = error.response?.data?.error?.mensaje || "No se pudo conectar con el servidor.";
      return { exito: false, mensaje: mensajeError };
    }
  },

  tieneSesionGuardada: async (): Promise<boolean> => {
    const token = await SecureStore.getItemAsync(CLAVE_TOKEN);
    return token !== null;
  },

  validarBiometria: async (): Promise<boolean> => {
    const hardwareSoportado = await LocalAuthentication.hasHardwareAsync();
    const biometriaRegistrada = await LocalAuthentication.isEnrolledAsync();

    if (!hardwareSoportado || !biometriaRegistrada) return true;

    const resultado = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Ingreso Seguro - Reporte Ciudadano',
      fallbackLabel: 'Usar contraseña',
      cancelLabel: 'Cancelar'
    });

    return resultado.success;
  },

  cerrarSesion: async () => {
    await SecureStore.deleteItemAsync(CLAVE_TOKEN);
  }
};
// // src/servicios/auth.ts
// import * as SecureStore from 'expo-secure-store';
// import * as LocalAuthentication from 'expo-local-authentication';

// const CLAVE_TOKEN = 'token_sesion_ciudadano';

// export const servicioAuth = {
//   /** Simula el inicio de sesión contra una API y guarda el token de forma encriptada */
//   iniciarSesion: async (email: string, clave: string): Promise<boolean> => {
//     return new Promise((resolve) => {
//       setTimeout(async () => {
//         // En el futuro, aquí el fetch devolverá un JWT real
//         const tokenSimulado = `jwt-fake-${Date.now()}`;
//         // El PRD prohíbe usar kv-store para el token. Usamos secure-store.
//         await SecureStore.setItemAsync(CLAVE_TOKEN, tokenSimulado);
//         resolve(true);
//       }, 1000);
//     });
//   },

//   /** Verifica si existe un token guardado de una sesión anterior */
//   tieneSesionGuardada: async (): Promise<boolean> => {
//     const token = await SecureStore.getItemAsync(CLAVE_TOKEN);
//     return token !== null;
//   },

//   /** Dispara el sensor biométrico nativo (huella/rostro) */
//   validarBiometria: async (): Promise<boolean> => {
//     // 1. Verificamos si el hardware soporta biometría
//     const hardwareSoportado = await LocalAuthentication.hasHardwareAsync();
//     // 2. Verificamos si el usuario tiene una huella/rostro registrado en su teléfono
//     const biometriaRegistrada = await LocalAuthentication.isEnrolledAsync();

//     // El PRD pide "alternativa para el dispositivo que no la tenga"
//     if (!hardwareSoportado || !biometriaRegistrada) {
//       return true; // Si no tiene hardware, permitimos el ingreso directo (basado en el token guardado)
//     }

//     // 3. Solicitamos la huella
//     const resultado = await LocalAuthentication.authenticateAsync({
//       promptMessage: 'Ingreso Seguro - Reporte Ciudadano',
//       fallbackLabel: 'Usar contraseña', // Botón de respaldo nativo
//       cancelLabel: 'Cancelar'
//     });

//     return resultado.success;
//   },

//   /** Borra el token de la bóveda segura */
//   cerrarSesion: async () => {
//     await SecureStore.deleteItemAsync(CLAVE_TOKEN);
//   }
// };