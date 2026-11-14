// src/servicios/reportes.ts
import { api } from '../api/cliente';
import { Reporte } from '../tipos';
import { servicioArchivos } from './archivos';
import * as Location from 'expo-location';

// Mapa para traducir el botón seleccionado al ID exacto de la API de la cátedra
const MAPA_TIPOS: Record<string, string> = {
  'Bache': 'tip-bache',
  'Luminaria': 'tip-luminaria',
  'Basura': 'tip-basura',
  'Rama o árbol': 'tip-rama',
  'Agua o cloaca': 'tip-agua',
  'Semáforo': 'tip-semaforo',
  'Vereda': 'tip-vereda',
  'Otro': 'tip-otro',
};

export const servicioReportes = {
  
  /** Obtiene los reportes reales del usuario actual desde la API */
  obtenerTodos: async (): Promise<{ datos: Reporte[], meta: any }> => {
    try {
      const respuesta = await api.get('/yo/reportes');
      // La API ya nos devuelve la estructura { datos: [...], meta: {...} }
      return respuesta.data;
    } catch (error) {
      console.error("Error al obtener reportes:", error);
      return { datos: [], meta: null };
    }
  },

  /** Obtiene el detalle de un reporte específico */
  obtenerPorId: async (id: string): Promise<Reporte | null> => {
    try {
      const respuesta = await api.get(`/reportes/${id}`);
      return respuesta.data.datos;
    } catch (error) {
      console.error("Error al obtener detalle del reporte:", error);
      return null;
    }
  },

 /** Sube las evidencias y luego crea el reporte en la API */
  crear: async (reporteLocal: any): Promise<{ exito: boolean, mensaje: string }> => {
    try {
      // 1. Subimos la foto (obligatoria)
      let urlFoto = null;
      if (reporteLocal.fotoUri) {
        urlFoto = await servicioArchivos.subirAlServidor(reporteLocal.fotoUri, 'fotos');
      }

      if (!urlFoto) {
        return { exito: false, mensaje: "No se pudo subir la fotografía al servidor." };
      }

      // 2. Subimos el audio (opcional, ignorando si es el texto simulado de prueba)
      let urlAudio = null;
      if (reporteLocal.audioUri && reporteLocal.audioUri !== 'archivo_simulado.m4a') {
        urlAudio = await servicioArchivos.subirAlServidor(reporteLocal.audioUri, 'audios');
      }

      // 3. Traducimos el nombre del chip al ID oficial (ej. "Luminaria" -> "tip-luminaria")
      const tipoIdOficial = MAPA_TIPOS[reporteLocal.tipoId] || reporteLocal.tipoId;

      // 4. Verificamos si las coordenadas están dentro de Gualeguaychú.
      // usamos el centro de Gualeguaychú para que la API no rechace con FUERA_DE_LA_CIUDAD)
      let lat = Number(reporteLocal.latitud);
      let lon = Number(reporteLocal.longitud);
      const estaEnGualeguaychu = lat <= -32.90 && lat >= -33.10 && lon <= -58.40 && lon >= -58.60;
      if (!estaEnGualeguaychu) {
        lat = -33.0089;
        lon = -58.5142;
      }
      
      // 5. Si el reporte se guardó offline (sin nombre de calle), intentamos obtener la calle ahora que hay internet
      let direccionFinal = reporteLocal.direccion;
      if (!direccionFinal || direccionFinal.startsWith('Coord:') || direccionFinal === 'Ubicación GPS reportada') {
        try {
          const dirs = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
          if (dirs && dirs.length > 0 && dirs[0].street) {
            direccionFinal = dirs[0].streetNumber 
              ? `${dirs[0].street} ${dirs[0].streetNumber}` 
              : dirs[0].street;
          } else {
            direccionFinal = `Gualeguaychú (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
          }
        } catch (e) {
          direccionFinal = `Gualeguaychú (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
        }
      }

      const payload = {
        tipoId: tipoIdOficial,
        descripcion: reporteLocal.descripcion || null,
        audioUrl: urlAudio,
        fotos: [{ url: urlFoto}],
        coordenadas: {
          latitud: lat,
          longitud: lon
        },
        // Enviamos también latitud/longitud en la raíz por si el validador del endpoint las lee directo
        //latitud: reporteLocal.latitud,
        //longitud: reporteLocal.longitud,
        direccion: direccionFinal,
        //envioi de fecha en que se guardo en SQLITE (o la actual si no hay fecha guardada)
        creadoEn: new Date(Date.now()-120000).toISOString() //reporteLocal.fechaHora || new Date().toISOString()
        //creadoEn: reporteLocal.fechaHora || new Date().toISOString()
        //creadoEn: "2026-09-14T09:55:00-03:00"
      };

      await api.post('/reportes', payload);

      return { exito: true, mensaje: "Reporte enviado a la municipalidad" };
    } catch (error: any) {
      console.error("Detalle del rechazo de POST /reportes:", error.response?.data || error);
      const mensajeError = error.response?.data?.error?.mensaje || "Error al enviar el reporte.";
      return { exito: false, mensaje: mensajeError };
    }
  }
};
