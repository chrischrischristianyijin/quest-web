// Quest Web Signup - Google OAuth Integration
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 Quest Web Signup loaded');
    
    // API Configuration
    const API_BASE = 'https://quest-jmzuj65mw-chris-jins-projects.vercel.app/api/v1';
    
    // Google OAuth Configuration
    const GOOGLE_CLIENT_ID = '103202343935-h0smcligdrp2pp77n0pb39h804hd6ktl.apps.googleusercontent.com';
    const GOOGLE_SCOPES = [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
    ];
    
    // DOM Elements
    const signupForm = document.getElementById('signupForm');
    const googleSignupBtn = document.getElementById('googleSignupBtn');
    const messageDiv = document.getElementById('message');
    
    // Form inputs
    const emailInput = document.getElementById('email');
    const nicknameInput = document.getElementById('nickname');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const signupButton = document.querySelector('.signup-button');
    
    // Update button state based on form completion
    function updateButtonState() {
        const email = emailInput.value.trim();
        const nickname = nicknameInput.value.trim();
        const password = passwordInput.value.trim();
        const confirmPassword = confirmPasswordInput.value.trim();
        
        if (email && nickname && password && confirmPassword && password === confirmPassword) {
            signupButton.classList.add('active');
        } else {
            signupButton.classList.remove('active');
        }
    }
    
    // Show message
    function showMessage(message, isError = false) {
        messageDiv.textContent = message;
        messageDiv.className = isError ? 'error' : 'success';
        messageDiv.style.display = 'block';
        
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }
    
    // Handle Google OAuth for web
    async function handleGoogleAuth() {
        console.log('🔐 Starting Google OAuth flow for web...');
        try {
            // Generate state parameter for security
            const state = Math.random().toString(36).substring(7);
            
            // Store state in sessionStorage for verification
            sessionStorage.setItem('google_oauth_state', state);
            
            // Construct OAuth URL
            const redirectUri = 'https://quest-jmzuj65mw-chris-jins-projects.vercel.app/api/v1/auth/google/callback';
            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                `client_id=${GOOGLE_CLIENT_ID}&` +
                `response_type=code&` +
                `scope=${encodeURIComponent(GOOGLE_SCOPES.join(' '))}&` +
                `redirect_uri=${encodeURIComponent(redirectUri)}&` +
                `state=${state}`;
            
            console.log('📡 Redirecting to Google OAuth...');
            console.log('🔗 Auth URL:', authUrl);
            
            // Redirect to Google OAuth
            window.location.href = authUrl;
            
        } catch (error) {
            console.error('❌ Google auth error:', error);
            showMessage('Google authentication failed', true);
        }
    }
    
    // Handle regular signup
    async function handleSignup(event) {
        event.preventDefault();
        
        const email = emailInput.value.trim();
        const nickname = nicknameInput.value.trim();
        const password = passwordInput.value.trim();
        const confirmPassword = confirmPasswordInput.value.trim();
        
        if (!email || !nickname || !password || !confirmPassword) {
            showMessage('Please fill in all fields', true);
            return;
        }
        
        if (password !== confirmPassword) {
            showMessage('Passwords do not match', true);
            return;
        }
        
        // Password validation
        if (password.length < 8) {
            showMessage('Password must be at least 8 characters long', true);
            return;
        }
        
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            showMessage('Password must contain at least one special character', true);
            return;
        }
        
        try {
            console.log('📤 Sending signup request...');
            const response = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    password,
                    nickname
                })
            });
            
            console.log('📥 Signup response status:', response.status);
            
            if (!response.ok) {
                const errorData = await response.json();
                showMessage(errorData.message || 'Registration failed', true);
                return;
            }
            
            const result = await response.json();
            console.log('✅ Signup successful:', result);
            
            // Store user session
            localStorage.setItem('quest_user_session', JSON.stringify({
                user: result.user,
                timestamp: Date.now()
            }));
            
            showMessage('Account created successfully! Redirecting...');
            
            // Redirect to dashboard or home page
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
            
        } catch (error) {
            console.error('❌ Signup error:', error);
            showMessage('Registration failed, please try again', true);
        }
    }
    
    // Check for OAuth callback
    function checkForOAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');
        
        if (error) {
            console.error('❌ OAuth error:', error);
            showMessage('Google authentication failed', true);
            return;
        }
        
        if (code && state) {
            console.log('🔄 OAuth callback detected');
            console.log('📋 Code:', code ? 'Present' : 'Missing');
            console.log('📋 State:', state);
            
            // Verify state parameter
            const storedState = sessionStorage.getItem('google_oauth_state');
            if (state !== storedState) {
                console.error('❌ State mismatch');
                showMessage('Authentication failed: Invalid state', true);
                return;
            }
            
            // Clear stored state
            sessionStorage.removeItem('google_oauth_state');
            
            // Exchange code for tokens
            exchangeCodeForUserInfo(code);
        }
    }
    
    // Exchange authorization code for user info
    async function exchangeCodeForUserInfo(code) {
        console.log('🔄 Starting token exchange...');
        try {
            const redirectUri = 'https://quest-jmzuj65mw-chris-jins-projects.vercel.app/api/v1/auth/google/callback';
            console.log('📡 Redirect URI:', redirectUri);
            
            // Send the authorization code to our backend for secure token exchange
            console.log('📤 Sending authorization code to backend...');
            const response = await fetch(`${API_BASE}/auth/google/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    code: code,
                    redirect_uri: redirectUri
                })
            });
            
            console.log('📥 Backend token response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Token exchange failed:', errorText);
                throw new Error('Failed to exchange code for token');
            }
            
            const result = await response.json();
            console.log('✅ Token exchange successful, user info received');
            
            // Store user session
            localStorage.setItem('quest_user_session', JSON.stringify({
                user: result.user,
                timestamp: Date.now()
            }));
            
            showMessage('Successfully signed up with Google! Redirecting...');
            
            // Redirect to dashboard or home page
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
            
        } catch (error) {
            console.error('❌ Token exchange error:', error);
            showMessage('Authentication failed', true);
        }
    }
    
    // Event listeners
    signupForm.addEventListener('submit', handleSignup);
    googleSignupBtn.addEventListener('click', handleGoogleAuth);
    
    // Form validation
    emailInput.addEventListener('input', updateButtonState);
    nicknameInput.addEventListener('input', updateButtonState);
    passwordInput.addEventListener('input', updateButtonState);
    confirmPasswordInput.addEventListener('input', updateButtonState);
    
    // Initialize
    console.log('🚀 Initializing Quest Web Signup...');
    console.log('🌐 API Base:', API_BASE);
    
    // Check for OAuth callback on page load
    checkForOAuthCallback();
    
    // Initial button state
    updateButtonState();
});
