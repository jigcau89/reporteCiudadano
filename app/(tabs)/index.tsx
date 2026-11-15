// app/(tabs)/index.tsx
import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity,
  Alert, RefreshControl, Switch, ScrollView, Modal, Linking
} from 'react-native';
import { router, useFocusEffect, useNavigation } from 'expo-router';
//import { CommonActions } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Notifications from 'expo-notifications';
import { servicioReportes, NOMBRES_TIPOS } from '../../src/servicios/reportes';
import { servicioSincronizacion } from '../../src/servicios/sincronizacion';
import { servicioAuth } from '../../src/servicios/auth';
import { Reporte, Usuario, Zona, Cuadrilla } from '../../src/tipos';

export default function BandejaReportes() {
  const navigation = useNavigation();
  const [permisoCamara, pedirPermisoCamara] = useCameraPermissions();

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  // Filtros exclusivos del Operador (Área 4 y 6 del PRD)
  const [filtroEstado, setFiltroEstado] = useState<string>('');
  const [filtroTipo, setFiltroTipo] = useState<string>('');
  const [filtroZona, setFiltroZona] = useState<string>('');

  // Catálogo de Zonas y Cuadrillas + Escáner QR para el mostrador
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [cuadrillas, setCuadrillas] = useState<Cuadrilla[]>([]);
  const [modalCuadrillas, setModalCuadrillas] = useState(false);
  const [modalEscanerQR, setModalEscanerQR] = useState(false);
  const escaneandoRef = useRef(false);

  // Memoria de estados previos para disparar avisos reales al vecino (Área 5)
  const memoriaEstadosRef = useRef<Record<string, { estado: string; adhesiones: number }>>({});

  const cargarDatosYSincronizar = async () => {
    setCargando(true);
    const perfil = await servicioAuth.obtenerPerfilRemoto();
    setUsuario(perfil);

    // 1. Sincronizamos la cola offline en bloque aislado
    try {
      const reportesSubidos = await servicioSincronizacion.procesarCola();
      if (reportesSubidos > 0) {
        Alert.alert('Sincronización Exitosa', `Se enviaron ${reportesSubidos} reportes pendientes.`);
      }
    } catch {}

    // 2. Cargamos reportes según el ROL del usuario (Vecino vs. Operador)
    try {
      if (perfil?.rol === 'operador') {
        const [listaOp, zList, cList] = await Promise.all([
          servicioReportes.obtenerPublicos({
            estado: filtroEstado || undefined,
            tipoId: filtroTipo || undefined,
            zonaId: filtroZona || undefined,
          }),
          servicioReportes.obtenerZonas(),
          servicioReportes.obtenerCuadrillas(),
        ]);
        setReportes(listaOp);
        setZonas(zList);
        setCuadrillas(cList);
      } else {
        const respuesta = await servicioReportes.obtenerTodos();
        const nuevosReportes = respuesta.datos || [];

        // Área 5: Avisos al vecino cuando cambia el estado o alguien se suma a su reporte
        if (perfil?.avisosActivos !== false) {
          for (const r of nuevosReportes) {
            const previo = memoriaEstadosRef.current[r.id];
            if (previo) {
              if (previo.estado !== r.estado) {
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: `🔔 Cambio de estado en ${r.codigo}`,
                    body: `Tu reporte en ${r.direccion} pasó a estado: ${r.estado.replace('_', ' ').toUpperCase()}.`,
                  },
                  trigger: null,
                });
              } else if (r.adhesiones > previo.adhesiones) {
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: `👥 Nuevo vecino se sumó a ${r.codigo}`,
                    body: `Ahora son ${r.adhesiones} vecinos reclamando por ${r.direccion}.`,
                  },
                  trigger: null,
                });
              }
            }
            memoriaEstadosRef.current[r.id] = { estado: r.estado, adhesiones: r.adhesiones };
          }
        }

        setReportes(nuevosReportes);
      }
    } catch {
      console.log('Modo offline al actualizar bandeja.');
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      cargarDatosYSincronizar();
    }, [filtroEstado, filtroTipo, filtroZona])
  );

  const toggleAvisos = async (valor: boolean) => {
    const actualizado = await servicioAuth.cambiarAvisosActivos(valor);
    if (actualizado) setUsuario(actualizado);
  };

  // CORRECCIÓN 1: Salir desmonta el grupo (tabs) y reinicia el Stack raíz en app/index.tsx
