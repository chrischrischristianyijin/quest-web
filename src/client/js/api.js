import { CONFIG, API_ENDPOINTS } from './config.js';
import { corsProxy } from './cors-proxy.js';

// API 服务类
class ApiService {
    constructor() {
        this.baseUrl = CONFIG.API_BASE_URL;
        this.useCorsProxy = false; // 默认不使用代理
    }

    // 获取认证 token
    getAuthToken() {
        return localStorage.getItem('authToken');
    }

    // 设置认证 token
    setAuthToken(token) {
        if (token) {
            localStorage.setItem('authToken', token);
        } else {
            localStorage.removeItem('authToken');
        }
    }

    // 通用请求方法
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        // 添加认证头
        const token = this.getAuthToken();
        console.log('🔑 当前认证 token:', token ? `${token.substring(0, 20)}...` : '无');
        console.log('🔑 Token 长度:', token ? token.length : 0);
        
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
            console.log('✅ Authorization 头已设置');
        } else {
            console.log('❌ 没有 token，无法设置 Authorization 头');
        }

        try {
            let response;
            
            if (this.useCorsProxy) {
                // 使用 CORS 代理
                console.log('🔄 使用 CORS 代理发送请求...');
                response = await corsProxy.smartRequest(url, config);
            } else {
                // 尝试直接请求
                console.log('🔄 尝试直接发送请求...');
                response = await fetch(url, config);
            }
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API 请求错误:', error);
            
            // 如果是 CORS 错误，自动启用代理
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                console.log('🔄 检测到 CORS 错误，自动启用代理...');
                this.useCorsProxy = true;
                
                try {
                    const response = await corsProxy.smartRequest(url, config);
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.message || `HTTP ${response.status}`);
                    }
                    return await response.json();
                } catch (proxyError) {
                    console.error('CORS 代理也失败了:', proxyError);
                    throw proxyError;
                }
            }
            
            throw error;
        }
    }

    // 用户登录
    async login(credentials) {
        try {
            console.log('🔐 发送登录请求:', credentials);
            const response = await this.request(API_ENDPOINTS.AUTH.LOGIN, {
                method: 'POST',
                body: JSON.stringify(credentials)
            });
            
            console.log('📡 登录 API 原始响应:', response);
            
            // 转换后端格式到前端期望格式
            if (response && response.success && response.data) {
                return {
                    user: {
                        id: response.data.user_id,
                        email: credentials.email,
                        // 注意：后端没有返回完整的用户信息，只有 user_id
                        // 需要后续调用 profile API 获取完整信息
                    },
                    token: response.data.access_token
                };
            } else {
                throw new Error(response?.message || '登录失败');
            }
        } catch (error) {
            console.error('❌ 登录 API 调用失败:', error);
            throw error;
        }
    }

    // 用户注册
    async signup(userData) {
        try {
            console.log('📝 发送注册请求:', userData);
            const response = await this.request(API_ENDPOINTS.AUTH.REGISTER, {
                method: 'POST',
                body: JSON.stringify(userData)
            });
            
            console.log('📡 注册 API 原始响应:', response);
            
            // 转换后端格式到前端期望格式
            if (response && response.success && response.data) {
                return {
                    user: response.data,
                    token: response.data.access_token || null
                };
            } else {
                throw new Error(response?.message || '注册失败');
            }
        } catch (error) {
            console.error('❌ 注册 API 调用失败:', error);
            throw error;
        }
    }

    async logout() {
        try {
            await this.request(API_ENDPOINTS.AUTH.LOGOUT, {
                method: 'POST'
            });
        } finally {
            this.setAuthToken(null);
            localStorage.removeItem('quest_user_session');
        }
    }

    // 用户相关
    async getUserProfile() {
        return this.request(API_ENDPOINTS.AUTH.PROFILE);
    }

    // 见解相关
    async getInsights(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `${API_ENDPOINTS.INSIGHTS.LIST}?${queryString}` : API_ENDPOINTS.INSIGHTS.LIST;
        return this.request(endpoint);
    }

    async createInsight(insightData) {
        return this.request(API_ENDPOINTS.INSIGHTS.CREATE, {
            method: 'POST',
            body: JSON.stringify(insightData)
        });
    }

    async createInsightFromUrl(insightData) {
        return this.request(API_ENDPOINTS.METADATA.CREATE_INSIGHT, {
            method: 'POST',
            body: JSON.stringify(insightData)
        });
    }

    async deleteInsight(id) {
        return this.request(API_ENDPOINTS.INSIGHTS.DELETE(id), {
            method: 'DELETE'
        });
    }

    // 标签相关
    async getUserTags() {
        return this.request(API_ENDPOINTS.TAGS.LIST);
    }

    async createTag(tagData) {
        return this.request(API_ENDPOINTS.TAGS.CREATE, {
            method: 'POST',
            body: JSON.stringify(tagData)
        });
    }

    async updateTag(id, tagData) {
        return this.request(API_ENDPOINTS.TAGS.UPDATE(id), {
            method: 'PUT',
            body: JSON.stringify(tagData)
        });
    }

    async deleteTag(id) {
        return this.request(API_ENDPOINTS.TAGS.DELETE(id), {
            method: 'DELETE'
        });
    }

    // 元数据相关
    async extractMetadata(url) {
        try {
            const formData = new URLSearchParams();
            formData.append('url', url);
            
            return await this.request(API_ENDPOINTS.METADATA.EXTRACT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData.toString()
            });
        } catch (error) {
            // 返回默认元数据
            return {
                success: true,
                data: {
                    title: new URL(url).hostname,
                    description: `Content from ${new URL(url).hostname}`,
                    image_url: ''
                }
            };
        }
    }

    async batchExtractMetadata(urls) {
        return this.request(API_ENDPOINTS.METADATA.BATCH_EXTRACT, {
            method: 'POST',
            body: JSON.stringify({ urls })
        });
    }

    async previewInsight(insightId) {
        return this.request(API_ENDPOINTS.METADATA.PREVIEW(insightId));
    }
}

// 创建全局 API 实例
export const api = new ApiService();
