// src/mocks/index.ts
import { Reporte, TipoDeReporte, Usuario, Zona, Cuadrilla } from '../tipos';

export const mockTiposDeReporte: TipoDeReporte[] = [
  { id: "tip-bache", nombre: "Bache", icono: "warning-outline", color: "#C1440E", areaResponsable: "Obras Públicas" },
  { id: "tip-luminaria", nombre: "Luminaria", icono: "bulb-outline", color: "#FFD700", areaResponsable: "Electrotecnia" }
];

export const mockUsuarios: Usuario[] = [
  { id: "usr-084", nombre: "Norma Pereyra", email: "norma@mail.com", telefono: "3446-412233", rol: "vecino", zonaId: null, avisosActivos: true, creadoEn: "2026-08-30T19:10:00-03:00" },
  { id: "usr-003", nombre: "Operador Centro", email: "operador@gchu.gob.ar", telefono: null, rol: "operador", zonaId: "zon-centro", avisosActivos: false, creadoEn: "2025-01-10T08:00:00-03:00" }
];

export const mockReportes: Reporte[] = [
  // Caso ideal del PRD
  {
    id: "rep-00412",
    codigo: "GCHU-2026-00412",
    tipoId: "tip-bache",
    descripcion: "Pozo grande en la mano hacia el centro, pasa el agua.",
    audioUrl: null,
    fotos: [{ id: "fot-901", url: "https://api.gchu.gob.ar/f/901.jpg", momento: "problema" }],
    coordenadas: { latitud: -33.0089, longitud: -58.5142 },
    direccion: "Rocamora 1240",
    zonaId: "zon-norte",
    estado: "asignado",
    autorId: "usr-084",
    cuadrillaId: "cua-02",
    duplicadoDe: null,
    adhesiones: 3,
    creadoEn: "2026-09-14T10:22:00-03:00",
    sincronizado: true
  },
  // "Caso feo": Rechazado, sin sincronizar (sin conexión), sin audio y con motivo largo
  {
    id: "rep-00413",
    codigo: "GCHU-2026-00413",
    tipoId: "tip-luminaria",
    descripcion: null, // El vecino no escribió nada, solo mandó foto
    audioUrl: null,
    fotos: [{ id: "fot-902", url: "file:///data/user/0/app/cache/foto_temp.jpg", momento: "problema" }],
    coordenadas: { latitud: -33.0150, longitud: -58.5200 },
    direccion: "Urquiza al 1200",
    zonaId: "zon-centro",
    estado: "rechazado",
    autorId: "usr-084",
    cuadrillaId: null,
    duplicadoDe: null,
    adhesiones: 0,
    creadoEn: "2026-09-16T15:30:00-03:00",
    sincronizado: false // Importante: Simula que está en la cola del teléfono
  }
];