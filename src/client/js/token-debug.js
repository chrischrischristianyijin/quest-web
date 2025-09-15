// Token调试工具
// 用于诊断token验证不一致问题

class TokenDebugger {
    constructor() {
        this.debugInfo = {
            frontendToken: null,
            backendValidation: null,
            requestHeaders: null,
            responseStatus: null,
            errorDetails: null
        };
    }

    // 获取前端token状态
    getFrontendTokenStatus() {
        const session = localStorage.getItem('quest_user_session');
        const authToken = localStorage.getItem('authToken');
        
        let tokenInfo = {
            hasSession: !!session,
            hasAuthToken: !!authToken,
            sessionData: null,
            tokenValue: null,
            tokenExpiry: null,
            isValid: false
        };

        if (session) {
            try {
                const parsed = JSON.parse(session);
                tokenInfo.sessionData = parsed;
                tokenInfo.tokenValue = parsed.token;
                
                if (parsed.timestamp) {
                    const now = Date.now();
                    const sessionAge = now - parsed.timestamp;
                    const expirationTime = 7 * 24 * 60 * 60 * 1000; // 7天
                    tokenInfo.tokenExpiry = new Date(parsed.timestamp + expirationTime);
                    tokenInfo.isValid = sessionAge < expirationTime;
                }
            } catch (error) {
                console.error('解析session失败:', error);
            }
        }

        if (authToken) {
            tokenInfo.tokenValue = authToken;
        }

        this.debugInfo.frontendToken = tokenInfo;
        return tokenInfo;
    }

