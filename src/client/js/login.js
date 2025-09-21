import { auth } from './auth.js';
import { PATHS, navigateTo } from './paths.js';
import { autoReloginManager } from './auto-relogin.js';

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
const rememberMeCheckbox = document.getElementById('rememberMe');

// Show message
function showMessage(message, type = 'error', persistent = false) {
    if (!messageDiv) {
        console.error('❌ Message display element not found');
        return;
    }
    
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    // Add close button for persistent messages
    if (persistent) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'message-close-btn';
        closeBtn.innerHTML = '&times;';
        closeBtn.title = 'Dismiss';
        closeBtn.onclick = () => {
            messageDiv.style.display = 'none';
            // Clear logout reason from localStorage when dismissed
            localStorage.removeItem('quest_logout_reason');
            localStorage.removeItem('quest_logout_timestamp');
        };
        
        // Clear any existing close button
        const existingCloseBtn = messageDiv.querySelector('.message-close-btn');
        if (existingCloseBtn) {
            existingCloseBtn.remove();
        }
        
        messageDiv.appendChild(closeBtn);
    } else {
        // Remove close button for non-persistent messages
        const existingCloseBtn = messageDiv.querySelector('.message-close-btn');
        if (existingCloseBtn) {
            existingCloseBtn.remove();
        }
        
        // Auto-hide non-persistent error messages
        if (type === 'error') {
            setTimeout(() => {
                messageDiv.style.display = 'none';
            }, 5000);
        }
    }
}

// Hide messages
function hideMessages() {
    if (messageDiv) {
        messageDiv.style.display = 'none';
    }
}

// Check and display logout reason
function checkAndDisplayLogoutReason() {
    try {
        // Check URL parameters first
        const urlParams = new URLSearchParams(window.location.search);
        const urlReason = urlParams.get('reason');
        const isAutoLogout = urlParams.get('auto') === 'true';
        
        // Check localStorage for logout reason
        const storedReason = localStorage.getItem('quest_logout_reason');
        const storedTimestamp = localStorage.getItem('quest_logout_timestamp');
        
        let logoutReason = null;
        let shouldShow = false;
        
        // Determine which reason to use and if it's recent enough
        if (storedReason && storedTimestamp) {
            const logoutTime = parseInt(storedTimestamp);
            const now = Date.now();
            const timeDiff = now - logoutTime;
            
            // Show logout reason if it's within the last 10 minutes
            if (timeDiff < 10 * 60 * 1000) {
                logoutReason = storedReason;
                shouldShow = true;
            } else {
                // Clear old logout reasons
                localStorage.removeItem('quest_logout_reason');
                localStorage.removeItem('quest_logout_timestamp');
            }
        }
        
        // Use URL reason if no stored reason or if it's more specific
        if (urlReason && isAutoLogout) {
            logoutReason = decodeURIComponent(urlReason);
            shouldShow = true;
        }
        
        if (shouldShow && logoutReason) {
            console.log('🚪 Displaying logout reason:', logoutReason);
            
            // Format the message based on the reason
            let displayMessage = '';
            let messageType = 'warning';
            
            if (logoutReason.toLowerCase().includes('token')) {
                displayMessage = `🔐 Session Expired: ${logoutReason}`;
                messageType = 'warning';
            } else if (logoutReason.toLowerCase().includes('connection')) {
                displayMessage = `🌐 Connection Issue: ${logoutReason}`;
                messageType = 'error';
            } else if (logoutReason.toLowerCase().includes('database')) {
                displayMessage = `💾 Database Issue: ${logoutReason}`;
                messageType = 'error';
            } else {
                displayMessage = `⚠️ Logged Out: ${logoutReason}`;
                messageType = 'warning';
            }
            
            // Show persistent message that requires user dismissal
            showMessage(displayMessage, messageType, true);
            
            // Clean up URL parameters without refreshing the page
            if (urlReason || isAutoLogout) {
                const newUrl = window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);
            }
        }
        
    } catch (error) {
        console.error('❌ Error checking logout reason:', error);
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
            
            // If user selected "Remember me", save credentials for auto relogin
            if (rememberMeCheckbox && rememberMeCheckbox.checked) {
                console.log('💾 Saving user credentials for auto relogin...');
                autoReloginManager.saveCredentials(email, password);
            } else {
                // If user didn't select "Remember me", clear previously saved credentials
                console.log('🗑️ Clearing saved user credentials...');
                autoReloginManager.clearSavedCredentials();
            }
            
            // Delay redirect to show success message
            setTimeout(() => {
                // Login successful, redirect to My Space page with full page reload
                console.log('✅ Login successful, redirecting to My Space page');
                navigateTo(PATHS.MY_SPACE, { fromAuth: true });
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
    // Initialize auto relogin functionality
    console.log('🔄 Initializing auto relogin functionality...');
    autoReloginManager.setEnabled(true);
    
    // If user is already logged in, redirect directly
    if (auth.checkAuth()) {
        navigateTo(PATHS.MY_SPACE, { fromAuth: true });
        return;
    }
    
    // Check and display logout reason
    checkAndDisplayLogoutReason();
    
    // Focus on email input
    emailInput.focus();
});
