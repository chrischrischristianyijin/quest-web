// Quest API Configuration
// 更新这个文件来配置你的Quest API端点

const QUEST_CONFIG = {
    // Quest API 基础URL - 请替换为你的实际API地址
    API_BASE: 'https://your-quest-api.com',
    
    // API 端点
    ENDPOINTS: {
        CHAT: '/api/v1/chat',
        HEALTH: '/api/v1/chat/health'
    },
    
    // 请求配置
    REQUEST_CONFIG: {
        TIMEOUT: 30000, // 30秒超时
        RETRY_ATTEMPTS: 3, // 重试次数
        RETRY_DELAY: 1000 // 重试延迟（毫秒）
    },
    
    // 流式响应配置
    STREAM_CONFIG: {
        BUFFER_SIZE: 1024, // 缓冲区大小
        CHUNK_TIMEOUT: 5000 // 块超时时间
    }
};

// 获取完整的API URL
function getQuestAPIUrl(endpoint) {
    return `${QUEST_CONFIG.API_BASE}${QUEST_CONFIG.ENDPOINTS[endpoint]}`;
}

// 获取用户认证token
function getQuestToken() {
    // 尝试从localStorage获取
    const token = localStorage.getItem('quest_token');
    if (token) return token;
    
    // 尝试从sessionStorage获取
    return sessionStorage.getItem('quest_token');
}

// 设置用户认证token
function setQuestToken(token, persistent = true) {
    if (persistent) {
        localStorage.setItem('quest_token', token);
    } else {
        sessionStorage.setItem('quest_token', token);
    }
}

// 清除用户认证token
function clearQuestToken() {
    localStorage.removeItem('quest_token');
    sessionStorage.removeItem('quest_token');
}

// 检查API配置是否正确
function validateQuestConfig() {
    const issues = [];
    
    if (!QUEST_CONFIG.API_BASE || QUEST_CONFIG.API_BASE === 'https://your-quest-api.com') {
        issues.push('API_BASE 未配置或仍为默认值');
    }
    
    if (!QUEST_CONFIG.API_BASE.startsWith('http')) {
        issues.push('API_BASE 必须是有效的URL（以http://或https://开头）');
    }
    
    return {
        isValid: issues.length === 0,
        issues: issues
    };
}

// 导出配置（如果在模块环境中）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        QUEST_CONFIG,
        getQuestAPIUrl,
        getQuestToken,
        setQuestToken,
        clearQuestToken,
        validateQuestConfig
    };
}
