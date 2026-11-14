// src/api/cliente.ts
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor: Adjunta el token guardado en SecureStore antes de cada petición
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('token_sesion_ciudadano');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});