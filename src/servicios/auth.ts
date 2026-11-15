// src/servicios/auth.ts
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import Storage from 'expo-sqlite/kv-store';
import { api } from '../api/cliente';
import { Usuario } from '../tipos';

const CLAVE_TOKEN = 'token_sesion_ciudadano';
const CLAVE_USUARIO = 'perfil_usuario_ciudadano';

export const servicioAuth = {
  /** Inicia sesión contra POST /auth/ingreso y guarda token + perfil con rol */
  iniciarSesion: async (email: string, clave: string): Promise<{ exito: boolean; error?: string }> => {
    try {
      const respuesta = await api.post('/auth/ingreso', {
        email: email.trim().toLowerCase(),
        contrasena: clave
      });

      const { token, usuario } = respuesta.data.datos;
      await SecureStore.setItemAsync(CLAVE_TOKEN, token);

      if (usuario) {
        await Storage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
      } else {
        await servicioAuth.obtenerPerfilRemoto();
      }

      return { exito: true };
    } catch (error: any) {
      const msg = error.response?.data?.error?.mensaje || 'Credenciales incorrectas o error de red.';
      return { exito: false, error: msg };
    }
  },

  /** Registra un nuevo vecino en POST /auth/registro y deja la sesión iniciada */
  registrar: async (
    nombre: string,
    email: string,
    clave: string,
    telefono?: string
  ): Promise<{ exito: boolean; error?: string }> => {
    try {
      const payload = {
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        contrasena: clave,
        telefono: telefono && telefono.trim() !== '' ? telefono.trim() : null
      };

      const respuesta = await api.post('/auth/registro', payload);
      const datos = respuesta.data?.datos;

      // Si el registro ya devuelve el token, lo guardamos directamente
      if (datos?.token) {
        await SecureStore.setItemAsync(CLAVE_TOKEN, datos.token);
        if (datos.usuario) {
          await Storage.setItem(CLAVE_USUARIO, JSON.stringify(datos.usuario));
        } else {
          await servicioAuth.obtenerPerfilRemoto();
        }
        return { exito: true };
      }

      // Si el endpoint solo creó el usuario, iniciamos sesión automáticamente
      return await servicioAuth.iniciarSesion(email, clave);
    } catch (error: any) {
      const msg = error.response?.data?.error?.mensaje || 'No se pudo completar el registro.';
      return { exito: false, error: msg };
    }
  },

  /** Descarga el perfil actualizado desde GET /yo */
  obtenerPerfilRemoto: async (): Promise<Usuario | null> => {
    try {
      const res = await api.get('/yo');
      const usuario: Usuario = res.data.datos;
      if (usuario) {
        await Storage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
      }
      return usuario;
    } catch {
      return await servicioAuth.obtenerUsuarioLocal();
    }
  },

  /** Lee el usuario guardado en kv-store (funciona 100% offline) */
  obtenerUsuarioLocal: async (): Promise<Usuario | null> => {
    try {
      const raw = await Storage.getItem(CLAVE_USUARIO);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  /** Cambia la preferencia de avisos (Área 5 del PRD) */
  cambiarAvisosActivos: async (activos: boolean): Promise<Usuario | null> => {
    const actual = await servicioAuth.obtenerUsuarioLocal();
    if (actual) {
      const actualizado = { ...actual, avisosActivos: activos };
      await Storage.setItem(CLAVE_USUARIO, JSON.stringify(actualizado));
      try {
        await api.patch('/yo', { avisosActivos: activos });
      } catch {
        // Si está offline, queda guardado en kv-store
      }
      return actualizado;
    }
    return null;
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
    await Storage.removeItem(CLAVE_USUARIO);
  }
};