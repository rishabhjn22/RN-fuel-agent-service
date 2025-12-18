import { Platform } from 'react-native';

/**
 * API Configuration
 * 
 * For Android Emulator: use 'http://10.0.2.2:8000'
 * For iOS Simulator: use 'http://localhost:8000'
 * For Physical Device: use your computer's IP address (e.g., 'http://192.168.1.100:8000')
 * 
 * To find your IP on Mac: ifconfig | grep "inet " | grep -v 127.0.0.1
 * To find your IP on Windows: ipconfig
 * To find your IP on Linux: hostname -I
 */

// Change this to your computer's IP address when testing on physical device
const DEVICE_IP = '192.168.1.100'; // Replace with your actual IP

// Development URLs
const ANDROID_EMULATOR_URL = 'http://10.0.2.2:8000';
const IOS_SIMULATOR_URL = 'http://localhost:8000';
const PHYSICAL_DEVICE_URL = `http://${DEVICE_IP}:8000`;

// Production URL (update when deploying)
const PRODUCTION_URL = 'https://your-api-domain.com';

// Determine which URL to use
const getBaseURL = () => {
    // Check if we're in production
    if (__DEV__ === false) {
        return PRODUCTION_URL;
    }

    // For development, use platform-specific URLs
    if (Platform.OS === 'android') {
        // You can set this to PHYSICAL_DEVICE_URL if testing on real device
        return ANDROID_EMULATOR_URL;
    } else {
        // iOS
        return IOS_SIMULATOR_URL;
    }
};

export const API_CONFIG = {
    BASE_URL: getBaseURL(),
    TIMEOUT: 30000, // 30 seconds
    ENDPOINTS: {
        CHAT: '/chat',
        HEALTH: '/health',
    },
};

export default API_CONFIG;

