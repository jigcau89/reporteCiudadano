// src/servicios/sincronizacion.ts
import * as Network from 'expo-network';
import * as Notifications from 'expo-notifications';
import { servicioDB } from './baseDeDatos';
import { servicioReportes } from './reportes';

// Configuramos la app para que muestre la alerta visual y sonora siempre
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const servicioSincronizacion = {
  
  /** 
   * Revisa si hay internet, busca reportes pendientes y los envía uno por uno.
   * Retorna la cantidad de reportes que logró subir.
   */
  procesarCola: async (): Promise<number> => {
    // 1. Verificamos el estado real del hardware de red
    const estadoRed = await Network.getNetworkStateAsync();
    
    if (!estadoRed.isConnected || !estadoRed.isInternetReachable) {
      console.log('Sin conexión a internet. La sincronización queda en pausa.');
      return 0; 
    }

    // 2. Buscamos reportes locales
    const pendientes = await servicioDB.obtenerPendientes();
    if (pendientes.length === 0) return 0;

    let subidos = 0;
    
    // 3. Intentamos subir cada reporte
    for (const reporte of pendientes) {
      // Usamos el servicio que creamos al principio para simular el envío a la API
      const respuesta = await servicioReportes.crear(reporte);
      
      if (respuesta.exito) {
        // Si el servidor lo acepta, lo marcamos como sincronizado en SQLite
        await servicioDB.marcarComoSincronizado(reporte.id);
        subidos++;

        // Disparamos la notificación local exigida por el PRD
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "✅ Reporte Sincronizado",
            body: `Tu reclamo por ${reporte.tipoId.replace('tip-', '')} que estaba pendiente de envío ha sido entregado exitosamente a la Municipalidad.`,
            sound: true,
          },
          trigger: null, // trigger null hace que se dispare inmediatamente
        });
      }
    }
    
    return subidos;
  }
};