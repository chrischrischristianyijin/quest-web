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
        
        // Debug: Log token status for non-GET requests
        if ((options.method || 'GET') !== 'GET') {
            console.log('🔍 API Request Debug:', {
                endpoint,
                method: options.method || 'GET',
                hasToken: !!this.authToken,
                tokenPreview: this.authToken ? `${this.authToken.substring(0, 20)}...` : 'None'
            });
        }
        
        // Check cache for GET requests
        if ((options.method || 'GET') === 'GET' && window.apiCache) {
            const cached = window.apiCache.get(url);
            if (cached) {
                console.log(`📦 Cache hit: ${url}`);
                return cached;
            }
        }
        
        // 设置默认headers
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        // 添加认证token
        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        } else {
            console.warn('⚠️ No auth token available for request:', endpoint);
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
                // 清理前端 GET 缓存并广播全局"认证过期"事件
                if (window.apiCache) window.apiCache.clear();
                window.dispatchEvent(new CustomEvent('quest-auth-expired', { detail: { status: response.status } }));
                
                // Try to get more specific error message from response
                let errorMessage = '认证已过期，请重新登录';
                try {
                    const errorData = await response.json();
                    if (errorData.detail) {
                        errorMessage = errorData.detail;
                    }
                } catch (e) {
                    // If we can't parse the error response, use default message
                }
                
                throw new Error(errorMessage);
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
            
            // Cache successful GET responses
            if ((options.method || 'GET') === 'GET' && window.apiCache) {
                window.apiCache.set(url, data);
            }
            
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
                // 兼容多种返回格式：
                // A) { success, data: { user, access_token } }
                // B) { success, user, access_token }
                // C) { success, data: { success, message, data: { user, access_token } } }
                const dataLevel1 = result.data || {};
                const dataLevel2 = dataLevel1.data || {};
                const user = result.user || dataLevel1.user || dataLevel2.user || null;
                const token = result.access_token 
                    || dataLevel1.access_token 
                    || dataLevel2.access_token 
                    || result.token 
                    || dataLevel1.token 
                    || dataLevel2.token 
                    || null;

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

            if (result.success) {
                // 兼容多种返回格式：
                // A) { success, data: { user_id, email, access_token } }
                // B) { success, data: { user, access_token } }
                // C) { success, user, access_token }
                // D) { success, data: { success, message, data: { user, access_token } } }
                const dataLevel1 = result.data || {};
                const dataLevel2 = dataLevel1.data || {};

                const token = result.access_token 
                    || dataLevel1.access_token 
                    || dataLevel2.access_token 
                    || result.token 
                    || dataLevel1.token 
                    || dataLevel2.token 
                    || null;

                const user = result.user 
                    || dataLevel1.user 
                    || dataLevel2.user 
                    || {
                        id: dataLevel1.user_id || dataLevel2.user_id || null,
                        email: dataLevel1.email || dataLevel2.email || credentials.email
                    };

                if (token) {
                    this.setAuthToken(token);
                }

                return {
                    success: true,
                    user,
                    token
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
        
        // Add parameter to include tags in the response
        params.append('include_tags', 'true');
        
        if (params.toString()) {
            endpoint += `?${params.toString()}`;
        }
        
        console.log('📡 Fetching insights with endpoint:', endpoint);
        return await this.request(endpoint);
    }

    // 获取单个insight
    async getInsight(insightId) {
        return await this.request(`${API_CONFIG.INSIGHTS.GET}/${insightId}`);
    }

    // 获取分页insights
    async getInsightsPaginated(page = 1, limit = 6, userId = null, search = '', includeTags = false) {
        let endpoint = API_CONFIG.INSIGHTS.LIST;
        const params = new URLSearchParams();
        
        params.append('page', page);
        params.append('limit', limit);
        if (userId) params.append('user_id', userId);
        if (search) params.append('search', search);
        if (includeTags) params.append('include_tags', 'true');
        
        endpoint += `?${params.toString()}`;
        return await this.request(endpoint);
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

    // ===== 堆叠管理接口 =====
    
    // 获取用户所有堆叠
    async getUserStacks(userId = null) {
        let endpoint = API_CONFIG.STACKS.LIST;
        const params = new URLSearchParams();
        
        if (userId) params.append('user_id', userId);
        
        if (params.toString()) {
            endpoint += `?${params.toString()}`;
        }
        
        return await this.request(endpoint);
    }

    // 获取单个堆叠详情
    async getStack(stackId) {
        return await this.request(`${API_CONFIG.STACKS.GET}/${stackId}/`);
    }

    // 创建新堆叠
    async createStack(stackData) {
        return await this.request(API_CONFIG.STACKS.CREATE, {
            method: 'POST',
            body: JSON.stringify(stackData)
        });
    }

    // 更新堆叠信息
    async updateStack(stackId, stackData) {
        return await this.request(`${API_CONFIG.STACKS.UPDATE}/${stackId}/`, {
            method: 'PUT',
            body: JSON.stringify(stackData)
        });
    }

    // 删除堆叠
    async deleteStack(stackId) {
        return await this.request(`${API_CONFIG.STACKS.DELETE}/${stackId}/`, {
            method: 'DELETE'
        });
    }

    // 获取堆叠内容 (直接从insights表查询)
    async getStackItems(stackId) {
        return await this.request(`${API_CONFIG.INSIGHTS.LIST}?stack_id=${stackId}`);
    }

    // 添加项目到堆叠 (更新insight的stack_id)
    async addItemToStack(stackId, insightId) {
        return await this.request(`${API_CONFIG.INSIGHTS.UPDATE}/${insightId}`, {
            method: 'PUT',
            body: JSON.stringify({
                stack_id: stackId
            })
        });
    }

    // 移动项目到另一个堆叠 (更新insight的stack_id)
    async moveItemToStack(newStackId, insightId) {
        return await this.request(`${API_CONFIG.INSIGHTS.UPDATE}/${insightId}`, {
            method: 'PUT',
            body: JSON.stringify({
                stack_id: newStackId
            })
        });
    }

    // 从堆叠移除项目 (设置stack_id为null)
    async removeItemFromStack(stackId, insightId) {
        return await this.request(`${API_CONFIG.INSIGHTS.UPDATE}/${insightId}`, {
            method: 'PUT',
            body: JSON.stringify({
                stack_id: null
            })
        });
    }

    // 获取用户所有堆叠 (包含insights数据)
    async getUserStacksWithInsights(userId = null) {
        let endpoint = API_CONFIG.STACKS.LIST;
        const params = new URLSearchParams();
        
        if (userId) params.append('user_id', userId);
        params.append('include_insights', 'true');
        
        if (params.toString()) {
            endpoint += `?${params.toString()}`;
        }
        
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

    // 等待列表相关方法
    async joinWaitlist(email) {
        return await this.request(API_CONFIG.WAITLIST.JOIN, {
            method: 'POST',
            body: JSON.stringify({ email })
        });
    }

    async unsubscribeWaitlist(email) {
        return await this.request(API_CONFIG.WAITLIST.UNSUBSCRIBE, {
            method: 'POST',
            body: JSON.stringify({ email })
        });
    }

    async getWaitlistStats() {
        return await this.request(API_CONFIG.WAITLIST.STATS);
    }

    async getWaitlistList(page = 1, limit = 50, status = null) {
        const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
        if (status) params.append('status', status);
        
        return await this.request(`${API_CONFIG.WAITLIST.LIST}?${params.toString()}`);
    }
}

// 创建API实例
export const api = new ApiService();
