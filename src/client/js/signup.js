import { auth } from './auth.js';

// DOM 元素
const signupForm = document.getElementById('signupForm');
const emailInput = document.getElementById('email');
const nicknameInput = document.getElementById('nickname');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');
const googleSignupBtn = document.getElementById('googleSignupBtn');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');

// 显示消息
function showMessage(message, type = 'error') {
    if (type === 'error') {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        successMessage.style.display = 'none';
    } else {
        successMessage.textContent = message;
        successMessage.style.display = 'block';
        errorMessage.style.display = 'none';
    }
}

// 隐藏消息
function hideMessages() {
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
}

// 表单验证
function validateForm() {
    const email = emailInput.value.trim();
    const nickname = nicknameInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    
    if (!email) {
        showMessage('请输入邮箱地址');
        emailInput.focus();
        return false;
    }
    
    if (!nickname) {
        showMessage('请输入昵称');
        nicknameInput.focus();
        return false;
    }
    
    if (!password) {
        showMessage('请输入密码');
        passwordInput.focus();
        return false;
    }
    
    if (password.length < 8) {
        showMessage('密码至少需要8个字符');
        passwordInput.focus();
        return false;
    }
    
    if (password !== confirmPassword) {
        showMessage('两次输入的密码不一致');
        confirmPasswordInput.focus();
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

// 处理注册
async function handleSignup(email, nickname, password) {
    try {
        console.log('开始注册流程...');
        console.log('注册数据:', { email, nickname, password: '***' });
        
        const result = await auth.signup(email, nickname, password);
        console.log('注册结果:', result);
        
        if (result.success) {
            showMessage('注册成功！正在跳转...', 'success');
            
            // 注册成功，重定向到My Space页面
            console.log('✅ 注册成功，重定向到My Space页面');
            window.location.href = '/my-space';
        }
    } catch (error) {
        console.error('注册失败:', error);
        console.error('错误详情:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        showMessage(error.message || '注册失败，请重试');
    }
}

// 处理 Google 注册
function handleGoogleSignup() {
    try {
        // 跳转到 Google OAuth 端点
        const authUrl = `https://quest-api-edz1.onrender.com/api/v1/auth/google/login`;
        window.location.href = authUrl;
    } catch (error) {
        console.error('Google 注册失败:', error);
        showMessage('Google 注册失败，请重试');
    }
}

// 事件监听器
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
        return;
    }
    
    const email = emailInput.value.trim();
    const nickname = nicknameInput.value.trim();
    const password = passwordInput.value;
    
    // 禁用表单
    const submitBtn = signupForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '注册中...';
    
    try {
        await handleSignup(email, nickname, password);
    } finally {
        // 恢复表单
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
});

googleSignupBtn.addEventListener('click', handleGoogleSignup);

// 输入时隐藏消息
emailInput.addEventListener('input', hideMessages);
nicknameInput.addEventListener('input', hideMessages);
passwordInput.addEventListener('input', hideMessages);
confirmPasswordInput.addEventListener('input', hideMessages);

// 页面加载时检查认证状态
document.addEventListener('DOMContentLoaded', () => {
    // 如果用户已经登录，直接跳转
    if (auth.checkAuth()) {
        window.location.href = '/my-space';
    }
    
    // 聚焦到邮箱输入框
    emailInput.focus();
});
