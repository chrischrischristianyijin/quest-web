import express from 'express';
import { signUp, signIn, signOut, checkEmailExists, getCurrentUser, getUserByEmail, updateUserProfile, recreateAuthTables, addNicknameColumn, forgotPassword } from '../services/authService.js';
import { authenticate } from '../middleware/auth.js';
import { config } from '../../config.js';

const router = express.Router();

// Google OAuth configuration
const EXTENSION_CLIENT_ID = '103202343935-5dkesvf5dp06af09o0d2373ji2ccd0rc.apps.googleusercontent.com';
const WEB_CLIENT_ID = '103202343935-h0smcligdrp2pp77n0pb39h804hd6ktl.apps.googleusercontent.com';
const EXTENSION_CLIENT_SECRET = process.env.EXTENSION_GOOGLE_CLIENT_SECRET || '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';
const WEB_CLIENT_SECRET = process.env.WEB_GOOGLE_CLIENT_SECRET || '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';
const EXTENSION_REDIRECT_URI = 'https://jcjpicpelibofggpbbmajafjipppnojo.chromiumapp.org/';
const WEB_REDIRECT_URI = 'https://quest-jmzuj65mw-chris-jins-projects.vercel.app/api/v1/auth/google/callback';

// Helper function to get the appropriate Client ID and Secret based on redirect URI
function getClientConfigForRedirectUri(redirectUri) {
    if (redirectUri === EXTENSION_REDIRECT_URI) {
        return {
            clientId: EXTENSION_CLIENT_ID,
            clientSecret: EXTENSION_CLIENT_SECRET
        };
    } else if (redirectUri === WEB_REDIRECT_URI) {
        return {
            clientId: WEB_CLIENT_ID,
            clientSecret: WEB_CLIENT_SECRET
        };
    } else {
        // Default to web client config for unknown redirect URIs
        return {
            clientId: WEB_CLIENT_ID,
            clientSecret: WEB_CLIENT_SECRET
        };
    }
}

