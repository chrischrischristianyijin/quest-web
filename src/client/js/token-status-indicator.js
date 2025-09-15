// Token状态指示器
import { auth } from './auth.js';
import { tokenManager } from './token-manager.js';

class TokenStatusIndicator {
    constructor() {
        this.indicator = null;
        this.isVisible = false;
        this.isEnabled = false; // 默认不显示
        this.createIndicator();
        this.setupSearchListener();
        // 不自动启动监控，需要手动启用
    }

    createIndicator() {
        // 创建状态指示器元素
        this.indicator = document.createElement('div');
        this.indicator.id = 'token-status-indicator';
        this.indicator.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 8px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-family: Arial, sans-serif;
            z-index: 9999;
            display: none;
            transition: all 0.3s ease;
            cursor: pointer;
            user-select: none;
        `;
        
        this.indicator.innerHTML = `
            <span id="token-status-text">🔐 检查登录状态...</span>
        `;
        
        // 点击指示器显示详细信息
        this.indicator.addEventListener('click', () => {
            this.showDetailedStatus();
        });
        
        document.body.appendChild(this.indicator);
    }

    // 设置搜索监听器
    setupSearchListener() {
        // 监听所有输入框的变化
        document.addEventListener('input', (e) => {
            if (e.target.type === 'text' || e.target.type === 'search') {
                const value = e.target.value.toLowerCase().trim();
                
                if (value === 'token_status') {
                    // 切换指示器状态：如果已启用则禁用，如果未启用则启用
                    if (this.isEnabled) {
                        this.disableIndicator();
                        console.log('🔍 Token status indicator toggled OFF');
                    } else {
                        this.enableIndicator();
                        console.log('🔍 Token status indicator toggled ON');
                    }
                }
            }
        });

        // 监听搜索框的焦点事件
        document.addEventListener('focusin', (e) => {
            if (e.target.type === 'text' || e.target.type === 'search') {
                // 检查当前值是否为token_status
                const value = e.target.value.toLowerCase().trim();
                if (value === 'token_status') {
                    // 焦点事件时不自动切换，只是检查状态
                    console.log('🔍 Focused on search box with token_status');
                }
            }
        });
    }

    // 启用指示器
    enableIndicator() {
        if (!this.isEnabled) {
            this.isEnabled = true;
            this.startMonitoring();
            console.log('🔍 Token status indicator enabled (token_status detected)');
        }
    }

    // 禁用指示器
    disableIndicator() {
        if (this.isEnabled) {
            this.isEnabled = false;
            this.hideIndicator();
            this.stopMonitoring();
            console.log('🔍 Token status indicator disabled');
        }
    }

    // 停止监控
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    }

    updateStatus(status, message) {
        if (!this.indicator || !this.isEnabled) return;
        
        const statusText = document.getElementById('token-status-text');
        if (!statusText) return;
        
        let icon = '🔐';
        let color = '#28a745'; // 绿色
        
        switch (status) {
            case 'valid':
                icon = '✅';
                color = '#28a745';
                break;
            case 'expiring':
                icon = '⚠️';
                color = '#ffc107';
                break;
            case 'expired':
                icon = '❌';
                color = '#dc3545';
                break;
            case 'checking':
                icon = '🔄';
                color = '#17a2b8';
                break;
            default:
                icon = '🔐';
                color = '#6c757d';
        }
        
        statusText.textContent = `${icon} ${message}`;
        this.indicator.style.background = color;
        
        // 显示指示器
        if (!this.isVisible) {
            this.indicator.style.display = 'block';
            this.isVisible = true;
            
            // 3秒后自动隐藏（除非是错误状态）
            if (status !== 'expired') {
                setTimeout(() => {
                    this.hideIndicator();
                }, 3000);
            }
        }
    }

    hideIndicator() {
        if (this.indicator && this.isVisible) {
            this.indicator.style.display = 'none';
            this.isVisible = false;
        }
    }

    showDetailedStatus() {
        const session = localStorage.getItem('quest_user_session');
        let details = 'Token Status Details:\n\n';
        
        if (!session) {
            details += '❌ No login session found\n';
            details += 'Please log in again to continue';
        } else {
            try {
                const parsed = JSON.parse(session);
                const now = Date.now();
                const sessionAge = now - parsed.timestamp;
                const expirationTime = 7 * 24 * 60 * 60 * 1000; // 7天
                const remainingTime = expirationTime - sessionAge;
                
                // 尝试多种方式获取用户信息
                let userInfo = 'Unknown';
                if (parsed.user) {
                    userInfo = parsed.user.email || parsed.user.username || parsed.user.name || parsed.user.id || 'User';
                }
                details += `✅ User: ${userInfo}\n`;
                details += `🕒 Login Time: ${new Date(parsed.timestamp).toLocaleString()}\n`;
                details += `⏰ Remaining Time: ${Math.round(remainingTime / (60 * 60 * 1000))} hours\n`;
                
                if (remainingTime <= 0) {
                    details += '\n❌ Token expired, please log in again';
                } else if (remainingTime <= 60 * 60 * 1000) { // 1小时内
                    details += '\n⚠️ Token expiring soon, recommend re-login';
                } else {
                    details += '\n✅ Token status normal';
                }
            } catch (error) {
                details += '❌ Session data parsing error\n';
                details += 'Please log in again';
            }
        }
        
        alert(details);
    }

    startMonitoring() {
        // 停止之前的监控
        this.stopMonitoring();
        
        // 每5分钟检查一次Token状态
        this.monitoringInterval = setInterval(() => {
            this.checkTokenStatus();
        }, 5 * 60 * 1000);
        
        // 页面加载时立即检查一次
        setTimeout(() => {
            this.checkTokenStatus();
        }, 1000);
    }

    async checkTokenStatus() {
        if (!auth.checkAuth()) {
            this.updateStatus('expired', 'Not logged in');
            return;
        }
        
        this.updateStatus('checking', 'Checking login status...');
        
        try {
            if (auth.isTokenExpired()) {
                this.updateStatus('expired', 'Login expired');
                return;
            }
            
            if (tokenManager.isTokenNearExpiry()) {
                this.updateStatus('expiring', 'Login expiring soon');
                return;
            }
            
            // 验证Token有效性
            const isValid = await auth.validateToken();
            if (isValid) {
                this.updateStatus('valid', 'Login status normal');
            } else {
                this.updateStatus('expired', 'Login validation failed');
            }
        } catch (error) {
            console.error('Token状态检查失败:', error);
            this.updateStatus('expired', 'Status check failed');
        }
    }
}

// 创建全局Token状态指示器
export const tokenStatusIndicator = new TokenStatusIndicator();

// 监听认证过期事件
window.addEventListener('quest-auth-expired', () => {
    if (tokenStatusIndicator.isEnabled) {
        tokenStatusIndicator.updateStatus('expired', 'Login expired');
    }
});

// 监听认证成功事件
window.addEventListener('quest-auth-success', () => {
    if (tokenStatusIndicator.isEnabled) {
        tokenStatusIndicator.updateStatus('valid', 'Login successful');
    }
});
