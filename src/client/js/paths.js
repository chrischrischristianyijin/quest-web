// Quest 应用路径配置
// 统一管理所有页面跳转路径，避免硬编码

export const PATHS = {
    // 主要页面
    HOME: '/',
    LOGIN: '/login',
    SIGNUP: '/signup',
    MY_SPACE: '/my-space',
    
    // 静态资源
    STYLES: '/styles',
    JS: '/js',
    PUBLIC: '/public',
    
    // API相关
    API_BASE: '/api/v1',
    
    // 其他页面
    ABOUT: '/about',
    HELP: '/help',
    PRIVACY: '/privacy',
    TERMS: '/terms'
};

// 页面跳转函数
export const navigateTo = (path) => {
    window.location.href = path;
};

// 页面跳转函数（带确认）
export const navigateToWithConfirm = (path, message = '确定要跳转吗？') => {
    if (confirm(message)) {
        navigateTo(path);
    }
};

// 延迟跳转函数
export const navigateToWithDelay = (path, delay = 1000) => {
    setTimeout(() => {
        navigateTo(path);
    }, delay);
};

// 获取完整URL
export const getFullUrl = (path) => {
    return window.location.origin + path;
};

// 检查当前页面
export const isCurrentPage = (path) => {
    return window.location.pathname === path;
};

// 获取当前页面路径
export const getCurrentPath = () => {
    return window.location.pathname;
};
