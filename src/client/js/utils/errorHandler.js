// 统一错误处理工具
class ErrorHandler {
    constructor() {
        this.errorContainer = null;
        this.init();
    }

    // 初始化错误处理
    init() {
        this.createErrorContainer();
        this.bindGlobalErrors();
    }

    // 创建错误显示容器
    createErrorContainer() {
        // 检查是否已存在
        if (document.getElementById('error-container')) {
            this.errorContainer = document.getElementById('error-container');
            return;
        }

        const container = document.createElement('div');
        container.id = 'error-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            max-width: 400px;
            display: none;
        `;
        
        document.body.appendChild(container);
        this.errorContainer = container;
    }

    // 绑定全局错误处理
    bindGlobalErrors() {
        window.addEventListener('error', (event) => {
            this.handleError(event.error || new Error(event.message));
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(event.reason);
        });
    }

    // 处理错误
    handleError(error, options = {}) {
        console.error('Error handled:', error);

        const {
            title = 'Error',
            message = error.message || 'An unexpected error occurred',
            type = 'error', // 'error', 'warning', 'success'
            duration = 5000,
            showNotification = true
        } = options;

        if (showNotification) {
            this.showNotification(title, message, type, duration);
        }

        // 可以在这里添加错误上报逻辑
        this.reportError(error);
    }

    // 显示通知
    showNotification(title, message, type = 'error', duration = 5000) {
        if (!this.errorContainer) return;

        const notification = document.createElement('div');
        notification.className = `error-notification ${type}`;
        notification.style.cssText = `
            background: ${this.getBackgroundColor(type)};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            margin-bottom: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transform: translateX(100%);
            transition: transform 0.3s ease;
            cursor: pointer;
        `;

        notification.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px;">${title}</div>
            <div style="font-size: 14px;">${message}</div>
        `;

        this.errorContainer.appendChild(notification);
        this.errorContainer.style.display = 'block';

        // 显示动画
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);

        // 点击关闭
        notification.addEventListener('click', () => {
            this.hideNotification(notification);
        });

        // 自动关闭
        if (duration > 0) {
            setTimeout(() => {
                this.hideNotification(notification);
            }, duration);
        }
    }

    // 隐藏通知
    hideNotification(notification) {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            
            // 如果没有更多通知，隐藏容器
            if (this.errorContainer && this.errorContainer.children.length === 0) {
                this.errorContainer.style.display = 'none';
            }
        }, 300);
    }

    // 获取背景颜色
    getBackgroundColor(type) {
        switch (type) {
            case 'success':
                return '#4CAF50';
            case 'warning':
                return '#FF9800';
            case 'error':
            default:
                return '#F44336';
        }
    }

    // 错误上报
    reportError(error) {
        // 这里可以集成错误上报服务，如 Sentry
        console.log('Error reported:', {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent
        });
    }

    // API错误处理
    handleApiError(response, options = {}) {
        const { showNotification = true } = options;
        
        let message = 'An error occurred while processing your request';
        
        if (response.status === 401) {
            message = 'Please log in to continue';
        } else if (response.status === 403) {
            message = 'You do not have permission to perform this action';
        } else if (response.status === 404) {
            message = 'The requested resource was not found';
        } else if (response.status === 500) {
            message = 'Server error. Please try again later';
        }

        this.handleError(new Error(message), {
            title: 'Request Failed',
            message,
            type: 'error',
            showNotification
        });

        return message;
    }

    // 网络错误处理
    handleNetworkError(error, options = {}) {
        const message = 'Network error. Please check your connection and try again.';
        
        this.handleError(error, {
            title: 'Network Error',
            message,
            type: 'error',
            ...options
        });

        return message;
    }

    // 验证错误处理
    handleValidationError(errors, options = {}) {
        const message = Array.isArray(errors) 
            ? errors.join(', ')
            : 'Please check your input and try again';

        this.handleError(new Error(message), {
            title: 'Validation Error',
            message,
            type: 'warning',
            ...options
        });

        return message;
    }
}

// 创建全局错误处理实例
const errorHandler = new ErrorHandler();

// 导出错误处理实例和类
export { errorHandler, ErrorHandler }; 