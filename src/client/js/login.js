import { auth } from './auth.js';
import { PATHS, navigateTo } from './paths.js';

// DOM elements
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');
const forgotPasswordModal = document.getElementById('forgotPasswordModal');
const closeModal = document.getElementById('closeModal');
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const resetEmailInput = document.getElementById('resetEmail');
const modalMessage = document.getElementById('modalMessage');
const resetPasswordButton = document.getElementById('resetPasswordButton');
const messageDiv = document.getElementById('message');

// Show message
function showMessage(message, type = 'error') {
    if (!messageDiv) {
        console.error('❌ Message display element not found');
        return;
    }
    
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    // Auto-hide error messages
    if (type === 'error') {
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }
}

// Hide messages
function hideMessages() {
    if (messageDiv) {
        messageDiv.style.display = 'none';
    }
}

// Form validation
function validateForm() {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    if (!email) {
        showMessage('Please enter your email address');
        emailInput.focus();
        return false;
    }
    
    if (!password) {
        showMessage('Please enter your password');
        passwordInput.focus();
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

// Handle login
async function handleLogin(email, password) {
    try {
        const result = await auth.login(email, password);
        
        if (result && result.success) {
            showMessage('Login successful! Redirecting...', 'success');
            
            // Delay redirect to show success message
            setTimeout(() => {
                // Login successful, redirect to My Space page
                console.log('✅ Login successful, redirecting to My Space page');
                navigateTo(PATHS.MY_SPACE);
            }, 1000);
        } else {
            // Login failed, show error message
            const errorMsg = result ? result.message : 'Login failed, please try again';
            showMessage(errorMsg);
        }
    } catch (error) {
        console.error('Login failed:', error);
        showMessage(error.message || 'Login failed, please check your email and password');
    }
}

// Event listeners
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
        return;
    }
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    // Disable form
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';
    
    try {
        await handleLogin(email, password);
    } finally {
        // Restore form
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
});

// Hide messages on input
emailInput.addEventListener('input', hideMessages);
passwordInput.addEventListener('input', hideMessages);

// Check authentication status on page load
document.addEventListener('DOMContentLoaded', () => {
    // If user is already logged in, redirect directly
    if (auth.checkAuth()) {
        navigateTo(PATHS.MY_SPACE);
    }
    
    // Focus on email input
    emailInput.focus();
});