// Google OAuth login page
router.get('/google/login', (req, res) => {
    console.log('🔐 Google OAuth login page requested');
    console.log('📋 Query parameters:', req.query);
    
    const isExtension = req.query.extension === 'true';
    console.log('🔍 Is extension request:', isExtension);
    
    if (isExtension) {
        // For extension, render a page that handles OAuth
        console.log('📱 Rendering extension OAuth page');
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Google Login</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        display: flex; 
                        justify-content: center; 
                        align-items: center; 
                        height: 100vh; 
                        margin: 0; 
                        background: #f5f5f5;
                    }
                    .container {
                        text-align: center;
                        background: white;
                        padding: 40px;
                        border-radius: 10px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    .loading {
                        color: #666;
                        margin-bottom: 20px;
                    }
                    .spinner {
                        border: 3px solid #f3f3f3;
                        border-top: 3px solid #3498db;
                        border-radius: 50%;
                        width: 30px;
                        height: 30px;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 20px;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="spinner"></div>
                    <div class="loading">Redirecting to Google...</div>
                </div>
                <script>
                    console.log('🔄 Redirecting to Google OAuth...');
                    // Redirect to Google OAuth
                    const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
                        'client_id=${EXTENSION_CLIENT_ID}&' +
                        'response_type=code&' +
                        'scope=email profile&' +
                        'redirect_uri=${encodeURIComponent(EXTENSION_REDIRECT_URI)}&' +
                        'state=extension';
                    
                    console.log('📡 Auth URL:', authUrl);
                    window.location.href = authUrl;
                </script>
            </body>
            </html>
        `);
    } else {
        // For regular web login
        console.log('🌐 Redirecting to web login');
        res.redirect('/auth/google/web');
    }
});

// Google OAuth callback handler
router.get('/google/callback', async (req, res) => {
    console.log('🔄 Google OAuth callback received');
    console.log('📋 Query parameters:', req.query);
    
    const { code, state } = req.query;
    
    try {
        console.log('🔄 Starting token exchange...');
        
        // Determine the redirect URI and Client ID based on the state
        const isExtension = state === 'extension';
        const redirectUri = isExtension ? EXTENSION_REDIRECT_URI : WEB_REDIRECT_URI;
        const clientConfig = getClientConfigForRedirectUri(redirectUri);
        
        console.log('🔍 Using Client ID:', clientConfig.clientId);
        console.log('🔍 Using Redirect URI:', redirectUri);
        
        // Exchange code for access token
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: clientConfig.clientId,
                client_secret: clientConfig.clientSecret,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code'
            })
        });
        
        console.log('📥 Token response status:', tokenResponse.status);
        
        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('❌ Token exchange failed:', errorText);
            throw new Error('Failed to exchange code for token');
        }
        
        const tokenData = await tokenResponse.json();
        console.log('✅ Token exchange successful');
        
        // Get user info
        console.log('📤 Fetching user info from Google...');
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
        });
        
        console.log('📥 User info response status:', userInfoResponse.status);
        
        if (!userInfoResponse.ok) {
            const errorText = await userInfoResponse.text();
            console.error('❌ Failed to get user info:', errorText);
            throw new Error('Failed to get user info');
        }
        
        const userInfo = await userInfoResponse.json();
        console.log('✅ User info received:', {
            email: userInfo.email,
            name: userInfo.name,
            id: userInfo.id
        });
        
        // Create or update user in your database
        console.log('🔄 Creating/updating user in database...');
        const user = await createOrUpdateGoogleUser(userInfo);
        console.log('✅ User processed:', user);
        
        if (state === 'extension') {
            // Send data back to extension
            console.log('📱 Sending data back to extension');
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Authentication Complete</title>
                    <style>
                        body { 
                            font-family: Arial, sans-serif; 
                            display: flex; 
                            justify-content: center; 
                            align-items: center; 
                            height: 100vh; 
                            margin: 0; 
                            background: #f5f5f5;
                        }
                        .container {
                            text-align: center;
                            background: white;
                            padding: 40px;
                            border-radius: 10px;
                            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        }
                        .success {
                            color: #4CAF50;
                            margin-bottom: 20px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="success">✓ Authentication successful!</div>
                        <div>You can close this window now.</div>
                    </div>
                    <script>
                        console.log('✅ Sending success message to extension');
                        window.opener.postMessage({
                            type: 'GOOGLE_AUTH_SUCCESS',
                            user: ${JSON.stringify(user)}
                        }, '*');
                        setTimeout(() => window.close(), 2000);
                    </script>
                </body>
                </html>
            `);
        } else {
            // Web flow - redirect back to login/signup page with success
            console.log('🌐 Redirecting to web login/signup with success');
            const redirectUrl = new URL('/login', 'https://quest-jmzuj65mw-chris-jins-projects.vercel.app');
            redirectUrl.searchParams.set('code', code);
            redirectUrl.searchParams.set('state', state);
            res.redirect(redirectUrl.toString());
        }
        
    } catch (error) {
        console.error('❌ OAuth error:', error);
        if (state === 'extension') {
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Authentication Failed</title>
                    <style>
                        body { 
                            font-family: Arial, sans-serif; 
                            display: flex; 
                            justify-content: center; 
                            align-items: center; 
                            height: 100vh; 
                            margin: 0; 
                            background: #f5f5f5;
                        }
                        .container {
                            text-align: center;
                            background: white;
                            padding: 40px;
                            border-radius: 10px;
                            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        }
                        .error {
                            color: #f44336;
                            margin-bottom: 20px;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="error">✗ Authentication failed</div>
                        <div>Please try again.</div>
                    </div>
                    <script>
                        console.log('❌ Sending error message to extension');
                        window.opener.postMessage({
                            type: 'GOOGLE_AUTH_ERROR',
                            error: 'Authentication failed: ${error.message}'
                        }, '*');
                        setTimeout(() => window.close(), 2000);
                    </script>
                </body>
                </html>
            `);
        } else {
            // Web flow - redirect back to login/signup page with error
            console.log('🌐 Redirecting to web login/signup with error');
            const redirectUrl = new URL('/login', 'https://quest-jmzuj65mw-chris-jins-projects.vercel.app');
            redirectUrl.searchParams.set('error', 'Authentication failed');
            res.redirect(redirectUrl.toString());
        }
    }
});

// Google OAuth authentication endpoint for extension
router.post('/google', async (req, res) => {
    console.log('🔐 Google OAuth authentication endpoint called');
    console.log('📋 Request body:', req.body);
    
    try {
        const { email, name, picture, google_id } = req.body;
        
        if (!email) {
            console.error('❌ Email is required');
            return res.status(400).json({ message: 'Email is required' });
        }
        
        console.log('🔄 Creating/updating Google user...');
        // Create or update user in your database
        const user = await createOrUpdateGoogleUser({
            email,
            name: name || email.split('@')[0],
            picture,
            id: google_id
        });
        
        console.log('✅ User created/updated successfully:', user);
        
        res.json({
            success: true,
            user: user
        });
        
    } catch (error) {
        console.error('❌ Google auth error:', error);
        res.status(500).json({ 
            message: error.message || 'Authentication failed' 
        });
    }
});

// Secure token exchange endpoint for extension
router.post('/google/token', async (req, res) => {
    console.log('🔄 Google OAuth token exchange endpoint called');
    console.log('📋 Request body:', req.body);
    
    try {
        const { code, redirect_uri } = req.body;
        
        if (!code) {
            console.error('❌ Authorization code is required');
            return res.status(400).json({ message: 'Authorization code is required' });
        }
        
        console.log('🔄 Exchanging authorization code for token...');
        
        // Determine the appropriate Client ID based on redirect URI
        const clientConfig = getClientConfigForRedirectUri(redirect_uri);
        console.log('🔍 Using Client ID:', clientConfig.clientId);
        console.log('🔍 Using Redirect URI:', redirect_uri);
        
        // Exchange code for access token
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: clientConfig.clientId,
                client_secret: clientConfig.clientSecret,
                redirect_uri: redirect_uri,
                grant_type: 'authorization_code'
            })
        });
        
        console.log('📥 Token response status:', tokenResponse.status);
        
        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('❌ Token exchange failed:', errorText);
            return res.status(401).json({ message: 'Failed to exchange code for token' });
        }
        
        const tokenData = await tokenResponse.json();
        console.log('✅ Token exchange successful');
        
        // Get user info using access token
        console.log('📤 Fetching user info from Google...');
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
        });
        
        console.log('📥 User info response status:', userInfoResponse.status);
        
        if (!userInfoResponse.ok) {
            const errorText = await userInfoResponse.text();
            console.error('❌ Failed to get user info:', errorText);
            return res.status(500).json({ message: 'Failed to get user info' });
        }
        
        const userInfo = await userInfoResponse.json();
        console.log('✅ User info received:', {
            email: userInfo.email,
            name: userInfo.name,
            id: userInfo.id
        });
        
        // Create or update user in your database
        console.log('🔄 Creating/updating user in database...');
        const user = await createOrUpdateGoogleUser(userInfo);
        console.log('✅ User processed:', user);
        
        res.json({
            success: true,
            user: user
        });
        
    } catch (error) {
        console.error('❌ Token exchange error:', error);
        res.status(500).json({ 
            message: error.message || 'Token exchange failed' 
        });
    }
});

// Helper function to create or update Google user
async function createOrUpdateGoogleUser(googleUserInfo) {
    console.log('🔄 createOrUpdateGoogleUser called with:', {
        email: googleUserInfo.email,
        name: googleUserInfo.name,
        id: googleUserInfo.id
    });
    
    try {
        // Check if user exists
        console.log('🔍 Checking if user exists by email:', googleUserInfo.email);
        const existingUser = await getUserByEmail(googleUserInfo.email);
        
        if (existingUser) {
            console.log('✅ User exists, updating with Google info:', existingUser);
            // Update existing user with Google info
            return {
                id: existingUser.id,
                email: existingUser.email,
                nickname: existingUser.nickname || googleUserInfo.name,
                avatar_url: googleUserInfo.picture,
                google_id: googleUserInfo.id
            };
        } else {
            console.log('🆕 User does not exist, creating new user...');
            // Create new user
            const randomPassword = Math.random().toString(36).substring(7);
            console.log('🔐 Generated random password for new user');
            
            const newUser = await signUp(
                googleUserInfo.email,
                randomPassword,
                googleUserInfo.name
            );
            
            console.log('✅ New user created successfully:', newUser);
            
            return {
                id: newUser.user.id,
                email: newUser.user.email,
                nickname: newUser.user.nickname,
                avatar_url: googleUserInfo.picture,
                google_id: googleUserInfo.id
            };
        }
    } catch (error) {
        console.error('❌ Error creating/updating Google user:', error);
        throw error;
    }
}

// Check if email exists
router.post('/check-email', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const exists = await checkEmailExists(email);
        res.setHeader('Content-Type', 'application/json');
        res.json({ exists });
    } catch (error) {
        console.error('Check email error:', error);
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({ message: 'Error checking email availability' });
    }
});

// Sign up
router.post('/register', async (req, res) => {
    try {
        const { email, password, nickname } = req.body;
        
        if (!email || !password || !nickname) {
            return res.status(400).json({ message: 'Email, password, and nickname are required' });
        }

        const result = await signUp(email, password, nickname);
        res.setHeader('Content-Type', 'application/json');
        res.status(201).json(result);
    } catch (error) {
        console.error('Signup error:', error);
        res.setHeader('Content-Type', 'application/json');
        res.status(error.status || 500).json({ 
            message: error.message || 'Error creating account' 
        });
    }
});

// Sign in
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const result = await signIn(email, password);
        res.json(result);
    } catch (error) {
        console.error('Login error:', error);
        res.status(error.status || 401).json({ 
            message: error.message || 'Invalid login credentials' 
        });
    }
});

// Sign out
router.post('/signout', async (req, res) => {
    try {
        const result = await signOut();
        res.json(result);
    } catch (error) {
        console.error('Signout error:', error);
        res.status(500).json({ message: 'Error signing out' });
    }
});

// 获取用户信息路由
router.get('/profile', authenticate, async (req, res) => {
    try {
        const user = req.user;
        res.json(user);
    } catch (error) {
        console.error('Error getting profile:', error);
        res.status(500).json({ message: 'Error getting user profile' });
    }
});

// Update this route
router.post('/recreate-auth-tables', async (req, res) => {
    try {
        const result = await recreateAuthTables();
        res.json(result);
    } catch (error) {
        console.error('Error recreating auth tables:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to recreate auth tables',
            error: error.message
        });
    }
});

// Add nickname column
router.post('/add-nickname-column', async (req, res) => {
    try {
        const result = await addNicknameColumn();
        res.json(result);
    } catch (error) {
        console.error('Error adding nickname column:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add nickname column',
            error: error.message
        });
    }
});

// Forgot password
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const result = await forgotPassword(email);
        res.json(result);
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(error.status || 500).json({ 
            message: error.message || 'Error processing password reset request' 
        });
    }
});

export default router; 