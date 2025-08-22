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
            
            if (result.user) {
                this.user = result.user;
                this.isAuthenticated = true;
                
                // 保存用户会话
                this.saveSession(result.user, result.token);
                
                this.notifyListeners();
                return { success: true, user: result.user };
            } else {
                // 如果 API 返回了结果但没有用户信息，返回失败状态
                return { success: false, message: '注册失败：无效的用户信息' };
            }
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
            
            if (result && result.user && result.token) {
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
                    } else {
                        // 如果获取资料失败，使用登录返回的基本信息
                        console.warn('⚠️ 获取用户资料失败，使用基本登录信息');
                        this.user = result.user;
                    }
                } catch (profileError) {
                    console.warn('⚠️ 获取用户资料时出错，使用基本登录信息:', profileError);
                    this.user = result.user;
                }
                
                this.isAuthenticated = true;
                
                // 保存用户会话
                this.saveSession(this.user, result.token);
                
                this.notifyListeners();
                return { success: true, user: this.user };
            } else {
                console.log('❌ API 返回了结果但格式不正确:', result);
                return { success: false, message: '登录失败：响应格式错误' };
            }
        } catch (error) {
            console.error('🚨 登录过程中发生错误:', error);
            console.error('错误详情:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            return { success: false, message: error.message || '登录失败，请检查邮箱和密码' };
        }
    }

    // 用户登出
    async logout() {
        try {
            await api.logout();
        } catch (error) {
            console.error('登出API调用失败:', error);
        } finally {
            this.clearSession();
            this.notifyListeners();
        }
    }

    // 保存用户会话
    saveSession(user, token) {
        if (token) {
            api.setAuthToken(token);
        }
        
        localStorage.setItem('quest_user_session', JSON.stringify({
            user,
            token: token, // 确保 token 也被保存
            timestamp: Date.now()
        }));
        
        console.log('💾 会话已保存:', { user: user.email || user.username, hasToken: !!token });
    }

    // 清除用户会话
    clearSession() {
        this.user = null;
        this.isAuthenticated = false;
        api.setAuthToken(null);
        localStorage.removeItem('quest_user_session');
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
                if (sessionAge < 24 * 60 * 60 * 1000) {
                    console.log('🔄 恢复会话状态...');
                    this.user = session.user;
                    this.isAuthenticated = true;
                    
                    // 恢复 token
                    if (session.token) {
                        console.log('🔑 恢复 token...');
                        api.setAuthToken(session.token);
                    } else {
                        console.log('⚠️ 会话中没有 token');
                    }
                    
                    console.log('✅ 会话状态已恢复:', this.user);
                    this.notifyListeners();
                } else {
                    console.log('⏰ 会话已过期，清除数据');
                    this.clearSession();
                }
            } else {
                console.log('📭 没有找到会话数据');
            }
        } catch (error) {
            console.error('❌ 恢复会话状态失败:', error);
            this.clearSession();
        }
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
            
            // 如果超过23小时（提前1小时刷新），认为即将过期
            return sessionAge > 23 * 60 * 60 * 1000;
        } catch (error) {
            console.error('检查token过期失败:', error);
            return true;
        }
    }

    // 刷新token（重新登录）
    async refreshToken() {
        console.log('🔄 检测到token即将过期，尝试刷新...');
        
        const session = localStorage.getItem('quest_user_session');
        if (!session) {
            console.log('❌ 没有会话数据，无法刷新');
            return false;
        }
        
        try {
            const parsed = JSON.parse(session);
            if (!parsed.user || !parsed.user.email) {
                console.log('❌ 会话数据不完整，无法刷新');
                return false;
            }
            
            // 这里需要用户重新输入密码，或者使用refresh token
            // 暂时清除会话，要求用户重新登录
            console.log('⚠️ 需要用户重新登录以获取新token');
            this.clearSession();
            return false;
        } catch (error) {
            console.error('刷新token失败:', error);
            this.clearSession();
            return false;
        }
    }

    // 检查并处理token过期
    async checkAndHandleTokenExpiration() {
        if (this.isTokenExpired()) {
            console.log('⏰ Token已过期，清除会话');
            this.clearSession();
            return false;
        }
        return true;
    }
}

// 创建全局认证管理器实例
export const auth = new AuthManager();
