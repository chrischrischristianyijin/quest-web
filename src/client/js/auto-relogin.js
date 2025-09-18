// 自动重新登录功能
// 当token过期时，自动尝试重新登录用户

import { auth } from './auth.js';
import { api } from './api.js';

class AutoReloginManager {
    constructor() {
        this.isReloggingIn = false;
        this.reloginAttempts = 0;
        this.maxReloginAttempts = 3;
        this.reloginDelay = 2000; // 2秒延迟
        this.userCredentials = null;
        this.isEnabled = true;
        
        this.init();
    }

    // 初始化
    init() {
        // 监听认证过期事件
        window.addEventListener('quest-auth-expired', (event) => {
            console.log('🔔 收到认证过期事件:', event.detail);
            this.handleAuthExpired(event.detail);
        });

        // 监听API错误
        window.addEventListener('quest-api-error', (event) => {
            if (event.detail.status === 401 || event.detail.status === 403) {
                console.log('🔔 收到API认证错误:', event.detail);
                this.handleAuthExpired(event.detail);
            }
        });

        console.log('🔄 Auto relogin manager initialized');
    }

    // 处理认证过期
    async handleAuthExpired(errorDetail) {
        if (!this.isEnabled) {
            console.log('⚠️ Auto relogin is disabled');
            return;
        }

        if (this.isReloggingIn) {
            console.log('⚠️ Already relogging in, skipping duplicate request');
            return;
        }

        if (this.reloginAttempts >= this.maxReloginAttempts) {
            console.log('❌ Max relogin attempts reached, stopping auto retry');
            this.showReloginFailedNotification();
            return;
        }

        console.log('🔄 Starting auto relogin process...');
        await this.attemptRelogin();
    }

    // 尝试重新登录
    async attemptRelogin() {
        this.isReloggingIn = true;
        this.reloginAttempts++;

        try {
            console.log(`🔄 Attempting relogin #${this.reloginAttempts}...`);

            // Check if saved user credentials exist
            const credentials = this.getSavedCredentials();
            if (!credentials) {
                console.log('❌ No saved user credentials, cannot auto relogin');
                this.showManualLoginRequired();
                return;
            }

            // Show relogin notification
            this.showReloginNotification();

            // Wait before attempting login
            await this.delay(this.reloginDelay);

            // Attempt to relogin
            const result = await auth.login(credentials.email, credentials.password);
            
            if (result.success) {
                console.log('✅ Auto relogin successful');
                this.onReloginSuccess();
            } else {
                console.log('❌ Auto relogin failed:', result.message);
                this.onReloginFailure(result.message);
            }

        } catch (error) {
            console.error('❌ Auto relogin error:', error);
            this.onReloginFailure(error.message);
        } finally {
            this.isReloggingIn = false;
        }
    }

    // 重新登录成功处理
    onReloginSuccess() {
        this.reloginAttempts = 0; // 重置尝试次数
        this.showReloginSuccessNotification();
        
        // 触发重新登录成功事件
        window.dispatchEvent(new CustomEvent('quest-relogin-success', {
            detail: {
                timestamp: new Date().toISOString(),
                attempts: this.reloginAttempts
            }
        }));

        // 刷新页面或重新加载数据
        this.refreshApplication();
    }

    // 重新登录失败处理
    onReloginFailure(errorMessage) {
        console.log('❌ 重新登录失败，准备下次重试');
        
        // 触发重新登录失败事件
        window.dispatchEvent(new CustomEvent('quest-relogin-failure', {
            detail: {
                error: errorMessage,
                attempts: this.reloginAttempts,
                maxAttempts: this.maxReloginAttempts
            }
        }));

        // 如果还有重试机会，延迟后重试
        if (this.reloginAttempts < this.maxReloginAttempts) {
            console.log(`⏰ ${this.reloginDelay / 1000}秒后进行第${this.reloginAttempts + 1}次重试...`);
            setTimeout(() => {
                this.attemptRelogin();
            }, this.reloginDelay);
        } else {
            console.log('❌ 重新登录尝试次数已达上限');
            this.showReloginFailedNotification();
        }
    }

    // 保存用户凭据（用于自动重新登录）
    saveCredentials(email, password) {
        try {
            // 使用简单的加密存储（实际项目中应使用更安全的方法）
            const credentials = {
                email: email,
                password: this.simpleEncrypt(password),
                timestamp: Date.now()
            };
            
            sessionStorage.setItem('quest_auto_relogin_credentials', JSON.stringify(credentials));
            this.userCredentials = { email, password };
            
            console.log('💾 User credentials saved (for auto relogin)');
            return true;
        } catch (error) {
            console.error('❌ Failed to save user credentials:', error);
            return false;
        }
    }

    // 获取保存的用户凭据
    getSavedCredentials() {
        try {
            const saved = sessionStorage.getItem('quest_auto_relogin_credentials');
            if (!saved) return null;

            const credentials = JSON.parse(saved);
            
            // Check if credentials are expired (24 hours)
            const now = Date.now();
            const age = now - credentials.timestamp;
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours
            
            if (age > maxAge) {
                console.log('⏰ Saved credentials have expired');
                this.clearSavedCredentials();
                return null;
            }

            return {
                email: credentials.email,
                password: this.simpleDecrypt(credentials.password)
            };
        } catch (error) {
            console.error('❌ Failed to get saved credentials:', error);
            return null;
        }
    }

