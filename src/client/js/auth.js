import { api } from './api.js';

// 用户状态管理
class AuthManager {
    constructor() {
        this.user = null;
        this.isAuthenticated = false;
        this.listeners = [];
        this.init();
    }

    // 初始化
    init() {
        // 检查本地存储的用户会话
        const session = localStorage.getItem('quest_user_session');
        if (session) {
            try {
                const parsed = JSON.parse(session);
                if (parsed.user && parsed.timestamp) {
                    // 检查会话是否过期（24小时）
                    const now = Date.now();
                    if (now - parsed.timestamp < 24 * 60 * 60 * 1000) {
                        this.user = parsed.user;
                        this.isAuthenticated = true;
                        this.notifyListeners();
                    } else {
                        // 会话过期，清除
                        this.clearSession();
                    }
                }
            } catch (error) {
                console.error('解析用户会话失败:', error);
                this.clearSession();
            }
        }
    }

    // 用户注册
    async signup(email, nickname, password) {
        try {
            const result = await api.signup({ email, nickname, password });
            
            if (result && result.success) {
                // 兼容后端可能未返回 user 的情况，使用前端表单数据兜底
                const resolvedUser = result.user || { email, nickname };
                this.user = resolvedUser;
                this.isAuthenticated = true;
                
                // 保存用户会话
                this.saveSession(this.user, result.token);
                
                this.notifyListeners();
                return { success: true, user: this.user };
            }

            return { success: false, message: '注册失败：无效的返回结果' };
        } catch (error) {
            console.error('注册错误:', error);
            return { success: false, message: error.message || '注册失败，请重试' };
        }
    }

    // 用户登录
    async login(email, password) {
        try {
            console.log('🔐 开始登录流程...', { email });
            const result = await api.login({ email, password });
            console.log('📡 API 响应结果:', result);
            
            if (result && result.success && result.user) {
                console.log('✅ 登录成功，获取到 token:', result.token);
                
                // 设置认证 token
                api.setAuthToken(result.token);
                
                // 获取完整的用户资料
                try {
                    console.log('🔍 获取用户完整资料...');
                    const profileResult = await api.getUserProfile();
                    console.log('📡 用户资料 API 响应:', profileResult);
                    
                    if (profileResult && profileResult.success && profileResult.data) {
                        this.user = profileResult.data;
                        console.log('✅ 获取到完整用户信息:', this.user);
                        // 更新本地存储的会话数据
                        this.saveSession(this.user, result.token);
                    } else {
                        // 如果获取资料失败，尝试使用不同的响应格式
                        console.warn('⚠️ 获取用户资料失败，尝试其他响应格式');
                        console.warn('⚠️ Profile API response structure:', {
                            hasSuccess: !!profileResult?.success,
                            hasData: !!profileResult?.data,
                            fullResponse: profileResult
                        });
                        
                        // 尝试直接使用 profileResult 作为用户数据（某些API可能直接返回用户数据）
                        if (profileResult && (profileResult.id || profileResult.email)) {
                            console.log('✅ 使用直接返回的用户数据');
                            this.user = profileResult;
                            // 更新本地存储的会话数据
                            this.saveSession(this.user, result.token);
                        } else {
                            // 最后回退到登录返回的基本信息
                            console.warn('⚠️ 使用基本登录信息作为回退');
                            this.user = result.user;
                        }
                    }
                } catch (profileError) {
                    console.warn('⚠️ 获取用户资料时出错，使用基本登录信息:', profileError);
                    console.warn('⚠️ Profile API error details:', {
                        error: profileError.message,
                        stack: profileError.stack
                    });
                    this.user = result.user;
                }
                
                this.isAuthenticated = true;
                
                // 保存用户会话
                this.saveSession(this.user, result.token);
                
                this.notifyListeners();
                return { success: true, user: this.user };
            } else {
                throw new Error(result?.message || 'Login failed');
            }
        } catch (error) {
            console.error('❌ 登录失败:', error);
            return { success: false, message: error.message || 'Login failed, please try again' };
        }
    }

    // 用户登出
    async logout() {
        try {
            console.log('🚪 开始用户登出流程...');
            
            // 直接清除本地状态，不需要调用后端API
            this.clearSession();
            this.notifyListeners();
            
            console.log('✅ 登出成功');
            return { success: true };
            
        } catch (error) {
            console.error('❌ 登出错误:', error);
            // 即使出错，也要清除本地会话
            this.clearSession();
            this.notifyListeners();
            return { success: false, message: error.message };
        }
    }

