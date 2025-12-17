import axios from 'axios';
import { Platform } from 'react-native';

// Use 10.0.2.2 for Android Emulator, localhost for iOS Simulator
const BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';

const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'multipart/form-data',
    },
});

export const sendMessage = async (text, latitude = 0, longitude = 0, userId = 'user_123') => {
    try {
        const formData = new FormData();
        formData.append('text', text);
        formData.append('latitude', String(latitude));
        formData.append('longitude', String(longitude));
        formData.append('user_id', userId);

        console.log('Sending message to:', `${BASE_URL}/chat`, formData);

        const response = await api.post('/chat', formData);
        return response.data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};