    // 清除保存的用户凭据
    clearSavedCredentials() {
        try {
            sessionStorage.removeItem('quest_auto_relogin_credentials');
            this.userCredentials = null;
            console.log('🗑️ Saved user credentials cleared');
        } catch (error) {
            console.error('❌ Failed to clear user credentials:', error);
        }
    }

    // 刷新应用程序
    refreshApplication() {
        console.log('🔄 Refreshing application...');
        
        // Clear API cache
        if (window.apiCache) {
            window.apiCache.clear();
        }

        // Trigger page refresh event
        window.dispatchEvent(new CustomEvent('quest-app-refresh', {
            detail: {
                reason: 'auto_relogin_success',
                timestamp: new Date().toISOString()
            }
        }));

        // If it's a single page app, reload data instead of refreshing page
        if (window.location.pathname.includes('/my-space')) {
            // Reload user data
            setTimeout(() => {
                if (window.loadUserData) {
                    window.loadUserData();
                }
            }, 1000);
        }
    }

    // 显示重新登录通知
    showReloginNotification() {
        const notification = document.createElement('div');
        notification.id = 'auto-relogin-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #007bff;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            max-width: 300px;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 18px; margin-right: 8px;">🔄</span>
                <strong>Auto Relogin in Progress...</strong>
            </div>
            <div style="font-size: 12px; opacity: 0.9;">
                Login session expired, attempting to relogin automatically...
            </div>
        `;
        
        document.body.appendChild(notification);
    }

    // 显示重新登录成功通知
    showReloginSuccessNotification() {
        this.removeNotification();
        
        const notification = document.createElement('div');
        notification.id = 'auto-relogin-success-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            max-width: 300px;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 18px; margin-right: 8px;">✅</span>
                <strong>Relogin Successful</strong>
            </div>
            <div style="font-size: 12px; opacity: 0.9;">
                Login status restored automatically, continuing to use the app...
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // 3秒后自动消失
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }

    // 显示重新登录失败通知
    showReloginFailedNotification() {
        this.removeNotification();
        
        const notification = document.createElement('div');
        notification.id = 'auto-relogin-failed-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc3545;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            max-width: 300px;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 18px; margin-right: 8px;">❌</span>
                <strong>Auto Relogin Failed</strong>
            </div>
            <div style="font-size: 12px; opacity: 0.9; margin-bottom: 10px;">
                Unable to restore login status automatically, please login manually
            </div>
            <button onclick="this.parentElement.remove(); window.location.href='/login';" 
                    style="background: white; color: #dc3545; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                Manual Login
            </button>
        `;
        
        document.body.appendChild(notification);
    }

    // 显示需要手动登录的通知
    showManualLoginRequired() {
        this.removeNotification();
        
        const notification = document.createElement('div');
        notification.id = 'manual-login-required-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ffc107;
            color: #212529;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            max-width: 300px;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 18px; margin-right: 8px;">⚠️</span>
                <strong>Re-login Required</strong>
            </div>
            <div style="font-size: 12px; opacity: 0.8; margin-bottom: 10px;">
                Login session has expired, please login again to continue
            </div>
            <button onclick="this.parentElement.remove(); window.location.href='/login';" 
                    style="background: #212529; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                Login Now
            </button>
        `;
        
        document.body.appendChild(notification);
    }

    // 移除通知
    removeNotification() {
        const existingNotification = document.getElementById('auto-relogin-notification');
        if (existingNotification) {
            existingNotification.remove();
        }
    }

    // 简单加密（仅用于演示，实际项目中应使用更安全的方法）
    simpleEncrypt(text) {
        return btoa(text); // Base64编码
    }

    // 简单解密
    simpleDecrypt(encryptedText) {
        try {
            return atob(encryptedText); // Base64解码
        } catch (error) {
            console.error('解密失败:', error);
            return null;
        }
    }

    // 延迟函数
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Enable/disable auto relogin
    setEnabled(enabled) {
        this.isEnabled = enabled;
        console.log(`🔄 Auto relogin ${enabled ? 'enabled' : 'disabled'}`);
    }

    // Reset retry attempts
    resetAttempts() {
        this.reloginAttempts = 0;
        console.log('🔄 Relogin attempts reset');
    }

    // 获取状态信息
    getStatus() {
        return {
            isEnabled: this.isEnabled,
            isReloggingIn: this.isReloggingIn,
            attempts: this.reloginAttempts,
            maxAttempts: this.maxReloginAttempts,
            hasCredentials: !!this.getSavedCredentials()
        };
    }
}

// 创建全局实例
export const autoReloginManager = new AutoReloginManager();

// 添加便捷方法到全局
window.enableAutoRelogin = () => autoReloginManager.setEnabled(true);
window.disableAutoRelogin = () => autoReloginManager.setEnabled(false);
window.saveCredentials = (email, password) => autoReloginManager.saveCredentials(email, password);
window.clearSavedCredentials = () => autoReloginManager.clearSavedCredentials();
window.getAutoReloginStatus = () => autoReloginManager.getStatus();

console.log('🔄 Auto relogin functionality loaded');
console.log('💡 Usage:');
console.log('  - saveCredentials(email, password) - Save user credentials');
console.log('  - enableAutoRelogin() - Enable auto relogin');
console.log('  - disableAutoRelogin() - Disable auto relogin');
console.log('  - getAutoReloginStatus() - Get status information');