    // 保存用户会话
    saveSession(user, token) {
        if (token) {
            // 只在一个地方存储token：quest_user_session
            api.setAuthToken(token);
        }
        
        localStorage.setItem('quest_user_session', JSON.stringify({
            user,
            token: token,
            timestamp: Date.now()
        }));
        
        console.log('💾 会话已保存:', { 
            user: user.email || user.username, 
            hasToken: !!token,
            sessionToken: !!localStorage.getItem('quest_user_session')
        });
    }

    // 清除用户会话
    clearSession() {
        console.log('🗑️ 开始清理用户会话...');
        
        // 清除用户状态
        this.user = null;
        this.isAuthenticated = false;
        
        // 清除所有token存储
        api.setAuthToken(null);
        localStorage.removeItem('quest_user_session');
        localStorage.removeItem('authToken'); // 清理可能存在的旧存储
        
        // 清除其他可能存在的相关存储
        localStorage.removeItem('quest_user_profile');
        localStorage.removeItem('quest_user_insights');
        
        // 注意：不要清除 quest_stacks 和 quest_insights_backup
        // 这些数据应该持久化，即使在没有认证的情况下
        console.log('✅ 会话已完全清除 (保留stacks和insights数据)');
    }

    // 获取当前用户
    getCurrentUser() {
        return this.user;
    }

    // 检查是否已认证
    checkAuth() {
        return this.isAuthenticated;
    }

    // 订阅状态变化
    subscribe(listener) {
        this.listeners.push(listener);
        // 立即调用一次
        listener(this);
        
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }

    // 通知监听器
    notifyListeners() {
        this.listeners.forEach(listener => {
            try {
                listener(this);
            } catch (error) {
                console.error('状态监听器错误:', error);
            }
        });
    }
    
    // 添加认证状态监听器
    addListener(listener) {
        if (typeof listener === 'function') {
            this.listeners.push(listener);
        } else {
            console.warn('addListener: listener must be a function');
        }
    }
    
    // 恢复会话状态
    restoreSession() {
        try {
            console.log('🔄 开始恢复会话状态...');
            const sessionData = localStorage.getItem('quest_user_session');
            console.log('📦 会话数据:', sessionData ? '存在' : '不存在');
            
            if (sessionData) {
                const session = JSON.parse(sessionData);
                console.log('🔍 解析的会话数据:', {
                    hasUser: !!session.user,
                    hasToken: !!session.token,
                    timestamp: session.timestamp
                });
                
                const now = Date.now();
                const sessionAge = now - session.timestamp;
                
                // 检查会话是否过期（24小时）
                console.log('🔍 会话年龄检查:', {
                    sessionAge: sessionAge,
                    sessionAgeHours: sessionAge / (1000 * 60 * 60),
                    maxAge: 24 * 60 * 60 * 1000,
                    maxAgeHours: 24,
                    isExpired: sessionAge >= 24 * 60 * 60 * 1000,
                    sessionTimestamp: session.timestamp,
                    currentTime: now,
                    timeDiff: now - session.timestamp
                });
                
                if (sessionAge < 24 * 60 * 60 * 1000) {
                    console.log('🔄 恢复会话状态...');
                    this.user = session.user;
                    this.isAuthenticated = true;
                    
                    // 恢复 token - 只从 quest_user_session 恢复
                    if (session.token) {
                        console.log('🔑 从会话恢复 token...');
                        api.setAuthToken(session.token);
                        console.log('✅ Token恢复成功，当前API token状态:', api.authToken ? '已设置' : '未设置');
                    } else {
                        console.log('⚠️ 会话中没有token，清除会话');
                        this.clearSession();
                        return false;
                    }
                    
                    this.notifyListeners();
                    return true;
                } else {
                    console.log('⏰ 会话已过期');
                    this.clearSession();
                    return false;
                }
            } else {
                console.log('📦 没有找到会话数据');
                return false;
            }
        } catch (error) {
            console.error('❌ 恢复会话状态失败:', error);
            this.clearSession();
            return false;
        }
    }

    // 验证token是否有效
    async validateToken() {
        try {
            if (!this.isAuthenticated || !this.user) {
                console.log('⚠️ 用户未认证，无法验证token');
                return false;
            }
            
            // 尝试获取用户资料来验证token
            const profileResult = await api.getUserProfile();
            if (profileResult && profileResult.success) {
                console.log('✅ Token验证成功');
                return true;
            } else {
                console.log('❌ Token验证失败');
                // 触发认证过期事件
                window.dispatchEvent(new CustomEvent('quest-auth-expired', { 
                    detail: { 
                        status: 401, 
                        reason: 'Token validation failed' 
                    } 
                }));
                return false;
            }
        } catch (error) {
            console.error('❌ Token验证出错:', error);
            if (error.message.includes('401') || error.message.includes('403')) {
                console.log('🔑 Token已过期，清除会话并触发事件');
                this.clearSession();
                // 触发认证过期事件
                window.dispatchEvent(new CustomEvent('quest-auth-expired', { 
                    detail: { 
                        status: error.message.includes('401') ? 401 : 403,
                        reason: 'Token expired during validation',
                        error: error.message
                    } 
                }));
            }
            return false;
        }
    }
    
