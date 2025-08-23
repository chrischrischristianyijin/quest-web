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

// Check email availability
async function checkEmailAvailability() {
    const email = emailInput.value.trim();
    
    if (!email) {
        showEmailStatus('Please enter your email address', 'error');
        return;
    }
    
    // Simple email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showEmailStatus('Please enter a valid email address', 'error');
        return;
    }
    
    try {
        // Show checking status
        emailCheckBtn.disabled = true;
        emailCheckBtn.innerHTML = '<svg class="loading-spinner" width="16" height="16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.416" stroke-dashoffset="31.416"><animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/><animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/></circle></svg> Checking...';
        
        const result = await api.checkEmail({ email });
        
        if (result.data && result.data.exists) {
            showEmailStatus('This email is already registered, please use another email or login directly', 'error');
        } else {
            showEmailStatus('✅ This email is available', 'success');
        }
    } catch (error) {
        console.error('Email check failed:', error);
        showEmailStatus('Email check failed, please try again', 'error');
    } finally {
        // Restore button state
        emailCheckBtn.disabled = false;
        emailCheckBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.93 6.64 2.47M21 12l-3-3m3 3l-3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Check';
    }
}

// Show email status
function showEmailStatus(message, type = 'info') {
    emailStatus.textContent = message;
    emailStatus.className = `email-status email-status-${type}`;
    emailStatus.style.display = 'block';
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        emailStatus.style.display = 'none';
    }, 3000);
}

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
        
        // First check if email is already registered
        console.log('🔍 Checking if email is already registered...');
        try {
            const emailCheck = await api.checkEmail({ email });
            console.log('📧 Email check result:', emailCheck);
            
            if (emailCheck.data && emailCheck.data.exists) {
                showMessage('This email is already registered, please login directly or use another email', 'error');
                return;
            }
        } catch (emailCheckError) {
            console.warn('⚠️ Email check failed, continuing with signup process:', emailCheckError);
            // If email check fails, continue with signup process
        }
        
        // Start signup
        console.log('✅ Email available, starting signup...');
        const result = await auth.signup(email, nickname, password);
        console.log('Signup result:', result);
        
        if (result.success) {
            showMessage('Signup successful! Redirecting...', 'success');
            
            // Signup successful, redirect to My Space page
            console.log('✅ Signup successful, redirecting to My Space page');
            setTimeout(() => {
                navigateTo(PATHS.MY_SPACE);
            }, 1000);
        }
    } catch (error) {
        console.error('Signup failed:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        
        // Improved error handling
        let errorMessage = error.message || 'Signup failed, please try again';
        
        if (error.message.includes('User already registered') || error.message.includes('already exists')) {
            errorMessage = 'This email is already registered, please login directly or use another email';
        } else if (error.message.includes('400') || error.message.includes('bad request')) {
            errorMessage = 'Input data is incorrect, please check and try again';
        } else if (error.message.includes('500') || error.message.includes('server error')) {
            errorMessage = 'Server error, please try again later';
        }
        
        showMessage(errorMessage, 'error');
    }
}

// Event listeners
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
        return;
    }
    
    const email = emailInput.value.trim();
    const nickname = nicknameInput.value.trim();
    const password = passwordInput.value;
    
    // Disable form
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<svg class="loading-spinner" width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.416" stroke-dashoffset="31.416"><animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/><animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/></circle></svg> Signing up...';
    
    try {
        await handleSignup(email, nickname, password);
    } finally {
        // Restore form
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
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
        navigateTo(PATHS.MY_SPACE);
    }
    
    // Focus on email input
    emailInput.focus();
});