const cerrarSesion = async () => {
    await servicioAuth.cerrarSesion();
    const rootNav: any = navigation.getParent();
    if (rootNav && typeof rootNav.reset === 'function') {
      rootNav.reset({
        index: 0,
        routes: [{ name: 'index' }],
      });
    } else {
      router.replace('/');
    }
  };

  // CORRECCIÓN 2: Pedir permiso de cámara antes de abrir el lector de QR
  const abrirEscanerQR = async () => {
    escaneandoRef.current = false;

    if (!permisoCamara?.granted) {
      const resultado = await pedirPermisoCamara();
      if (!resultado.granted) {
        Alert.alert(
          'Permiso de cámara requerido',
          'Para escanear el código QR del vecino en el mostrador necesitamos acceso a la cámara.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Abrir Configuración', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }
    }

    setModalEscanerQR(true);
  };

  const alEscanearQR = ({ data }: { data: string }) => {
    if (escaneandoRef.current) return;
    escaneandoRef.current = true;
    setModalEscanerQR(false);
    const limpio = data.replace('reporte:', '').trim();
    router.push(`/detalle/${limpio}`);
  };

  const renderItem = ({ item }: { item: Reporte }) => (
    <TouchableOpacity
      style={styles.tarjeta}
      onPress={() => router.push(`/detalle/${item.id}`)}
    >
      <View style={styles.filaSuperiorTarjeta}>
        <Text style={styles.estado}>{item.estado.replace('_', ' ').toUpperCase()}</Text>
        <Text style={styles.zonaBadge}>{item.zonaId?.replace('zon-', 'Zona ').toUpperCase()}</Text>
      </View>
      <Text style={styles.direccion}>
        {NOMBRES_TIPOS[item.tipoId] || item.tipoId} — {item.direccion}
      </Text>
      <View style={styles.filaInferiorTarjeta}>
        <Text style={styles.codigo}>Código: {item.codigo}</Text>
        <Text style={styles.adhesiones}>👥 +{item.adhesiones}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* CABECERA CON ROL, PREFERENCIA DE AVISOS Y ACCIONES DE OPERADOR */}
      <View style={styles.cabecera}>
        <View style={{ flex: 1 }}>
          <Text style={styles.tituloCabecera}>
            {usuario?.rol === 'operador' ? '🛠️ Bandeja del Operador' : '📋 Mis Reportes'}
          </Text>
          <Text style={styles.subtituloCabecera}>
            {usuario ? `${usuario.nombre} (${usuario.rol})` : 'Sesión activa'}
          </Text>
        </View>

        {usuario?.rol === 'operador' ? (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity style={styles.botonHeader} onPress={abrirEscanerQR}>
              <Text style={styles.textoBotonHeader}>📷 Leer QR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.botonHeader} onPress={() => setModalCuadrillas(true)}>
              <Text style={styles.textoBotonHeader}>👷 Cuadrillas</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cajaSwitchAvisos}>
            <Text style={styles.textoSwitch}>Avisos</Text>
            <Switch
              value={usuario?.avisosActivos ?? true}
              onValueChange={toggleAvisos}
              trackColor={{ false: '#ccc', true: '#80bdff' }}
              thumbColor={usuario?.avisosActivos !== false ? '#007BFF' : '#f4f3f4'}
            />
          </View>
        )}

        <TouchableOpacity onPress={cerrarSesion} style={styles.botonSalir}>
          <Text style={styles.textoSalir}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* BARRA TRIPLE DE FILTROS EXCLUSIVA DEL OPERADOR (Estado, Tipo y Zona) */}
      {usuario?.rol === 'operador' && (
        <View style={styles.panelFiltrosOperador}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 5 }}>
            {['', 'recibido', 'en_revision', 'asignado', 'resuelto', 'rechazado'].map((est) => (
              <TouchableOpacity
                key={est}
                style={[styles.chip, filtroEstado === est && styles.chipActivo]}
                onPress={() => setFiltroEstado(est)}
              >
                <Text style={[styles.textoChip, filtroEstado === est && styles.textoChipActivo]}>
                  {est === '' ? 'Estado: Todos' : est.replace('_', ' ').toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 5 }}>
            {['', 'zon-norte', 'zon-sur', 'zon-centro', 'zon-oeste'].map((z) => (
              <TouchableOpacity
                key={z}
                style={[styles.chip, filtroZona === z && styles.chipActivo]}
                onPress={() => setFiltroZona(z)}
              >
                <Text style={[styles.textoChip, filtroZona === z && styles.textoChipActivo]}>
                  {z === '' ? 'Zona: Todas' : z.replace('zon-', 'Zona ').toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['', 'tip-bache', 'tip-luminaria', 'tip-basura', 'tip-rama', 'tip-agua', 'tip-semaforo', 'tip-vereda', 'tip-otro'].map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, filtroTipo === t && styles.chipActivo]}
                onPress={() => setFiltroTipo(t)}
              >
                <Text style={[styles.textoChip, filtroTipo === t && styles.textoChipActivo]}>
                  {t === '' ? 'Tipo: Todos' : NOMBRES_TIPOS[t] || t}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {cargando && !refrescando ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" color="#007BFF" />
          <Text style={styles.textoCarga}>Actualizando bandeja...</Text>
        </View>
      ) : (
        <FlatList
          data={reportes}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.lista}
          refreshControl={
            <RefreshControl
              refreshing={refrescando}
              onRefresh={() => {
                setRefrescando(true);
                cargarDatosYSincronizar();
              }}
              colors={['#007BFF']}
            />
          }
          ListEmptyComponent={
            <View style={styles.centro}>
              <Text style={{ color: '#666' }}>No hay reportes para mostrar con estos filtros.</Text>
            </View>
          }
        />
      )}

      {/* MODAL DE ZONAS Y CUADRILLAS (Área 6 del PRD) */}
      <Modal visible={modalCuadrillas} animationType="slide" transparent>
        <View style={styles.fondoModal}>
          <View style={styles.cajaModal}>
            <Text style={styles.tituloModal}>Zonas y Cuadrillas Municipales</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {zonas.map((z) => (
                <View key={z.id} style={styles.bloqueZona}>
                  <Text style={styles.nombreZona}>📍 {z.nombre} (Ref: {z.referente})</Text>
                  {cuadrillas
                    .filter((c) => c.zonaId === z.id)
                    .map((c) => (
                      <Text key={c.id} style={styles.itemCuadrilla}>
                        • {c.nombre} — Especialidad: {c.especialidad} ({c.activa ? 'Activa' : 'Inactiva'})
                      </Text>
                    ))}
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.botonCerrarModal} onPress={() => setModalCuadrillas(false)}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL LECTOR DE QR PARA VENTANILLA (Área 2 y 4 del PRD) */}
      <Modal visible={modalEscanerQR} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={alEscanearQR}
          />
          <View style={{ padding: 20, backgroundColor: '#fff' }}>
            <Text style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: 10 }}>
              Apuntá al código QR del vecino para abrir su reclamo
            </Text>
            <TouchableOpacity style={styles.botonCerrarModal} onPress={() => setModalEscanerQR(false)}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  cabecera: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 15, paddingTop: 45, paddingBottom: 12, borderBottomWidth: 1, borderColor: '#e0e0e0' },
  tituloCabecera: { fontSize: 18, fontWeight: 'bold', color: '#222' },
  subtituloCabecera: { fontSize: 12, color: '#666' },
  cajaSwitchAvisos: { flexDirection: 'row', alignItems: 'center' },
  textoSwitch: { fontSize: 13, marginRight: 4, color: '#333' },
  botonHeader: { backgroundColor: '#007BFF', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
  textoBotonHeader: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  botonSalir: { marginLeft: 10, paddingVertical: 6, paddingHorizontal: 8 },
  textoSalir: { color: '#dc3545', fontWeight: 'bold', fontSize: 13 },
  panelFiltrosOperador: { backgroundColor: '#fff', padding: 10, borderBottomWidth: 1, borderColor: '#ddd' },
  chip: { backgroundColor: '#e9ecef', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 14, marginRight: 6 },
  chipActivo: { backgroundColor: '#007BFF' },
  textoChip: { fontSize: 12, color: '#333' },
  textoChipActivo: { color: '#fff', fontWeight: 'bold' },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  textoCarga: { marginTop: 10, color: '#666' },
  lista: { padding: 15, flexGrow: 1 },
  tarjeta: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 12, elevation: 2 },
  filaSuperiorTarjeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  estado: { fontSize: 12, fontWeight: 'bold', color: '#007BFF' },
  zonaBadge: { fontSize: 11, fontWeight: 'bold', color: '#555', backgroundColor: '#eee', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  direccion: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 6 },
  filaInferiorTarjeta: { flexDirection: 'row', justifyContent: 'space-between' },
  codigo: { fontSize: 12, color: '#777' },
  adhesiones: { fontSize: 12, fontWeight: 'bold', color: '#28a745' },
  fondoModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  cajaModal: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  tituloModal: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#222' },
  bloqueZona: { marginBottom: 14, paddingBottom: 10, borderBottomWidth: 1, borderColor: '#eee' },
  nombreZona: { fontSize: 15, fontWeight: 'bold', color: '#007BFF', marginBottom: 4 },
  itemCuadrilla: { fontSize: 13, color: '#444', marginLeft: 8, marginTop: 2 },
  botonCerrarModal: { backgroundColor: '#007BFF', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 }
});