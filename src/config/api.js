import { Platform } from 'react-native';

/**
 * API Configuration
 * 
 * IMPORTANT: For physical device testing, update YOUR_IP below!
 * 
 * Find your IP:
 *   Mac: ifconfig | grep "inet " | grep -v 127.0.0.1
 *   Windows: ipconfig
 *   Linux: hostname -I
 */

// ⚠️ CHANGE THIS to your computer's local IP address
const YOUR_IP = '192.168.10.163';  // <-- UPDATE THIS!

const getBaseURL = () => {
    if (Platform.OS === 'android') {
        // Android Emulator uses 10.0.2.2 to reach host machine
        // Physical device needs actual IP
        return __DEV__ ? `http://${YOUR_IP}:8000` : 'https://your-production-url.com';
    } else {
        // iOS Simulator can use localhost
        // Physical device needs actual IP
        return __DEV__ ? `http://${YOUR_IP}:8000` : 'https://your-production-url.com';
    }
};

export const API_CONFIG = {
    BASE_URL: getBaseURL(),
    TIMEOUT: 30000,
};

export default API_CONFIG;
