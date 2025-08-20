// CORS 代理解决方案
// 提供多种绕过 CORS 限制的方法

export class CorsProxy {
    constructor() {
        this.proxyServices = [
            'https://cors-anywhere.herokuapp.com/',
            'https://api.allorigins.win/raw?url=',
            'https://cors.bridged.cc/',
            'https://thingproxy.freeboard.io/fetch/'
        ];
        this.currentProxyIndex = 0;
    }

    // 方法 1: 使用公共 CORS 代理
    async fetchWithProxy(url, options = {}) {
        const proxyUrl = this.proxyServices[this.currentProxyIndex] + url;
        
        try {
            console.log(`🔄 尝试使用代理: ${this.proxyServices[this.currentProxyIndex]}`);
            
            const response = await fetch(proxyUrl, {
                ...options,
                headers: {
                    ...options.headers,
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            
            if (response.ok) {
                console.log('✅ 代理请求成功');
                return response;
            } else {
                throw new Error(`代理请求失败: ${response.status}`);
            }
        } catch (error) {
            console.error(`❌ 代理 ${this.currentProxyIndex + 1} 失败:`, error);
            
            // 尝试下一个代理
            this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxyServices.length;
            
            if (this.currentProxyIndex === 0) {
                throw new Error('所有代理服务都失败了');
            }
            
            // 递归尝试下一个代理
            return this.fetchWithProxy(url, options);
        }
    }

    // 方法 2: 使用 JSONP 方式（仅适用于 GET 请求）
    jsonpRequest(url, callbackName = 'jsonpCallback') {
        return new Promise((resolve, reject) => {
            // 创建全局回调函数
            window[callbackName] = (data) => {
                resolve(data);
                // 清理
                document.head.removeChild(script);
                delete window[callbackName];
            };

            // 创建 script 标签
            const script = document.createElement('script');
            const separator = url.includes('?') ? '&' : '?';
            script.src = `${url}${separator}callback=${callbackName}`;
            
            // 设置超时
            const timeout = setTimeout(() => {
                reject(new Error('JSONP 请求超时'));
                document.head.removeChild(script);
                delete window[callbackName];
            }, 10000);

            // 处理加载错误
            script.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('JSONP 脚本加载失败'));
                document.head.removeChild(script);
                delete window[callbackName];
            };

            // 添加到页面
            document.head.appendChild(script);
        });
    }

    // 方法 3: 使用 iframe 通信（适用于简单请求）
    iframeRequest(url, data) {
        return new Promise((resolve, reject) => {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = 'about:blank';
            
            document.body.appendChild(iframe);
            
            const iframeWindow = iframe.contentWindow;
            
            // 监听消息
            const messageHandler = (event) => {
                if (event.source === iframeWindow) {
                    window.removeEventListener('message', messageHandler);
                    document.body.removeChild(iframe);
                    resolve(event.data);
                }
            };
            
            window.addEventListener('message', messageHandler);
            
            // 设置超时
            setTimeout(() => {
                window.removeEventListener('message', messageHandler);
                document.body.removeChild(iframe);
                reject(new Error('iframe 请求超时'));
            }, 10000);
            
            // 发送请求
            iframeWindow.postMessage({
                type: 'fetch',
                url: url,
                data: data
            }, '*');
        });
    }

    // 方法 4: 使用 Service Worker 代理（需要 HTTPS）
    async setupServiceWorkerProxy() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw-proxy.js');
                console.log('✅ Service Worker 代理已注册');
                return registration;
            } catch (error) {
                console.error('❌ Service Worker 代理注册失败:', error);
                return null;
            }
        }
        return null;
    }

    // 方法 5: 使用 WebSocket 代理（适用于实时通信）
    websocketProxy(url, data) {
        return new Promise((resolve, reject) => {
            // 将 HTTP URL 转换为 WebSocket URL
            const wsUrl = url.replace(/^https?:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
            
            const ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
                ws.send(JSON.stringify({
                    type: 'http_request',
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: data
                }));
            };
            
            ws.onmessage = (event) => {
                try {
                    const response = JSON.parse(event.data);
                    ws.close();
                    resolve(response);
                } catch (error) {
                    reject(error);
                }
            };
            
            ws.onerror = (error) => {
                reject(error);
            };
            
            // 设置超时
            setTimeout(() => {
                ws.close();
                reject(new Error('WebSocket 请求超时'));
            }, 10000);
        });
    }

    // 智能选择最佳方法
    async smartRequest(url, options = {}) {
        console.log('🧠 智能选择最佳 CORS 绕过方法...');
        
        // 方法 1: 尝试直接请求（可能成功）
        try {
            console.log('🔄 尝试直接请求...');
            const response = await fetch(url, options);
            console.log('✅ 直接请求成功，无需 CORS 绕过');
            return response;
        } catch (error) {
            console.log('❌ 直接请求失败，尝试 CORS 绕过方法');
        }
        
        // 方法 2: 使用代理服务
        try {
            console.log('🔄 尝试使用 CORS 代理...');
            return await this.fetchWithProxy(url, options);
        } catch (error) {
            console.log('❌ CORS 代理失败');
        }
        
        // 方法 3: 如果是 GET 请求，尝试 JSONP
        if (options.method === 'GET' || !options.method) {
            try {
                console.log('🔄 尝试使用 JSONP...');
                return await this.jsonpRequest(url);
            } catch (error) {
                console.log('❌ JSONP 失败');
            }
        }
        
        // 方法 4: 尝试 iframe 通信
        try {
            console.log('🔄 尝试使用 iframe 通信...');
            return await this.iframeRequest(url, options.body);
        } catch (error) {
            console.log('❌ iframe 通信失败');
        }
        
        throw new Error('所有 CORS 绕过方法都失败了');
    }
}

// 创建全局实例
export const corsProxy = new CorsProxy();
