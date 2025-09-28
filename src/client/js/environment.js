/**
 * Environment Detection and Configuration
 * Automatically detects if running locally or in production
 */

// Detect environment based on hostname
const isLocal = () => {
    const hostname = window.location.hostname;
    return hostname === 'localhost' || 
           hostname === '127.0.0.1' || 
           hostname.startsWith('192.168.') ||
           hostname.startsWith('10.') ||
           hostname.endsWith('.local');
};

// API Configuration based on environment
export const API_CONFIG = {
    // Base URL - automatically switches based on environment
    BASE_URL: isLocal() ? 'http://localhost:8000' : 'https://quest-api-edz1.onrender.com',
    
    // Environment info
    IS_LOCAL: isLocal(),
    IS_PRODUCTION: !isLocal(),
    
    // Debug info
    DEBUG: {
        hostname: window.location.hostname,
        protocol: window.location.protocol,
        port: window.location.port,
        environment: isLocal() ? 'local' : 'production'
    }
};

// Log environment info in development
if (isLocal()) {
    console.log('🏠 Local Development Mode');
    console.log('📡 API Base URL:', API_CONFIG.BASE_URL);
    console.log('🔍 Environment Debug:', API_CONFIG.DEBUG);
} else {
    console.log('🚀 Production Mode');
    console.log('📡 API Base URL:', API_CONFIG.BASE_URL);
}

export default API_CONFIG;


