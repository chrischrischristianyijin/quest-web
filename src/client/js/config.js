// Quest 应用配置
export const CONFIG = {
    // API 配置
    API_BASE_URL: 'https://quest-api-edz1.onrender.com',
    API_VERSION: 'v1',
    
    // 应用配置
    APP_NAME: 'Quest',
    APP_DESCRIPTION: 'Curate your world',
    
    // 功能开关
    FEATURES: {
        GOOGLE_AUTH: true,
        TAGS: true,
        SHARING: true
    }
};

// API 端点
export const API_ENDPOINTS = {
    AUTH: {
        REGISTER: '/api/v1/auth/register',
        LOGIN: '/api/v1/auth/login',
        LOGOUT: '/api/v1/auth/logout',
        GOOGLE: '/api/v1/auth/google/login'
    },
    USER: {
        PROFILE: '/api/v1/user/profile',
        FOLLOW: '/api/v1/user/follow'
    },
    INSIGHTS: {
        LIST: '/api/v1/insights',
        CREATE: '/api/v1/insights',
        UPDATE: (id) => `/api/v1/insights/${id}`,
        DELETE: (id) => `/api/v1/insights/${id}`
    },
    TAGS: {
        LIST: '/api/v1/user-tags',
        CREATE: '/api/v1/user-tags',
        DELETE: (id) => `/api/v1/user-tags/${id}`
    },
    METADATA: '/api/v1/metadata'
};
