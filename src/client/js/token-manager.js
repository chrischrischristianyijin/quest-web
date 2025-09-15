// Token管理工具类
import { auth } from './auth.js';

class TokenManager {
    constructor() {
        this.isRefreshing = false;
        this.refreshPromise = null;
        this.pendingRequests = [];
    }

    // 检查Token是否即将过期（提前1小时检查）
    isTokenNearExpiry() {
        const session = localStorage.getItem('quest_user_session');
        if (!session) return true;
        
        try {
            const parsed = JSON.parse(session);
            if (!parsed.timestamp) return true;
            
            const now = Date.now();
            const sessionAge = now - parsed.timestamp;
            const expirationTime = 7 * 24 * 60 * 60 * 1000; // 7天
            const warningTime = 1 * 60 * 60 * 1000; // 1小时
            
            return sessionAge >= (expirationTime - warningTime);
        } catch (error) {
            console.error('检查Token即将过期失败:', error);
            return true;
        }
    }

    // 智能Token刷新
    async smartRefresh() {
        if (this.isRefreshing) {
            return this.refreshPromise;
        }

        this.isRefreshing = true;
        this.refreshPromise = this._performRefresh();

        try {
            const result = await this.refreshPromise;
            return result;
        } finally {
            this.isRefreshing = false;
            this.refreshPromise = null;
        }
    }

    async _performRefresh() {
        try {
            console.log('🔄 开始智能Token刷新...');
            
            // 检查是否有refresh_token
            const refreshToken = auth.getCurrentRefreshToken();
            if (!refreshToken) {
                console.log('❌ 没有refresh_token，无法刷新');
                return false;
            }
            
            // 检查Token是否真的过期
            if (!auth.isTokenExpired()) {
                console.log('✅ Token仍然有效，更新时间戳');
                auth.updateSessionTimestamp();
                return true;
            }

            // 尝试使用refresh_token刷新Token
            const refreshed = await auth.refreshToken();
            if (refreshed) {
                console.log('✅ Token刷新成功');
                return true;
            } else {
                console.log('❌ Token刷新失败，需要重新登录');
                return false;
            }
        } catch (error) {
            console.error('Token刷新过程出错:', error);
            return false;
        }
    }

    // 处理API请求中的Token过期
    async handleApiRequest(requestFn) {
        try {
            return await requestFn();
        } catch (error) {
            // 检查是否是认证错误
            if (error.message.includes('401') || error.message.includes('403') || 
                error.message.includes('认证') || error.message.includes('expired')) {
                
                console.log('🔐 检测到认证错误，尝试刷新Token...');
                
                const refreshed = await this.smartRefresh();
                if (refreshed) {
                    console.log('🔄 Token刷新成功，重试请求...');
                    // 重试原始请求
                    return await requestFn();
                } else {
                    console.log('❌ Token刷新失败，自动退出登录');
                    // 自动退出登录
                    await this.autoLogout('Token刷新失败');
                    throw error;
                }
            }
            throw error;
        }
    }

    // 自动退出登录
    async autoLogout(reason = 'Token过期') {
        try {
            console.log(`🚪 自动退出登录: ${reason}`);
            
            // 显示退出通知
            this.showLogoutNotification(reason);
            
            // 清除所有本地数据
            localStorage.removeItem('quest_user_session');
            localStorage.removeItem('authToken');
            localStorage.removeItem('quest_insights_backup');
            
            // 清除API缓存
            if (window.apiCache) {
                window.apiCache.clear();
            }
            
            // 停止所有定时器
            this.stopAllTimers();
            
            // 触发认证过期事件
            window.dispatchEvent(new CustomEvent('quest-auth-expired', { 
                detail: { 
                    status: 401, 
                    reason: reason,
                    autoLogout: true
                } 
            }));
            
            // 延迟跳转到登录页面，让用户看到通知
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
            
        } catch (error) {
            console.error('自动退出登录失败:', error);
            // 即使出错也要跳转到登录页面
            window.location.href = '/login';
        }
    }

    // 显示退出通知
    showLogoutNotification(reason) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #dc3545;
            color: white;
            padding: 20px 30px;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: Arial, sans-serif;
            text-align: center;
            max-width: 400px;
        `;
        
        notification.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 15px;">🔒</div>
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">Session Expired</div>
            <div style="font-size: 14px; margin-bottom: 15px;">${reason}</div>
            <div style="font-size: 12px; opacity: 0.8;">Redirecting to login page...</div>
        `;
        
        document.body.appendChild(notification);
        
        // 3秒后移除通知
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }

    // 停止所有定时器
    stopAllTimers() {
        // 停止Token验证定时器
        if (window.tokenValidationInterval) {
            clearInterval(window.tokenValidationInterval);
            window.tokenValidationInterval = null;
        }
        
        // 停止聊天Token验证定时器
        if (window.chatTokenValidationInterval) {
            clearInterval(window.chatTokenValidationInterval);
            window.chatTokenValidationInterval = null;
        }
        
        // 停止聊天自动保存定时器
        if (window.chatAutoSaveInterval) {
            clearInterval(window.chatAutoSaveInterval);
            window.chatAutoSaveInterval = null;
        }
    }

    // 显示Token即将过期的警告
    showExpiryWarning() {
        const warningMessage = 'Your login session is about to expire. To maintain your login status, please save your current work and log in again.';
        
        // 创建友好的警告提示
        const warningDiv = document.createElement('div');
        warningDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 15px;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            color: #856404;
        `;
        
        warningDiv.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                <span style="font-size: 18px; margin-right: 8px;">⚠️</span>
                <strong>Session Expiring Soon</strong>
            </div>
            <div style="margin-bottom: 15px;">${warningMessage}</div>
            <div style="display: flex; gap: 10px;">
                <button onclick="this.parentElement.parentElement.remove()" 
                        style="padding: 6px 12px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Remind Later
                </button>
                <button onclick="window.location.href='/login'" 
                        style="padding: 6px 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Login Again
                </button>
            </div>
        `;
        
        document.body.appendChild(warningDiv);
        
        // 10秒后自动消失
        setTimeout(() => {
            if (warningDiv.parentElement) {
                warningDiv.remove();
            }
        }, 10000);
    }

    // 检查refresh_token是否可用
    hasRefreshToken() {
        const refreshToken = auth.getCurrentRefreshToken();
        return !!refreshToken;
    }

    // 启动Token监控
    startMonitoring() {
        // 每10分钟检查一次Token状态
        setInterval(() => {
            if (auth.checkAuth()) {
                if (auth.isTokenExpired()) {
                    // 如果有refresh_token，尝试刷新；否则退出登录
                    if (this.hasRefreshToken()) {
                        console.log('⏰ Token已过期，尝试刷新...');
                        this.smartRefresh().then(refreshed => {
                            if (!refreshed) {
                                console.log('❌ Token刷新失败，自动退出登录');
                                this.autoLogout('Token刷新失败');
                            }
                        });
                    } else {
                        console.log('⏰ Token已过期且无refresh_token，自动退出登录');
                        this.autoLogout('Token已过期');
                    }
                } else if (this.isTokenNearExpiry()) {
                    console.log('⚠️ Token即将过期，显示警告');
                    this.showExpiryWarning();
                }
            }
        }, 10 * 60 * 1000); // 10分钟检查一次
    }
}

// 创建全局Token管理器实例
export const tokenManager = new TokenManager();

// 自动启动监控
if (typeof window !== 'undefined') {
    tokenManager.startMonitoring();
}
