/**
 * Secure Token Debug Tool
 * Only loads and exposes debugging functions in development environment
 */

// Use compatible logger from global scope
const logger = window.logger || {
    error: (...args) => console.error(...args),
    warn: (...args) => console.warn(...args),
    debug: (...args) => {},
    info: (...args) => {},
    success: (...args) => {},
    security: (...args) => console.warn('SECURITY:', ...args)
};

// Environment detection without imports
function detectEnvironment() {
    const hostname = window.location.hostname;
    return {
        IS_LOCAL: hostname === 'localhost' || 
                 hostname === '127.0.0.1' || 
                 hostname.startsWith('192.168.') ||
                 hostname.startsWith('10.') ||
                 hostname.endsWith('.local'),
        BASE_URL: hostname === 'localhost' || 
                 hostname === '127.0.0.1' || 
                 hostname.startsWith('192.168.') ||
                 hostname.startsWith('10.') ||
                 hostname.endsWith('.local') 
                 ? 'http://localhost:8000' 
                 : 'https://quest-api-edz1.onrender.com'
    };
}

const ENV_CONFIG = detectEnvironment();
const CONFIG = {
    DEBUG: {
        ENABLED: ENV_CONFIG.IS_LOCAL,
        TOKEN_DEBUG: ENV_CONFIG.IS_LOCAL,
        VERBOSE_LOGGING: ENV_CONFIG.IS_LOCAL,
        CONSOLE_TOOLS: ENV_CONFIG.IS_LOCAL
    }
};

// Only proceed if debugging is enabled
if (!CONFIG.DEBUG.TOKEN_DEBUG) {
    logger.security('Token debug tools disabled in production');
    // Set empty debugger in global scope
    window.tokenDebugger = null;
} else {
    logger.debug('Loading token debug tools in development mode');

    class TokenDebugger {
        constructor() {
            this.debugInfo = {
                frontendToken: null,
                backendValidation: null,
                requestHeaders: null,
                responseStatus: null,
                errorDetails: null
            };
            logger.debug('TokenDebugger initialized');
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
                    logger.error('解析session失败:', error);
                }
            }

            if (authToken) {
                tokenInfo.tokenValue = authToken;
            }

            this.debugInfo.frontendToken = tokenInfo;
            return tokenInfo;
        }

        // 测试后端token验证
        async testBackendValidation() {
            const tokenInfo = this.getFrontendTokenStatus();
            
            if (!tokenInfo.tokenValue) {
                return {
                    success: false,
                    error: 'No token available for testing'
                };
            }

            try {
                logger.debug('开始测试后端token验证...');
                
                const apiBaseUrl = ENV_CONFIG.BASE_URL;
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

                // Clone the response to avoid "body stream already read" error
                const responseClone = response.clone();
                try {
                    responseData.body = await response.json();
                } catch (e) {
                    try {
                        responseData.body = await responseClone.text();
                    } catch (textError) {
                        responseData.body = `Error reading response: ${textError.message}`;
                    }
                }

                this.debugInfo.backendValidation = responseData;
                
                return {
                    success: response.ok,
                    data: responseData
                };

            } catch (error) {
                this.debugInfo.errorDetails = error;
                logger.error('后端验证测试失败:', error);
                
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
                logger.debug('开始测试refresh_token功能...');
                
                const apiBaseUrl = ENV_CONFIG.BASE_URL;
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

                // Clone the response to avoid "body stream already read" error
                const responseClone = response.clone();
                try {
                    responseData.body = await response.json();
                } catch (e) {
                    try {
                        responseData.body = await responseClone.text();
                    } catch (textError) {
                        responseData.body = `Error reading response: ${textError.message}`;
                    }
                }

                return {
                    success: response.ok,
                    data: responseData
                };

            } catch (error) {
                logger.error('Refresh token测试失败:', error);
                
                return {
                    success: false,
                    error: error.message
                };
            }
        }

        // 快速诊断
        async quickDiagnosis() {
            logger.debug('开始快速Token诊断...');
            
            const frontendStatus = this.getFrontendTokenStatus();
            logger.debug('前端Token状态:', frontendStatus);
            
            if (!frontendStatus.tokenValue) {
                logger.warn('问题：没有token');
                return 'NO_TOKEN';
            }
            
            const backendTest = await this.testBackendValidation();
            logger.debug('后端验证结果:', backendTest);
            
            if (backendTest.success) {
                logger.success('Token验证正常');
                return 'TOKEN_VALID';
            } else {
                logger.error('Token验证失败:', backendTest.error || backendTest.data);
                return 'TOKEN_INVALID';
            }
        }

        // 生成完整的调试报告
        async generateDebugReport() {
            logger.debug('开始生成Token调试报告...');
            
            const frontendStatus = this.getFrontendTokenStatus();
            const backendTest = await this.testBackendValidation();
            const refreshTokenTest = await this.testRefreshToken();
            
            const report = {
                timestamp: new Date().toISOString(),
                frontend: frontendStatus,
                backend: backendTest,
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
            }

            // 检查refresh_token状态
            if (refreshTokenTest.success) {
                report.recommendations.push('✅ Refresh token功能正常');
            } else if (refreshTokenTest.error === 'No refresh_token available for testing') {
                report.recommendations.push('⚠️ 没有refresh_token，无法自动刷新token');
            } else {
                report.recommendations.push('❌ Refresh token功能异常，可能需要重新登录');
            }

            logger.debug('Token调试报告:', report);
            return report;
        }
    }

    // Create debugger instance only in development
    const tokenDebugger = new TokenDebugger();

    // Only expose to window in development
    if (CONFIG.DEBUG.CONSOLE_TOOLS) {
        window.tokenDebugger = tokenDebugger;
        
        // Add便捷方法到控制台
        window.debugToken = () => tokenDebugger.quickDiagnosis();
        window.tokenReport = () => tokenDebugger.generateDebugReport();
        window.testRefreshToken = () => tokenDebugger.testRefreshToken();

        logger.debug('Token调试工具已加载到控制台');
        logger.debug('使用方法:');
        logger.debug('  - debugToken() - 快速诊断');
        logger.debug('  - tokenReport() - 完整报告');
        logger.debug('  - testRefreshToken() - 测试refresh_token功能');
    }

    // Set in global scope for compatibility
    window.tokenDebugger = tokenDebugger;
}
