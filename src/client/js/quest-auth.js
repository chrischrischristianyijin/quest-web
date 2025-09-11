// Quest Authentication Helper
// 这个文件提供了Quest AI的认证管理功能

// 检查当前认证状态
function checkAuthStatus() {
    const token = getQuestToken();
    if (!token) {
        return {
            isAuthenticated: false,
            message: 'Not authenticated',
            action: 'Please log in to access Quest AI features'
        };
    }
    
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Math.floor(Date.now() / 1000);
        const timeUntilExpiry = payload.exp - currentTime;
        
        if (timeUntilExpiry <= 0) {
            return {
                isAuthenticated: false,
                message: 'Token expired',
                action: 'Please refresh your login session'
            };
        } else if (timeUntilExpiry <= 300) { // 5分钟内过期
            return {
                isAuthenticated: true,
                message: 'Token expires soon',
                action: 'Consider refreshing your session',
                expiresIn: timeUntilExpiry
            };
        } else {
            return {
                isAuthenticated: true,
                message: 'Authenticated',
                action: 'Full access to Quest AI features',
                expiresIn: timeUntilExpiry
            };
        }
    } catch (error) {
        return {
            isAuthenticated: false,
            message: 'Invalid token',
            action: 'Please log in again'
        };
    }
}

// 显示认证状态
function showAuthStatus() {
    const status = checkAuthStatus();
    console.log('Quest AI Auth Status:', status);
    
    if (!status.isAuthenticated) {
        console.warn(`Authentication required: ${status.action}`);
        return false;
    }
    
    if (status.expiresIn && status.expiresIn <= 300) {
        console.warn(`Token expires in ${Math.floor(status.expiresIn / 60)} minutes`);
    }
    
    return true;
}

// 处理认证错误
function handleAuthError(error) {
    console.error('Authentication error:', error);
    
    // 清理无效的token
    clearQuestToken();
    
    // 显示用户友好的错误消息
    const errorMessages = {
        '401': 'Your session has expired. Please log in again.',
        '403': 'Access denied. Please check your permissions.',
        'expired': 'Your authentication has expired. Please refresh your session.',
        'invalid': 'Invalid authentication token. Please log in again.'
    };
    
    let message = 'Authentication error occurred. Please try logging in again.';
    
    if (error.message) {
        for (const [key, value] of Object.entries(errorMessages)) {
            if (error.message.includes(key)) {
                message = value;
                break;
            }
        }
    }
    
    return message;
}

// 刷新认证状态（如果需要的话）
async function refreshAuthStatus() {
    try {
        const token = getQuestToken();
        if (!token) {
            throw new Error('No token available');
        }
        
        // 这里可以添加token刷新逻辑
        // 例如调用refresh token API
        console.log('Checking authentication status...');
        
        const status = checkAuthStatus();
        if (!status.isAuthenticated) {
            throw new Error('Token is invalid or expired');
        }
        
        return true;
    } catch (error) {
        console.warn('Auth refresh failed:', error);
        clearQuestToken();
        return false;
    }
}

// 设置认证token（带验证）
function setQuestTokenWithValidation(token, persistent = true) {
    if (!token || typeof token !== 'string') {
        throw new Error('Invalid token format');
    }
    
    // 验证token格式
    if (!isTokenValid(token)) {
        throw new Error('Token is invalid or expired');
    }
    
    setQuestToken(token, persistent);
    console.log('Quest AI authentication token set successfully');
    return true;
}

// 获取认证信息摘要
function getAuthSummary() {
    const status = checkAuthStatus();
    const token = getQuestToken();
    
    return {
        isAuthenticated: status.isAuthenticated,
        status: status.message,
        action: status.action,
        expiresIn: status.expiresIn,
        tokenPreview: token ? `${token.substring(0, 20)}...` : 'None'
    };
}

// 导出函数（如果在模块环境中）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        checkAuthStatus,
        showAuthStatus,
        handleAuthError,
        refreshAuthStatus,
        setQuestTokenWithValidation,
        getAuthSummary
    };
}
