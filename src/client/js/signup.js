import { auth } from './auth.js';
import { PATHS, navigateTo } from './paths.js';
import { api } from './api.js'; // Added import for api

// DOM elements
const signupForm = document.getElementById('signupForm');
const emailInput = document.getElementById('email');
const nicknameInput = document.getElementById('nickname');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');
const agreeTermsCheckbox = document.getElementById('agreeTerms');
const submitBtn = document.getElementById('submitBtn');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');

// Show message
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

// Hide messages
function hideMessages() {
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
}

// 移除邮箱预检查相关函数与UI

// Form validation
function validateForm() {
    const email = emailInput.value.trim();
    const nickname = nicknameInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    
    if (!email) {
        showMessage('Please enter your email address');
        emailInput.focus();
        return false;
    }
    
    if (!nickname) {
        showMessage('Please enter your nickname');
        nicknameInput.focus();
        return false;
    }
    
    if (!password) {
        showMessage('Please enter your password');
        passwordInput.focus();
        return false;
    }
    
    if (password.length < 8) {
        showMessage('Password must be at least 8 characters long');
        passwordInput.focus();
        return false;
    }
    
    if (password !== confirmPassword) {
        showMessage('The two passwords do not match');
        confirmPasswordInput.focus();
        return false;
    }
    
    // Simple email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showMessage('Please enter a valid email address');
        emailInput.focus();
        return false;
    }
    
    return true;
}

// Handle signup
async function handleSignup(email, nickname, password) {
    try {
        console.log('Starting signup process...');
        console.log('Signup data:', { email, nickname, password: '***' });
        
        // 直接开始注册，后端自行校验邮箱是否已注册
        console.log('✅ Starting signup...');
        const result = await auth.signup(email, nickname, password);
        console.log('Signup result:', result);
        
        if (result.success) {
            showMessage('Signup successful! Redirecting...', 'success');
            
            // 尝试自动登录以获取有效 token，避免 My Space 页面401后跳转登录
            try {
                await auth.login(email, password);
            } catch (e) {
                console.warn('Auto-login after signup failed:', e);
            }

            // Signup successful, redirect to My Space page with full page reload
            console.log('✅ Signup successful, redirecting to My Space page');
            setTimeout(() => {
                navigateTo(PATHS.MY_SPACE, { fromAuth: true });
            }, 1000);
        } else {
            // Handle signup failure from auth layer
            console.log('❌ Signup failed from auth layer:', result);
            let errorMessage = result.message || 'Signup failed, please try again';
            
            // Check for specific error messages
            if (errorMessage.includes('该邮箱已被注册') || 
                errorMessage.includes('already registered') ||
                errorMessage.includes('duplicate key') ||
                errorMessage.includes('unique constraint') ||
                errorMessage.includes('注册失败') ||
                errorMessage.includes('email already registered') ||
                errorMessage.includes('registration failed')) {
                errorMessage = 'Account creation was unsuccessful. An account has already been registered with this email address. Please try logging in or use a different email.';
            }
            
            console.log('🚨 Displaying auth layer error message:', errorMessage);
            showMessage(errorMessage, 'error');
        }
    } catch (error) {
        console.error('Signup failed:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        console.log('🔍 Error message analysis:', {
            originalMessage: error.message,
            includesAlreadyRegistered: error.message.includes('already registered'),
            includesChinese: error.message.includes('该邮箱已被注册'),
            includesDuplicate: error.message.includes('duplicate key')
        });
        
        // Improved error handling
        let errorMessage = error.message || 'Signup failed, please try again';
        
        if (error.message.includes('User already registered') || 
            error.message.includes('already exists') ||
            error.message.includes('该邮箱已被注册') ||
            error.message.includes('already registered') ||
            error.message.includes('duplicate key') ||
            error.message.includes('unique constraint') ||
            error.message.includes('注册失败') ||
            error.message.includes('email already registered') ||
            error.message.includes('registration failed')) {
            errorMessage = 'Account creation was unsuccessful. An account has already been registered with this email address. Please try logging in or use a different email.';
        } else if (error.message.includes('400') || error.message.includes('bad request')) {
            errorMessage = 'Input data is incorrect, please check and try again';
        } else if (error.message.includes('500') || error.message.includes('server error')) {
            errorMessage = 'Server error, please try again later';
        } else if (error.message.includes('422') || error.message.includes('validation')) {
            errorMessage = 'Please check your input and try again';
        }
        
        console.log('🚨 Displaying error message:', errorMessage);
        showMessage(errorMessage, 'error');
    }
}

// 防重复提交开关
let isSubmitting = false;

// Event listeners
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
        return;
    }
    if (isSubmitting) {
        return;
    }
    
    const email = emailInput.value.trim();
    const nickname = nicknameInput.value.trim();
    const password = passwordInput.value;
    
    // Disable form
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<svg class="loading-spinner" width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.416" stroke-dashoffset="31.416"><animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/><animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/></circle></svg> Signing up...';
    isSubmitting = true;
    
    try {
        await handleSignup(email, nickname, password);
    } finally {
        // Restore form
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        isSubmitting = false;
    }
});

// Hide messages on input
emailInput.addEventListener('input', hideMessages);
nicknameInput.addEventListener('input', hideMessages);
passwordInput.addEventListener('input', hideMessages);
confirmPasswordInput.addEventListener('input', hideMessages);

// Check authentication status on page load
document.addEventListener('DOMContentLoaded', () => {
    // If user is already logged in, redirect directly
    if (auth.checkAuth()) {
        navigateTo(PATHS.MY_SPACE, { fromAuth: true });
    }
    
    // Focus on email input
    emailInput.focus();
});
