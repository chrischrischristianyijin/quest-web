import { auth } from './auth.js';

// DOM 元素
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const messageDiv = document.getElementById('message');

// 显示消息
function showMessage(message, type = 'error') {
    if (!messageDiv) {
        console.error('❌ 找不到消息显示元素');
        return;
    }
    
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    // 自动隐藏错误消息
    if (type === 'error') {
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }
}

// 隐藏消息
function hideMessages() {
    if (messageDiv) {
        messageDiv.style.display = 'none';
    }
}

// 表单验证
function validateForm() {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    if (!email) {
        showMessage('请输入邮箱地址');
        emailInput.focus();
        return false;
    }
    
    if (!password) {
        showMessage('请输入密码');
        passwordInput.focus();
        return false;
    }
    
    // 简单的邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showMessage('请输入有效的邮箱地址');
        emailInput.focus();
        return false;
    }
    
    return true;
}

// 处理登录
async function handleLogin(email, password) {
    try {
        const result = await auth.login(email, password);
        
        if (result && result.success) {
            showMessage('登录成功！正在跳转...', 'success');
            
            // 延迟跳转，让用户看到成功消息
            setTimeout(() => {
                // 登录成功，重定向到My Space页面
                console.log('✅ 登录成功，重定向到My Space页面');
                window.location.href = '/my-space';
            }, 1000);
        } else {
            // 登录失败，显示错误消息
            const errorMsg = result ? result.message : '登录失败，请重试';
            showMessage(errorMsg);
        }
    } catch (error) {
        console.error('登录失败:', error);
        showMessage(error.message || '登录失败，请检查邮箱和密码');
    }
}

// 处理 Google 登录
function handleGoogleLogin() {
    try {
        // 跳转到 Google OAuth 端点
        const authUrl = `https://quest-api-edz1.onrender.com/api/v1/auth/google/login`;
        window.location.href = authUrl;
    } catch (error) {
        console.error('Google 登录失败:', error);
        showMessage('Google 登录失败，请重试');
    }
}

// 事件监听器
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
        return;
    }
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    // 禁用表单
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '登录中...';
    
    try {
        await handleLogin(email, password);
    } finally {
        // 恢复表单
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
});

googleLoginBtn.addEventListener('click', handleGoogleLogin);

// 输入时隐藏消息
emailInput.addEventListener('input', hideMessages);
passwordInput.addEventListener('input', hideMessages);

// 页面加载时检查认证状态
document.addEventListener('DOMContentLoaded', () => {
    // 如果用户已经登录，直接跳转
    if (auth.checkAuth()) {
                        window.location.href = '/my-space';
    }
    
    // 聚焦到邮箱输入框
    emailInput.focus();
});
