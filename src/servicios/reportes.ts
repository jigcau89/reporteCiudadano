// src/servicios/reportes.ts
import * as Location from 'expo-location';
import { api } from '../api/cliente';
import { Reporte, TipoDeReporte, CambioDeEstado, Zona, Cuadrilla, EstadoReporte } from '../tipos';
import { servicioArchivos } from './archivos';

export const MAPA_TIPOS: Record<string, string> = {
  'Bache': 'tip-bache',
  'Luminaria': 'tip-luminaria',
  'Basura': 'tip-basura',
  'Rama o árbol': 'tip-rama',
  'Agua o cloaca': 'tip-agua',
  'Semáforo': 'tip-semaforo',
  'Vereda': 'tip-vereda',
  'Otro': 'tip-otro',
};

export const NOMBRES_TIPOS: Record<string, string> = {
  'tip-bache': 'Bache',
  'tip-luminaria': 'Luminaria',
  'tip-basura': 'Basura',
  'tip-rama': 'Rama o árbol',
  'tip-agua': 'Agua o cloaca',
  'tip-semaforo': 'Semáforo',
  'tip-vereda': 'Vereda',
  'tip-otro': 'Otro',
};

/** Calcula la distancia en metros entre dos coordenadas GPS */
export function calcularDistanciaMetros(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const servicioReportes = {
  /** Obtiene los reportes propios del vecino ordenados del más nuevo al más viejo */
  obtenerTodos: async (): Promise<{ datos: Reporte[]; meta: any }> => {
    const respuesta = await api.get('/yo/reportes');
    const lista: Reporte[] = respuesta.data.datos || [];
    lista.sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime());
    return { datos: lista, meta: respuesta.data.meta };
  },

  /** Obtiene todos los reportes públicos (para el Mapa y para la Bandeja del Operador) con filtros */
  obtenerPublicos: async (filtros?: {
    estado?: string;
    tipoId?: string;
    zonaId?: string;
  }): Promise<Reporte[]> => {
    const params: any = { porPagina: 100 };
    if (filtros?.estado) params.estado = filtros.estado;
    if (filtros?.tipoId) params.tipoId = filtros.tipoId;
    if (filtros?.zonaId) params.zonaId = filtros.zonaId;

    const respuesta = await api.get('/reportes', { params });
    const lista: Reporte[] = respuesta.data.datos || [];
    return lista.sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime());
  },

  /** Busca reportes existentes a menos de X metros (50m por defecto según PRD) */
  buscarCercanos: async (latitud: number, longitud: number, radioMetros = 50): Promise<Reporte[]> => {
    try {
      const todos = await servicioReportes.obtenerPublicos();
      return todos.filter((r) => {
        if (r.estado === 'resuelto' || r.estado === 'rechazado') return false;
        const dist = calcularDistanciaMetros(
          latitud,
          longitud,
          r.coordenadas.latitud,
          r.coordenadas.longitud
        );
        return dist <= radioMetros;
      });
    } catch {
      return [];
    }
  },

  /** Obtiene el detalle de un reporte por ID o por Código (para el lector QR) */
  obtenerPorId: async (idOCodigo: string): Promise<Reporte | null> => {
    try {
      const respuesta = await api.get(`/reportes/${idOCodigo}`);
      return respuesta.data.datos;
    } catch {
      // Si se escaneó un código QR tipo "GCHU-2026-00412", lo buscamos en la lista general
      try {
        const todos = await servicioReportes.obtenerPublicos();
        return todos.find((r) => r.id === idOCodigo || r.codigo === idOCodigo) || null;
      } catch {
        return null;
      }
    }
  },

  /** Obtiene el historial de cambios de estado ("Qué fue pasando") */
  obtenerCambios: async (reporteId: string): Promise<CambioDeEstado[]> => {
    try {
      const res = await api.get(`/reportes/${reporteId}/cambios`);
      return res.data.datos || [];
    } catch {
      return [];
    }
  },

  /** Sumarse a un reporte existente (+1 vecino) */
  adherirse: async (reporteId: string): Promise<{ exito: boolean; mensaje: string }> => {
    try {
      await api.post(`/reportes/${reporteId}/adhesiones`);
      return { exito: true, mensaje: 'Te sumaste al reclamo exitosamente.' };
    } catch (error: any) {
      const msg = error.response?.data?.error?.mensaje || 'Ya estás sumado o no se pudo adherir.';
      return { exito: false, mensaje: msg };
    }
  },

  /** Catálogos municipales: Tipos, Zonas y Cuadrillas */
  obtenerTipos: async (): Promise<TipoDeReporte[]> => {
    try {
      const res = await api.get('/tipos-de-reporte');
      return res.data.datos || [];
    } catch {
      return [];
    }
  },

  obtenerZonas: async (): Promise<Zona[]> => {
    try {
      const res = await api.get('/zonas');
      return res.data.datos || [];
    } catch {
      return [];
    }
  },

  obtenerCuadrillas: async (): Promise<Cuadrilla[]> => {
    try {
      const res = await api.get('/cuadrillas');
      return res.data.datos || [];
    } catch {
      return [];
    }
  },

  /** Acción exclusiva del Operador: cambiar estado, dejar motivo, asignar cuadrilla, marcar duplicado o subir foto del arreglo */
  gestionarPorOperador: async (
    reporteId: string,
    datos: {
      estado: EstadoReporte;
      comentario?: string | null;
      cuadrillaId?: string | null;
      duplicadoDe?: string | null;
      fotoArregloUriLocal?: string | null;
    }
  ): Promise<{ exito: boolean; mensaje: string }> => {
    try {
      let urlFotoArreglo: string | null = null;
      if (datos.fotoArregloUriLocal) {
        urlFotoArreglo = await servicioArchivos.subirAlServidor(datos.fotoArregloUriLocal, 'fotos');
        if (!urlFotoArreglo) {
          return { exito: false, mensaje: 'No se pudo subir la foto del arreglo.' };
        }
      }

      const payload: any = {
        estado: datos.estado,
        comentario: datos.comentario?.trim() || null,
      };

      if (datos.cuadrillaId) payload.cuadrillaId = datos.cuadrillaId;
      if (datos.duplicadoDe) payload.duplicadoDe = datos.duplicadoDe.trim();
      if (urlFotoArreglo) {
        payload.fotoArregloUrl = urlFotoArreglo;
        payload.fotos = [{ url: urlFotoArreglo }];
      }

      try {
        await api.post(`/reportes/${reporteId}/cambios`, payload);
      } catch (errPost: any) {
        // Si la API usa PATCH /reportes/:id o POST /reportes/:id/estado como ruta alternativa:
        if (errPost.response?.status === 404) {
          await api.patch(`/reportes/${reporteId}`, payload);
        } else {
          throw errPost;
        }
      }

      return { exito: true, mensaje: 'Reporte actualizado correctamente.' };
    } catch (error: any) {
      const msg = error.response?.data?.error?.mensaje || 'No se pudo actualizar el estado del reporte.';
      return { exito: false, mensaje: msg };
    }
  },

  /** Sube las evidencias (1 o 2 fotos y audio) y crea el reporte en la API */
  crear: async (reporteLocal: any): Promise<{ exito: boolean; mensaje: string; codigo?: string }> => {
    try {
      // 1. Subimos la primera foto (obligatoria)
      let urlFoto1 = null;
      if (reporteLocal.fotoUri) {
        urlFoto1 = await servicioArchivos.subirAlServidor(reporteLocal.fotoUri, 'fotos');
      }
      if (!urlFoto1) {
        return { exito: false, mensaje: 'No se pudo subir la fotografía principal al servidor.' };
      }

      const arregloFotos: { url: string }[] = [{ url: urlFoto1 }];

      // 1.b Si el vecino adjuntó una segunda foto, también la subimos
      if (reporteLocal.fotoUri2) {
        const urlFoto2 = await servicioArchivos.subirAlServidor(reporteLocal.fotoUri2, 'fotos');
        if (urlFoto2) arregloFotos.push({ url: urlFoto2 });
      }

      // 2. Subimos el audio (opcional)
      let urlAudio = null;
      if (reporteLocal.audioUri && reporteLocal.audioUri !== 'archivo_simulado.m4a') {
        urlAudio = await servicioArchivos.subirAlServidor(reporteLocal.audioUri, 'audios');
      }

      const tipoIdOficial = MAPA_TIPOS[reporteLocal.tipoId] || reporteLocal.tipoId;

      let lat = Number(reporteLocal.latitud);
      let lon = Number(reporteLocal.longitud);
      const estaEnGualeguaychu = lat <= -32.90 && lat >= -33.10 && lon <= -58.40 && lon >= -58.60;
      if (!estaEnGualeguaychu) {
        lat = -33.0089;
        lon = -58.5142;
      }

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
        } catch {
          direccionFinal = `Gualeguaychú (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
        }
      }

      const payload: any = {
        tipoId: tipoIdOficial,
        descripcion: reporteLocal.descripcion || null,
        audioUrl: urlAudio,
        fotos: arregloFotos,
        coordenadas: { latitud: lat, longitud: lon },
        direccion: direccionFinal,
        creadoEn: new Date(Date.now() - 120000).toISOString()
      };

      const res = await api.post('/reportes', payload);
      const codigoGenerado = res.data?.datos?.codigo;

      return {
        exito: true,
        mensaje: 'Reporte enviado a la municipalidad',
        codigo: codigoGenerado
      };
    } catch (error: any) {
      console.error('Detalle del rechazo de POST /reportes:', error.response?.data || error);
      const mensajeError = error.response?.data?.error?.mensaje || 'Error al enviar el reporte.';
      return { exito: false, mensaje: mensajeError };
    }
  }
};