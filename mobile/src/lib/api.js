import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

// Hardcoded for production — Constants.expoConfig is unreliable in EAS builds
const API_URL = 'https://callby.vercel.app';

const api = axios.create({ baseURL: API_URL, timeout: 15000 });

// Hook axios into Reactotron in dev mode so all API calls show in the debugger
if (__DEV__ && console.tron) {
  console.tron.reportError = console.tron.reportError || (() => {});
  api.interceptors.request.use((config) => {
    console.tron.display({
      name: `→ ${config.method?.toUpperCase()} ${config.url}`,
      value: { params: config.params, data: config.data },
      important: false,
    });
    return config;
  });
  api.interceptors.response.use(
    (res) => {
      console.tron.display({
        name: `← ${res.status} ${res.config?.url}`,
        value: res.data,
        important: false,
      });
      return res;
    },
    (err) => {
      console.tron.display({
        name: `✗ ${err.response?.status || 'ERR'} ${err.config?.url}`,
        value: { message: err.message, data: err.response?.data },
        important: true,
      });
      return Promise.reject(err);
    }
  );
}

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
