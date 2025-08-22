import { CONFIG, API_ENDPOINTS } from './config.js';

// API 服务类
class ApiService {
    constructor() {
        this.baseUrl = CONFIG.API_BASE_URL;
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
    async request(url, config = {}) {
        const finalConfig = {
            headers: {
                'Content-Type': 'application/json',
                ...config.headers
            },
            ...config
        };

        // 如果是FormData，不设置Content-Type，让浏览器自动处理
        if (config.body instanceof FormData) {
            delete finalConfig.headers['Content-Type'];
            console.log('📤 检测到FormData，移除Content-Type头');
        }

        // 添加认证头
        const token = this.getAuthToken();
        if (token) {
            finalConfig.headers['Authorization'] = `Bearer ${token}`;
            console.log('🔐 添加认证头');
        }

        console.log('📡 发送请求:', {
            url,
            method: finalConfig.method || 'GET',
            headers: finalConfig.headers,
            body: config.body instanceof FormData ? 'FormData' : config.body
        });

        try {
            const response = await fetch(url, finalConfig);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API 请求错误:', error);
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

    // 从URL创建insight（两步合一）
    async createInsightFromUrl(data) {
        console.log('🔗 调用createInsightFromUrl API:', data);
        
        const formData = new FormData();
        formData.append('url', data.url);
        
        // 根据API文档，使用正确的字段名
        if (data.tags) {
            // 将标签转换为数组格式
            const tagArray = data.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
            if (tagArray.length > 0) {
                formData.append('custom_tags', JSON.stringify(tagArray));
            }
        }
        
        // 添加调试信息
        console.log('📤 发送的FormData内容:');
        for (let [key, value] of formData.entries()) {
            console.log(`${key}:`, value);
        }
        
        try {
            console.log('🌐 完整API URL:', `${this.baseUrl}/api/v1/metadata/create-insight`);
            console.log('🔑 当前token:', this.getAuthToken() ? '存在' : '不存在');
            
            const response = await this.request(`${this.baseUrl}/api/v1/metadata/create-insight`, {
                method: 'POST',
                body: formData
            });
            
            console.log('✅ createInsightFromUrl 成功:', response);
            return response;
        } catch (error) {
            console.error('❌ createInsightFromUrl 失败:', error);
            
            // 添加更详细的错误信息
            if (error.message.includes('422')) {
                console.error('📋 422错误详情 - 请求格式问题');
                console.error('📤 发送的数据:', {
                    url: data.url,
                    tags: data.tags,
                    formDataEntries: Array.from(formData.entries())
                });
            }
            
            throw error;
        }
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