    // 获取当前token
    getCurrentToken() {
        try {
            const sessionData = localStorage.getItem('quest_user_session');
            if (sessionData) {
                const session = JSON.parse(sessionData);
                return session.token || null;
            }
            return null;
        } catch (error) {
            console.error('获取token失败:', error);
            return null;
        }
    }
    
    // 检查token是否存在
    hasValidToken() {
        const token = this.getCurrentToken();
        return !!token;
    }

    // 检查token是否过期
    isTokenExpired() {
        const session = localStorage.getItem('quest_user_session');
        if (!session) return true;
        
        try {
            const parsed = JSON.parse(session);
            if (!parsed.timestamp) return true;
            
            const now = Date.now();
            const sessionAge = now - parsed.timestamp;
            
            // 延长到7天过期，减少频繁重新登录
            const expirationTime = 7 * 24 * 60 * 60 * 1000; // 7天
            return sessionAge >= expirationTime;
        } catch (error) {
            console.error('检查token过期失败:', error);
            return true;
        }
    }

    // 刷新token（如果需要的话）
    async refreshToken() {
        try {
            console.log('🔄 尝试刷新token...');
            
            // 检查是否有有效的会话
            if (!this.isAuthenticated || !this.user) {
                throw new Error('No valid session to refresh');
            }
            
            // 尝试通过重新验证用户资料来"刷新"token
            // 如果API调用成功，说明token仍然有效
            try {
                const profileResult = await api.getUserProfile();
                if (profileResult) {
                    console.log('✅ Token仍然有效，无需刷新');
                    // 更新会话时间戳
                    this.updateSessionTimestamp();
                    return true;
                }
            } catch (error) {
                console.log('❌ Token验证失败，需要重新登录');
                return false;
            }
            
            return false;
        } catch (error) {
            console.error('刷新token失败:', error);
            return false;
        }
    }
    
    // 更新会话时间戳
    updateSessionTimestamp() {
        try {
            const session = localStorage.getItem('quest_user_session');
            if (session) {
                const parsed = JSON.parse(session);
                parsed.timestamp = Date.now();
                localStorage.setItem('quest_user_session', JSON.stringify(parsed));
                console.log('🕒 会话时间戳已更新');
            }
        } catch (error) {
            console.error('更新会话时间戳失败:', error);
        }
    }

    // 检查并处理token过期
    async checkAndHandleTokenExpiration() {
        if (this.isTokenExpired()) {
            console.log('⏰ Token已过期，尝试刷新...');
            
            const refreshed = await this.refreshToken();
            if (!refreshed) {
                console.log('❌ Token刷新失败，清除会话');
                this.clearSession();
                return false;
            }
        }
        
        return true;
    }
    
    // 刷新用户资料数据
    async refreshUserProfile() {
        try {
            console.log('🔄 刷新用户资料数据...');
            const profileResult = await api.getUserProfile();
            console.log('📡 刷新用户资料 API 响应:', profileResult);
            
            if (profileResult && profileResult.success && profileResult.data) {
                this.user = profileResult.data;
                console.log('✅ 用户资料刷新成功:', this.user);
                // 更新本地存储
                this.saveSession(this.user, this.getCurrentToken());
                this.notifyListeners();
                return true;
            } else if (profileResult && (profileResult.id || profileResult.email)) {
                this.user = profileResult;
                console.log('✅ 用户资料刷新成功 (直接格式):', this.user);
                // 更新本地存储
                this.saveSession(this.user, this.getCurrentToken());
                this.notifyListeners();
                return true;
            } else {
                console.warn('⚠️ 用户资料刷新失败，响应格式异常');
                return false;
            }
        } catch (error) {
            console.error('❌ 刷新用户资料失败:', error);
            return false;
        }
    }

    // 移除邮箱检查方法，改由注册接口内部校验

    // 忘记密码
    async forgotPassword(email) {
        try {
            const result = await api.forgotPassword(email);
            return result;
        } catch (error) {
            console.error('忘记密码失败:', error);
            return { success: false, message: error.message };
        }
    }
}

// 创建全局认证管理器实例
export const auth = new AuthManager();
