// src/servicios/baseDeDatos.ts
import * as SQLite from 'expo-sqlite';

const NOMBRE_DB = 'reportes_ciudadano.db';

// Guardamos una única promesa de conexión para evitar colisiones (NullPointerException) en Android
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const obtenerDB = (): Promise<SQLite.SQLiteDatabase> => {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(NOMBRE_DB);
  }
  return dbPromise;
};

export const servicioDB = {
  /** Crea la estructura de la base de datos de forma segura */
  inicializar: async () => {
    try {
      const db = await obtenerDB();
      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS cola_reportes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          codigoTemporal TEXT NOT NULL,
          tipoId TEXT NOT NULL,
          descripcion TEXT,
          fotoUri TEXT,
          fotoUri2 TEXT,
          audioUri TEXT,
          latitud REAL,
          longitud REAL,
          direccion TEXT,
          fechaHora TEXT NOT NULL,
          sincronizado INTEGER DEFAULT 0
        );
      `);

      // Verificamos limpiamente con PRAGMA si la tabla vieja ya tenía 'direccion' y 'fotoUri2'
      const columnas = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(cola_reportes);`);
      
      const tieneDireccion = columnas.some((col) => col.name === 'direccion');
      if (!tieneDireccion) {
        await db.runAsync(`ALTER TABLE cola_reportes ADD COLUMN direccion TEXT;`);
      }

      const tieneFoto2 = columnas.some((col) => col.name === 'fotoUri2');
      if (!tieneFoto2) {
        await db.runAsync(`ALTER TABLE cola_reportes ADD COLUMN fotoUri2 TEXT;`);
      }

      console.log('Base de datos local inicializada.');
    } catch (error) {
      console.error('Error al crear la tabla SQLite:', error);
    }
  },

  /** Guarda un reporte en el almacenamiento local */
  encolarReporte: async (datos: {
    tipoId: string;
    descripcion: string;
    fotoUri: string | null;
    fotoUri2?: string | null;
    audioUri: string | null;
    latitud: number;
    longitud: number;
    direccion?: string;
  }): Promise<number> => {
    const db = await obtenerDB();
    const codigoTemporal = `LOCAL-${Date.now()}`;
    const fechaActual = new Date().toISOString();

    const resultado = await db.runAsync(
      `INSERT INTO cola_reportes (codigoTemporal, tipoId, descripcion, fotoUri, fotoUri2, audioUri, latitud, longitud, direccion, fechaHora) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        codigoTemporal,
        datos.tipoId,
        datos.descripcion,
        datos.fotoUri,
        datos.fotoUri2 || null,
        datos.audioUri,
        datos.latitud,
        datos.longitud,
        datos.direccion || `Coord: ${datos.latitud.toFixed(4)}, ${datos.longitud.toFixed(4)}`,
        fechaActual
      ]
    );

    return resultado.lastInsertRowId;
  },

  /** Recupera todos los reportes que aún no se han subido al servidor */
  obtenerPendientes: async (): Promise<any[]> => {
    try {
      const db = await obtenerDB();
      return await db.getAllAsync('SELECT * FROM cola_reportes WHERE sincronizado = 0');
    } catch (error) {
      console.error('Error al leer pendientes de SQLite:', error);
      return [];
    }
  },

  /** Marca un reporte local como enviado */
  marcarComoSincronizado: async (id: number) => {
    const db = await obtenerDB();
    await db.runAsync('UPDATE cola_reportes SET sincronizado = 1 WHERE id = ?', [id]);
  }
};