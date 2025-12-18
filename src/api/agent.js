import axios from 'axios';
import { API_CONFIG } from '../config/api';

const api = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

export const sendMessage = async (text, latitude, longitude, user_id) => {
  const response = await api.post('/chat', {
    text,
    latitude,
    longitude,
    user_id,
  });

  return response.data;
};
