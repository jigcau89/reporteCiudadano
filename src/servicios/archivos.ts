// src/servicios/archivos.ts
import { File, Directory, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

export const servicioArchivos = {
  /**
   * Mueve un archivo desde la caché temporal hacia una carpeta persistente del dispositivo.
   */
  guardarPersistente: async (uriTemporal: string, tipo: 'fotos' | 'audios'): Promise<string> => {
    try {
      const directorioBase = new Directory(Paths.document);
      const directorioDestino = new Directory(directorioBase, tipo);
      
      if (!directorioDestino.exists) {
        directorioDestino.create();
      }

      const extension = tipo === 'fotos' ? 'jpg' : 'm4a';
      const nombreArchivo = `evidencia_${Date.now()}.${extension}`;
      
      const archivoTemporal = new File(uriTemporal);
      const archivoFinal = new File(directorioDestino, nombreArchivo);

      archivoTemporal.copy(archivoFinal);

      return archivoFinal.uri;
    } catch (error) {
      console.error(`Error al guardar el archivo de ${tipo}:`, error);
      return uriTemporal;
    }
  },

  /**
   * Sube un archivo local a la API usando XMLHttpRequest nativo de React Native,
   * que soporta { uri, name, type } en Android físico y emulador sin lanzar Unsupported FormDataPart.
   */
  subirAlServidor: async (uriLocal: string, tipo: 'fotos' | 'audios'): Promise<string | null> => {
    try {
      const extension = tipo === 'fotos' ? 'jpg' : 'm4a';
      const tipoMime = tipo === 'fotos' ? 'image/jpeg' : 'audio/m4a';
      const uriFormateada = uriLocal.startsWith('file://') ? uriLocal : `file://${uriLocal}`;

      const token = await SecureStore.getItemAsync('token_sesion_ciudadano');
      const baseURL = process.env.EXPO_PUBLIC_API_URL;

      return await new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${baseURL}/archivos`);

        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const respuesta = JSON.parse(xhr.responseText);
              const datos = respuesta.datos;
              resolve(typeof datos === 'string' ? datos : datos.url);
            } catch (e) {
              console.error('Error al parsear respuesta de /archivos:', e);
              resolve(null);
            }
          } else {
            console.error(`Error HTTP ${xhr.status} al subir ${tipo}:`, xhr.responseText);
            resolve(null);
          }
        };

        xhr.onerror = () => {
          console.error(`Error de red al subir ${tipo} a ${baseURL}/archivos`);
          resolve(null);
        };

        const formData = new FormData();
        formData.append('archivo', {
          uri: uriFormateada,
          name: `evidencia_${Date.now()}.${extension}`,
          type: tipoMime,
        } as any);

        xhr.send(formData);
      });
    } catch (error) {
      console.error(`Error al subir ${tipo} al servidor:`, error);
      return null;
    }
  }
};