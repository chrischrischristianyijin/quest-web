// Quest 应用配置
export const CONFIG = {
    // API 配置 - 直接使用后端地址
    API_BASE_URL: 'https://quest-api-edz1.onrender.com',
    API_VERSION: 'v1',
    
    // 应用配置
    APP_NAME: 'Quest',
    APP_DESCRIPTION: 'Curate your world',
    
    // 功能开关
    FEATURES: {
        GOOGLE_AUTH: true,
        USER_TAGS: true,
        SHARING: true
    }
};

// API配置
export const API_CONFIG = {
    // 基础URL
    API_BASE_URL: 'https://quest-api-edz1.onrender.com',
    
    // 认证相关接口
    AUTH: {
        REGISTER: '/api/v1/auth/signup',
        LOGIN: '/api/v1/auth/login',
        LOGOUT: '/api/v1/auth/signout',
        PROFILE: '/api/v1/auth/profile',
        FORGOT_PASSWORD: '/api/v1/auth/forgot-password'
    },
    
    // 用户管理接口
    USER: {
        PROFILE: '/api/v1/user/profile',
        UPLOAD_AVATAR: '/api/v1/user/upload-avatar'
    },
    
    // 元数据相关接口
    METADATA: {
        EXTRACT: '/api/v1/metadata/extract',
        CREATE_INSIGHT: '/api/v1/metadata/create-insight'
    },
    
    // 见解管理接口
    INSIGHTS: {
        LIST: '/api/v1/insights/',
        ALL: '/api/v1/insights/all/',
        GET: '/api/v1/insights',
        CREATE: '/api/v1/insights/',
        UPDATE: '/api/v1/insights',
        DELETE: '/api/v1/insights'
    },
    
    // 标签管理接口
    USER_TAGS: {
        LIST: '/api/v1/user-tags/',
        GET: '/api/v1/user-tags',
        CREATE: '/api/v1/user-tags/',
        UPDATE: '/api/v1/user-tags',
        DELETE: '/api/v1/user-tags',
        SEARCH: '/api/v1/user-tags/search/'
    },
    
    // 堆叠管理接口
    STACKS: {
        LIST: '/api/v1/stacks/',
        GET: '/api/v1/stacks',
        CREATE: '/api/v1/stacks/',
        UPDATE: '/api/v1/stacks',
        DELETE: '/api/v1/stacks',
        ITEMS: '/api/v1/stacks/items/'
    },
    
    // 等待列表接口
    WAITLIST: {
        JOIN: '/api/v1/waitlist/join',
        UNSUBSCRIBE: '/api/v1/waitlist/unsubscribe',
        STATS: '/api/v1/waitlist/stats',
        LIST: '/api/v1/waitlist/list'
    },
    
    // 系统接口
    SYSTEM: {
        HEALTH: '/health',
        INFO: '/'
    },
    
    // AI聊天接口
    CHAT: {
        CHAT: '/api/v1/chat',
        HEALTH: '/api/v1/chat/health'
    }
};
