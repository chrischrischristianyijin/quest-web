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
    if (token && isTokenValid(token)) return token;
    
    // 尝试从sessionStorage获取
    const sessionToken = sessionStorage.getItem('quest_token');
    if (sessionToken && isTokenValid(sessionToken)) return sessionToken;
    
    // 如果token无效，清理存储
    if (token) {
        console.warn('Stored token is invalid or expired, clearing...');
        clearQuestToken();
    }
    
    return null;
}

// 验证token是否有效（简单检查）
function isTokenValid(token) {
    if (!token || typeof token !== 'string') return false;
    
    try {
        // 检查token格式（JWT应该有三个部分，用.分隔）
        const parts = token.split('.');
        if (parts.length !== 3) return false;
        
        // 解析payload部分检查过期时间
        const payload = JSON.parse(atob(parts[1]));
        const currentTime = Math.floor(Date.now() / 1000);
        
        // 检查token是否过期（留5分钟缓冲时间）
        if (payload.exp && payload.exp < (currentTime + 300)) {
            console.warn('Token will expire soon or has expired');
            return false;
        }
        
        return true;
    } catch (error) {
        console.warn('Token validation error:', error);
        return false;
    }
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

// 处理API错误响应
async function handleAPIError(response, error) {
    let errorMessage = 'Unknown error occurred';
    let shouldRetry = false;
    
    try {
        if (response) {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || `HTTP ${response.status}`;
            
            // 检查是否是认证错误
            if (response.status === 401 || response.status === 403) {
                console.warn('Authentication error detected, clearing token');
                clearQuestToken();
                errorMessage = 'Authentication expired. Please log in again.';
            } else if (response.status >= 500) {
                shouldRetry = true;
                errorMessage = 'Server error. Please try again later.';
            }
        } else {
            errorMessage = error.message || 'Network error';
            shouldRetry = true;
        }
    } catch (parseError) {
        console.warn('Failed to parse error response:', parseError);
        if (response) {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
    }
    
    return { message: errorMessage, shouldRetry };
}

// 带重试的API请求
async function questAPIRequest(url, options = {}, retryCount = 0) {
    const maxRetries = QUEST_CONFIG.REQUEST_CONFIG.RETRY_ATTEMPTS;
    const retryDelay = QUEST_CONFIG.REQUEST_CONFIG.RETRY_DELAY;
    
    try {
        const response = await fetch(url, {
            ...options,
            timeout: QUEST_CONFIG.REQUEST_CONFIG.TIMEOUT
        });
        
        if (!response.ok) {
            const errorInfo = await handleAPIError(response);
            if (errorInfo.shouldRetry && retryCount < maxRetries) {
                console.log(`Retrying request (${retryCount + 1}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1)));
                return questAPIRequest(url, options, retryCount + 1);
            }
            throw new Error(errorInfo.message);
        }
        
        return response;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Request timeout');
        }
        
        const errorInfo = await handleAPIError(null, error);
        if (errorInfo.shouldRetry && retryCount < maxRetries) {
            console.log(`Retrying request due to network error (${retryCount + 1}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1)));
            return questAPIRequest(url, options, retryCount + 1);
        }
        
        throw new Error(errorInfo.message);
    }
}

// 导出配置（如果在模块环境中）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        QUEST_CONFIG,
        getQuestAPIUrl,
        getQuestToken,
        setQuestToken,
        clearQuestToken,
        validateQuestConfig,
        isTokenValid,
        handleAPIError,
        questAPIRequest
    };
}
