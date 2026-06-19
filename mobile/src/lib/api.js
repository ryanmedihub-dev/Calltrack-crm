import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

// Hardcoded for production — Constants.expoConfig is unreliable in EAS builds
const API_URL = 'https://callby.vercel.app';

const api = axios.create({ baseURL: API_URL, timeout: 15000 });

let _logoutCallback = null;
export function setLogoutCallback(fn) { _logoutCallback = fn; }

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await AsyncStorage.multiRemove(['token', 'user']);
      Alert.alert('Session Expired', 'Please log in again.', [{ text: 'OK' }]);
      _logoutCallback?.();
    }
    return Promise.reject(err);
  }
);

export default api;
