// app/index.tsx
import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { servicioAuth } from '../src/servicios/auth';

export default function PantallaInicio() {
  const [modoRegistro, setModoRegistro] = useState(false);

  // Campos del formulario
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [clave, setClave] = useState('');

  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    const revisarSesion = async () => {
      try {
        const haySesion = await servicioAuth.tieneSesionGuardada();
        if (haySesion) {
          const biometriaExitosa = await servicioAuth.validarBiometria();
          if (biometriaExitosa) {
            router.replace('/(tabs)');
            return;
          }
        }
      } catch (e) {
        console.log('Error al verificar sesión inicial:', e);
      }
      setCargandoSesion(false);
    };

    revisarSesion();
  }, []);

  const manejarAccionPrincipal = async () => {
    if (!email.trim() || !clave.trim()) {
      Alert.alert('Datos incompletos', 'Por favor ingresa tu correo electrónico y contraseña.');
      return;
    }

    if (modoRegistro && !nombre.trim()) {
      Alert.alert('Falta tu nombre', 'Por favor ingresa tu nombre y apellido para registrarte.');
      return;
    }

    setProcesando(true);

    if (modoRegistro) {
      const resultado = await servicioAuth.registrar(nombre, email, clave, telefono);
      setProcesando(false);

      if (resultado.exito) {
        Alert.alert('¡Bienvenido/a!', 'Tu cuenta de vecino fue creada con éxito.');
        router.replace('/(tabs)');
      } else {
        Alert.alert('No se pudo registrar', resultado.error || 'Verifica los datos ingresados.');
      }
    } else {
      const resultado = await servicioAuth.iniciarSesion(email, clave);
      setProcesando(false);

      if (resultado.exito) {
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error de ingreso', resultado.error || 'Correo o contraseña incorrectos.');
      }
    }
  };

  if (cargandoSesion) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color="#007BFF" />
        <Text style={styles.textoCarga}>Verificando seguridad...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex1}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <Text style={styles.titulo}>Reporte Ciudadano</Text>
          <Text style={styles.subtitulo}>Municipalidad de Gualeguaychú</Text>

          {/* Selector de modo: Ingresar vs. Crear Cuenta */}
          <View style={styles.selectorModo}>
            <TouchableOpacity
              style={[styles.tabModo, !modoRegistro && styles.tabModoActivo]}
              onPress={() => setModoRegistro(false)}
              disabled={procesando}
            >
              <Text style={[styles.textoTabModo, !modoRegistro && styles.textoTabModoActivo]}>
                Ingresar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabModo, modoRegistro && styles.tabModoActivo]}
              onPress={() => setModoRegistro(true)}
              disabled={procesando}
            >
              <Text style={[styles.textoTabModo, modoRegistro && styles.textoTabModoActivo]}>
                Crear Cuenta
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formulario}>
            {modoRegistro && (
              <>
                <Text style={styles.label}>Nombre y Apellido *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: Norma Pereyra"
                  value={nombre}
                  onChangeText={setNombre}
                  editable={!procesando}
                />

                <Text style={styles.label}>Teléfono (opcional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: 3446-412233"
                  keyboardType="phone-pad"
                  value={telefono}
                  onChangeText={setTelefono}
                  editable={!procesando}
                />
              </>
            )}

            <Text style={styles.label}>Correo electrónico *</Text>
            <TextInput
              style={styles.input}
              placeholder="ejemplo@correo.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              editable={!procesando}
            />

            <Text style={styles.label}>Contraseña *</Text>
            <TextInput
              style={styles.input}
              placeholder="Mínimo 6 caracteres"
              secureTextEntry={true}
              value={clave}
              onChangeText={setClave}
              editable={!procesando}
            />

            <TouchableOpacity
              style={[styles.boton, procesando && styles.botonDesactivado]}
              onPress={manejarAccionPrincipal}
              disabled={procesando}
            >
              {procesando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.textoBoton}>
                  {modoRegistro ? 'REGISTRARME COMO VECINO' : 'INGRESAR'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.botonAlternarInferior}
              onPress={() => setModoRegistro(!modoRegistro)}
              disabled={procesando}
            >
              <Text style={styles.textoAlternarInferior}>
                {modoRegistro
                  ? '¿Ya tenés cuenta? Tocá acá para ingresar'
                  : '¿Sos vecino nuevo? Tocá acá para crear tu cuenta'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f5f5' },
  flex1: { flex: 1 },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  textoCarga: { marginTop: 15, fontSize: 16, color: '#555' },
  titulo: { fontSize: 28, fontWeight: 'bold', color: '#222', textAlign: 'center' },
  subtitulo: { fontSize: 16, color: '#666', marginBottom: 25, textAlign: 'center' },
  selectorModo: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#e9ecef',
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  tabModo: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  tabModoActivo: { backgroundColor: '#007BFF' },
  textoTabModo: { fontSize: 16, fontWeight: '600', color: '#495057' },
  textoTabModoActivo: { color: '#fff', fontWeight: 'bold' },
  formulario: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
  },
  label: { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 6 },
  input: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ced4da',
  },
  boton: {
    backgroundColor: '#007BFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 55,
    justifyContent: 'center',
    marginTop: 6,
  },
  botonDesactivado: { backgroundColor: '#a0c4ff' },
  textoBoton: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  botonAlternarInferior: { marginTop: 18, paddingVertical: 10, alignItems: 'center' },
  textoAlternarInferior: { color: '#007BFF', fontSize: 15, fontWeight: '600', textAlign: 'center' },
});