import { Platform } from 'react-native';
import { API_CONFIG } from '../config/api';

// Try to load RNFS for reading audio file
let RNFS = null;
try {
  RNFS = require('react-native-fs');
} catch (e) {
  console.log('RNFS not available');
}

console.log('🌐 API Base URL:', API_CONFIG.BASE_URL);

/**
 * Unified chat API - sends everything as JSON
 */
export const sendMessage = async ({ user_id, latitude, longitude, text, audioUri, voiceResponse = false }) => {
  const url = `${API_CONFIG.BASE_URL}/chat`;
  
  let audioBase64 = null;
  
  // If audio, read file and convert to base64
  if (audioUri && RNFS) {
    try {
      const filePath = audioUri.replace('file://', '');
      console.log('📁 Reading audio file:', filePath);
      audioBase64 = await RNFS.readFile(filePath, 'base64');
      console.log('📁 Audio size (base64):', audioBase64.length, 'chars');
    } catch (error) {
      console.error('❌ Failed to read audio file:', error);
      throw new Error('Failed to read audio file');
    }
  }
  
  const payload = {
    user_id,
    latitude,
    longitude,
    text: audioBase64 ? null : text,
    audio_base64: audioBase64,
    voice_response: voiceResponse,
  };
  
  console.log('📤 Sending to:', url);
  console.log('📤 Payload:', { ...payload, audio_base64: audioBase64 ? `[${audioBase64.length} chars]` : null });
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    console.log('📥 Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Server error:', errorText);
      throw new Error(`Server error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ Response:', data);
    return data;
  } catch (error) {
    console.error('❌ Request error:', error);
    throw error;
  }
};
