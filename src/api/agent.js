import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config/api';

const api = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

const getUserId = async () => {
  let id = await AsyncStorage.getItem('fuel_user_id');
  if (!id) {
    id = `user_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    await AsyncStorage.setItem('fuel_user_id', id);
  }
  return id;
};

export const sendMessage = async (text, latitude, longitude) => {
  const user_id = await getUserId();

  const response = await api.post('/chat', {
    text,
    latitude,
    longitude,
    user_id,
  });

  return response.data;
};