    // 测试后端token验证 - 使用新的token状态API
    async testBackendValidation() {
        const tokenInfo = this.getFrontendTokenStatus();
        
        if (!tokenInfo.tokenValue) {
            return {
                success: false,
                error: 'No token available for testing'
            };
        }

        try {
            console.log('🧪 开始测试后端token验证...');
            
            // 使用新的token状态API
            const apiBaseUrl = 'https://quest-api-edz1.onrender.com';
            const response = await fetch(`${apiBaseUrl}/api/v1/auth/token-status`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${tokenInfo.tokenValue}`,
                    'Content-Type': 'application/json'
                }
            });

            const responseData = {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                body: null
            };

            try {
                responseData.body = await response.json();
            } catch (e) {
                responseData.body = await response.text();
            }

            this.debugInfo.backendValidation = responseData;
            
            return {
                success: response.ok,
                data: responseData
            };

        } catch (error) {
            this.debugInfo.errorDetails = error;
            console.error('❌ 后端验证测试失败:', error);
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 测试refresh_token功能
    async testRefreshToken() {
        const tokenInfo = this.getFrontendTokenStatus();
        
        if (!tokenInfo.sessionData || !tokenInfo.sessionData.refresh_token) {
            return {
                success: false,
                error: 'No refresh_token available for testing'
            };
        }

        try {
            console.log('🔄 开始测试refresh_token功能...');
            
            const apiBaseUrl = 'https://quest-api-edz1.onrender.com';
            const response = await fetch(`${apiBaseUrl}/api/v1/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `refresh_token=${encodeURIComponent(tokenInfo.sessionData.refresh_token)}`
            });

            const responseData = {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                body: null
            };

            try {
                responseData.body = await response.json();
            } catch (e) {
                responseData.body = await response.text();
            }

            return {
                success: response.ok,
                data: responseData
            };

        } catch (error) {
            console.error('❌ Refresh token测试失败:', error);
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 测试token调试API
    async testTokenDebugAPI() {
        const tokenInfo = this.getFrontendTokenStatus();
        
        if (!tokenInfo.tokenValue) {
            return {
                success: false,
                error: 'No token available for testing'
            };
        }

        try {
            console.log('🔍 开始测试token调试API...');
            
            const apiBaseUrl = 'https://quest-api-edz1.onrender.com';
            const response = await fetch(`${apiBaseUrl}/api/v1/auth/debug-token`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${tokenInfo.tokenValue}`,
                    'Content-Type': 'application/json'
                }
            });

            const responseData = {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                body: null
            };

            try {
                responseData.body = await response.json();
            } catch (e) {
                responseData.body = await response.text();
            }

            return {
                success: response.ok,
                data: responseData
            };

        } catch (error) {
            console.error('❌ Token调试API测试失败:', error);
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 检查token传输 - 简化版本，避免模块依赖
    async checkTokenTransmission() {
        const tokenInfo = this.getFrontendTokenStatus();
        
        if (!tokenInfo.tokenValue) {
            return {
                success: false,
                error: 'No token to transmit'
            };
        }

        try {
            // 直接构建请求，避免模块依赖
            const apiBaseUrl = 'https://quest-api-edz1.onrender.com';
            const testRequest = {
                url: `${apiBaseUrl}/api/v1/user/profile`,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${tokenInfo.tokenValue}`,
                    'Content-Type': 'application/json'
                }
            };

            this.debugInfo.requestHeaders = testRequest.headers;
            
            return {
                success: true,
                request: testRequest
            };

        } catch (error) {
            console.error('❌ Token传输检查失败:', error);
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 生成完整的调试报告
    async generateDebugReport() {
        console.log('🔍 开始生成Token调试报告...');
        
        const frontendStatus = this.getFrontendTokenStatus();
        const backendTest = await this.testBackendValidation();
        const debugAPITest = await this.testTokenDebugAPI();
        const transmissionTest = await this.checkTokenTransmission();
        const refreshTokenTest = await this.testRefreshToken();
        
        const report = {
            timestamp: new Date().toISOString(),
            frontend: frontendStatus,
            backend: backendTest,
            debugAPI: debugAPITest,
            transmission: transmissionTest,
            refreshToken: refreshTokenTest,
            recommendations: []
        };

        // 分析问题并提供建议
        if (!frontendStatus.hasSession && !frontendStatus.hasAuthToken) {
            report.recommendations.push('❌ 没有找到任何token，需要重新登录');
        } else if (frontendStatus.hasSession && !frontendStatus.isValid) {
            report.recommendations.push('⚠️ Session已过期，需要刷新token或重新登录');
        } else if (backendTest.success === false) {
            if (backendTest.data?.status === 401) {
                report.recommendations.push('🔐 后端返回401，token可能无效或被撤销');
            } else if (backendTest.data?.status === 403) {
                report.recommendations.push('🚫 后端返回403，token权限不足');
            } else {
                report.recommendations.push('🌐 后端验证失败，可能是网络或服务器问题');
            }
        } else if (backendTest.success === true) {
            report.recommendations.push('✅ Token验证正常，问题可能在其他地方');
            
            // 如果token状态API可用，提供更详细的建议
            if (debugAPITest.success && debugAPITest.data?.body?.success) {
                const tokenData = debugAPITest.data.body.data;
                if (tokenData.is_expired) {
                    report.recommendations.push('⏰ Token已过期，需要刷新或重新登录');
                } else if (tokenData.hours_remaining < 1) {
                    report.recommendations.push('⚠️ Token即将过期（1小时内），建议刷新');
                } else {
                    report.recommendations.push(`✅ Token有效，剩余时间：${tokenData.hours_remaining}小时${tokenData.minutes_remaining}分钟`);
                }
            }
        }

        // 检查refresh_token状态
        if (refreshTokenTest.success) {
            report.recommendations.push('✅ Refresh token功能正常');
        } else if (refreshTokenTest.error === 'No refresh_token available for testing') {
            report.recommendations.push('⚠️ 没有refresh_token，无法自动刷新token');
        } else {
            report.recommendations.push('❌ Refresh token功能异常，可能需要重新登录');
        }

        console.log('📊 Token调试报告:', report);
        return report;
    }

    // 快速诊断
    async quickDiagnosis() {
        console.log('🚀 开始快速Token诊断...');
        
        const frontendStatus = this.getFrontendTokenStatus();
        console.log('📱 前端Token状态:', frontendStatus);
        
        if (!frontendStatus.tokenValue) {
            console.log('❌ 问题：没有token');
            return 'NO_TOKEN';
        }
        
        const backendTest = await this.testBackendValidation();
        console.log('🔧 后端验证结果:', backendTest);
        
        if (backendTest.success) {
            console.log('✅ Token验证正常');
            return 'TOKEN_VALID';
        } else {
            console.log('❌ Token验证失败:', backendTest.error || backendTest.data);
            return 'TOKEN_INVALID';
        }
    }
}

// 创建全局调试实例
window.tokenDebugger = new TokenDebugger();

// 添加便捷方法到控制台
window.debugToken = () => window.tokenDebugger.quickDiagnosis();
window.tokenReport = () => window.tokenDebugger.generateDebugReport();
window.testRefreshToken = () => window.tokenDebugger.testRefreshToken();

// 导出调试器实例供模块使用
export const tokenDebugger = window.tokenDebugger;

console.log('🔧 Token调试工具已加载');
console.log('💡 使用方法:');
console.log('  - debugToken() - 快速诊断');
console.log('  - tokenReport() - 完整报告');
console.log('  - testRefreshToken() - 测试refresh_token功能');
console.log('  - window.tokenDebugger - 访问调试器实例');
