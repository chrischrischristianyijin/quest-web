import { API_CONFIG } from './config.js';

// API服务类
class ApiService {
    constructor() {
        this.baseUrl = API_CONFIG.API_BASE_URL;
        this.authToken = null;
    }

    // 设置认证token
    setAuthToken(token) {
        this.authToken = token;
        console.log('🔑 Token已设置:', token ? '存在' : '不存在');
    }

    // 通用请求方法
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        
        // 设置默认headers
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        // 添加认证token
        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }

        // 如果是FormData，移除Content-Type让浏览器自动设置
        if (options.body instanceof FormData) {
            delete headers['Content-Type'];
        }

        const config = {
            method: options.method || 'GET',
            headers,
            ...options
        };

        try {
            console.log(`📡 API请求: ${config.method} ${url}`);
            const response = await fetch(url, config);
            
            console.log(`📡 API响应: ${response.status} ${response.statusText}`);
            
            // 处理认证错误
            if (response.status === 401 || response.status === 403) {
                console.error('❌ 认证失败:', response.status, response.statusText);
                // 清除无效的token
                this.setAuthToken(null);
                localStorage.removeItem('authToken');
                localStorage.removeItem('quest_user_session');
                throw new Error('认证已过期，请重新登录');
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.detail || errorData.message || response.statusText;
                console.error('❌ API错误响应:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorData: errorData,
                    errorMessage: errorMessage
                });
                throw new Error(`HTTP ${response.status}: ${errorMessage}`);
            }

            const data = await response.json();
            console.log('✅ API响应成功:', data);
            return data;
        } catch (error) {
            console.error('❌ API请求错误:', error);
            throw error;
        }
    }

    // 用户注册
    async signup(userData) {
        try {
            console.log('📝 开始用户注册...', userData);
            const response = await fetch(`${this.baseUrl}${API_CONFIG.AUTH.REGISTER}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            const result = await response.json();

            if (result.success) {
                // 兼容两种返回格式：
                // 1) { success, data: { user, access_token } }
                // 2) { success, user, access_token }
                const dataWrapper = result.data || {};
                const user = result.user || dataWrapper.user;
                const token = result.access_token || dataWrapper.access_token || result.token || dataWrapper.token;

                if (token) {
                    this.setAuthToken(token);
                }

                // 即使后端未返回 user，也返回成功，交给上层兜底
                return {
                    success: true,
                    user: user || null,
                    token: token || null
                };
            } else {
                // 改进错误处理
                let errorMessage = result.detail || '注册失败';
                if (result.error && result.error.code === '23505') {
                    errorMessage = '该邮箱已被注册，请直接登录或使用其他邮箱';
                }
                throw new Error(errorMessage);
            }
        } catch (error) {
            console.error('❌ 注册失败:', error);
            throw error;
        }
    }

    // 用户登录
    async login(credentials) {
        try {
            console.log('🔐 开始用户登录...', credentials);
            const response = await fetch(`${this.baseUrl}${API_CONFIG.AUTH.LOGIN}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(credentials)
            });

            const result = await response.json();
            console.log('📡 登录API响应:', result);

            if (result.success && result.data) {
                // 新API格式：access_token
                const token = result.data.access_token;
                if (token) {
                    this.setAuthToken(token);
                }
                return {
                    success: true,
                    user: { 
                        id: result.data.user_id,
                        email: result.data.email 
                    },
                    token: token // 保持向后兼容
                };
            } else {
                throw new Error(result.detail || '登录失败');
            }
        } catch (error) {
            console.error('❌ 登录失败:', error);
            throw error;
        }
    }

    // 用户登出
    async logout() {
        try {
            console.log('🚪 开始用户登出...');
            const response = await this.request(API_CONFIG.AUTH.LOGOUT, {
                method: 'POST'
            });
            
            if (response.success) {
                console.log('✅ 后端登出成功');
                // 完全清理本地状态
                this.setAuthToken(null);
                localStorage.removeItem('quest_user_session');
                localStorage.removeItem('authToken'); // 清理可能存在的旧存储
                return response;
            } else {
                throw new Error(response.detail || '登出失败');
            }
        } catch (error) {
            console.error('❌ 登出失败:', error);
            // 即使API调用失败，也要完全清理本地状态
            this.setAuthToken(null);
            localStorage.removeItem('quest_user_session');
            localStorage.removeItem('authToken');
            throw error;
        }
    }

    // 获取用户资料
    async getUserProfile() {
        return await this.request(API_CONFIG.USER.PROFILE);
    }

    // 更新用户资料
    async updateUserProfile(profileData) {
        return await this.request(API_CONFIG.USER.PROFILE, {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
    }

    // 获取用户所有insights（不分页）
    async getInsights(userId = null, search = '') {
        let endpoint = API_CONFIG.INSIGHTS.ALL;
        const params = new URLSearchParams();
        
        if (userId) params.append('user_id', userId);
        if (search) params.append('search', search);
        
        if (params.toString()) {
            endpoint += `?${params.toString()}`;
        }
        
        return await this.request(endpoint);
    }

    // 获取分页insights
    async getInsightsPaginated(page = 1, limit = 10, userId = null, search = '') {
        let endpoint = API_CONFIG.INSIGHTS.LIST;
        const params = new URLSearchParams();
        
        params.append('page', page);
        params.append('limit', limit);
        if (userId) params.append('user_id', userId);
        if (search) params.append('search', search);
        
        endpoint += `?${params.toString()}`;
        return await this.request(endpoint);
    }

    // 获取单个insight
    async getInsight(insightId) {
        return await this.request(`${API_CONFIG.INSIGHTS.GET}/${insightId}`);
    }

    // 创建insight
    async createInsight(insightData) {
        return await this.request(API_CONFIG.INSIGHTS.CREATE, {
            method: 'POST',
            body: JSON.stringify(insightData)
        });
    }

    // 更新insight
    async updateInsight(insightId, insightData) {
        return await this.request(`${API_CONFIG.INSIGHTS.UPDATE}/${insightId}`, {
            method: 'PUT',
            body: JSON.stringify(insightData)
        });
    }

    // 删除insight
    async deleteInsight(insightId) {
        return await this.request(`${API_CONFIG.INSIGHTS.DELETE}/${insightId}`, {
            method: 'DELETE'
        });
    }

    // 获取用户标签
    async getUserTags(userId = null, page = 1, limit = 10) {
        let endpoint = API_CONFIG.USER_TAGS.LIST;
        const params = new URLSearchParams();
        
        if (userId) params.append('user_id', userId);
        params.append('page', page);
        params.append('limit', limit);
        
        endpoint += `?${params.toString()}`;
        return await this.request(endpoint);
    }

    // 获取用户标签统计
    async getUserTagStats(userId = null) {
        let endpoint = API_CONFIG.USER_TAGS.STATS;
        const params = new URLSearchParams();
        
        if (userId) params.append('user_id', userId);
        
        if (params.toString()) {
            endpoint += `?${params.toString()}`;
        }
        
        return await this.request(endpoint);
    }

    // 获取标签详情
    async getUserTag(userTagId) {
        return await this.request(`${API_CONFIG.USER_TAGS.GET}/${userTagId}`);
    }

    // 创建标签
    async createUserTag(userTagData) {
        return await this.request(API_CONFIG.USER_TAGS.CREATE, {
            method: 'POST',
            body: JSON.stringify(userTagData)
        });
    }

    // 更新标签
    async updateUserTag(userTagId, userTagData) {
        return await this.request(`${API_CONFIG.USER_TAGS.UPDATE}/${userTagId}`, {
            method: 'PUT',
            body: JSON.stringify(userTagData)
        });
    }

    // 删除标签
    async deleteUserTag(userTagId) {
        return await this.request(`${API_CONFIG.USER_TAGS.DELETE}/${userTagId}`, {
            method: 'DELETE'
        });
    }

    // 搜索标签
    async searchUserTags(query, userId = null) {
        let endpoint = API_CONFIG.USER_TAGS.SEARCH;
        const params = new URLSearchParams();
        
        params.append('q', query);
        if (userId) params.append('user_id', userId);
        
        endpoint += `?${params.toString()}`;
        return await this.request(endpoint);
    }

    // 提取网页元数据
    async extractMetadata(url) {
        return await this.request(API_CONFIG.METADATA.EXTRACT, {
            method: 'POST',
            body: JSON.stringify({ url })
        });
    }

    // 从URL创建insight（包含metadata提取）
    async createInsightFromUrl(url, customData = {}) {
        const requestData = {
            url,
            ...customData
        };

        // 如果customData包含tag_names，确保是数组格式并过滤空值
        if (customData.tag_names && Array.isArray(customData.tag_names)) {
            requestData.tag_names = customData.tag_names
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0); // 过滤空字符串
        }

        console.log('📝 发送到API的数据:', requestData);

        return await this.request(API_CONFIG.METADATA.CREATE_INSIGHT, {
            method: 'POST',
            body: JSON.stringify(requestData)
        });
    }

    // 系统健康检查
    async checkHealth() {
        return await this.request(API_CONFIG.SYSTEM.HEALTH);
    }

    // 获取API信息
    async getApiInfo() {
        return await this.request(API_CONFIG.SYSTEM.INFO);
    }
}

// 创建API实例
export const api = new ApiService();
