import { auth } from './auth.js';
import { api } from './api.js'; // Added import for api

// DOM 元素
const signupForm = document.getElementById('signupForm');
const emailInput = document.getElementById('email');
const nicknameInput = document.getElementById('nickname');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');
const googleSignupBtn = document.getElementById('googleSignupBtn');
const emailCheckBtn = document.getElementById('emailCheckBtn');
const emailStatus = document.getElementById('emailStatus');
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

// 检查邮箱是否可用
async function checkEmailAvailability() {
    const email = emailInput.value.trim();
    
    if (!email) {
        showEmailStatus('请输入邮箱地址', 'error');
        return;
    }
    
    // 简单的邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showEmailStatus('请输入有效的邮箱地址', 'error');
        return;
    }
    
    try {
        // 显示检查中状态
        emailCheckBtn.disabled = true;
        emailCheckBtn.innerHTML = '<svg class="loading-spinner" width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.416" stroke-dashoffset="31.416"><animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/><animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/></circle></svg> 检查中...';
        
        const result = await api.checkEmail({ email });
        
        if (result.data && result.data.exists) {
            showEmailStatus('该邮箱已被注册，请使用其他邮箱或直接登录', 'error');
        } else {
            showEmailStatus('✅ 该邮箱可用', 'success');
        }
    } catch (error) {
        console.error('邮箱检查失败:', error);
        showEmailStatus('邮箱检查失败，请重试', 'error');
    } finally {
        // 恢复按钮状态
        emailCheckBtn.disabled = false;
        emailCheckBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.93 6.64 2.47M21 12l-3-3m3 3l-3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> 检查';
    }
}

// 显示邮箱状态
function showEmailStatus(message, type = 'info') {
    emailStatus.textContent = message;
    emailStatus.className = `email-status email-status-${type}`;
    emailStatus.style.display = 'block';
    
    // 3秒后自动隐藏
    setTimeout(() => {
        emailStatus.style.display = 'none';
    }, 3000);
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
        
        // 先检查邮箱是否已被注册
        console.log('🔍 检查邮箱是否已被注册...');
        try {
            const emailCheck = await api.checkEmail({ email });
            console.log('📧 邮箱检查结果:', emailCheck);
            
            if (emailCheck.data && emailCheck.data.exists) {
                showMessage('该邮箱已被注册，请直接登录或使用其他邮箱', 'error');
                return;
            }
        } catch (emailCheckError) {
            console.warn('⚠️ 邮箱检查失败，继续注册流程:', emailCheckError);
            // 如果邮箱检查失败，继续注册流程
        }
        
        // 开始注册
        console.log('✅ 邮箱可用，开始注册...');
        const result = await auth.signup(email, nickname, password);
        console.log('注册结果:', result);
        
        if (result.success) {
            showMessage('注册成功！正在跳转...', 'success');
            
            // 注册成功，重定向到My Space页面
            console.log('✅ 注册成功，重定向到My Space页面');
            setTimeout(() => {
                window.location.href = '/my-space';
            }, 1000);
        }
    } catch (error) {
        console.error('注册失败:', error);
        console.error('错误详情:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        
        // 改进错误处理
        let errorMessage = error.message || '注册失败，请重试';
        
        if (error.message.includes('User already registered') || error.message.includes('already exists')) {
            errorMessage = '该邮箱已被注册，请直接登录或使用其他邮箱';
        } else if (error.message.includes('400') || error.message.includes('bad request')) {
            errorMessage = '输入数据有误，请检查后重试';
        } else if (error.message.includes('500') || error.message.includes('server error')) {
            errorMessage = '服务器错误，请稍后重试';
        }
        
        showMessage(errorMessage, 'error');
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
    submitBtn.innerHTML = '<svg class="loading-spinner" width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.416" stroke-dashoffset="31.416"><animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/><animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/></circle></svg> 注册中...';
    
    try {
        await handleSignup(email, nickname, password);
    } finally {
        // 恢复表单
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
});

// 邮箱检查按钮事件
emailCheckBtn.addEventListener('click', checkEmailAvailability);

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
