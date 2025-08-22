// Quest 应用配置
export const CONFIG = {
    // API 配置 - 使用原始后端地址
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
        REGISTER: '/api/v1/auth/signup',
        LOGIN: '/api/v1/auth/login',
        LOGOUT: '/api/v1/auth/signout',
        GOOGLE: '/api/v1/auth/google/login',
        PROFILE: '/api/v1/auth/profile'
    },
    USER: {
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
        GET: (id) => `/api/v1/user-tags/${id}`,
        UPDATE: (id) => `/api/v1/user-tags/${id}`,
        DELETE: (id) => `/api/v1/user-tags/${id}`
    },
    METADATA: {
        EXTRACT: '/api/v1/metadata/extract',
        BATCH_EXTRACT: '/api/v1/metadata/batch-extract',
        CREATE_INSIGHT: '/api/v1/metadata/create-insight',
        PREVIEW: (id) => `/api/v1/metadata/preview/${id}`
    }
};

// Metadata相关API
const METADATA = {
    EXTRACT: '/api/v1/metadata/extract',
    PREVIEW: '/api/v1/metadata/preview',
    CREATE_INSIGHT: '/api/v1/metadata/create-insight',
    BATCH_EXTRACT: '/api/v1/metadata/batch-extract'
};
