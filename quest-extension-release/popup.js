// Quest Extension - Simplified Version
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎯 Quest Extension loaded');
    
    // Get DOM elements
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const insightsForm = document.getElementById('insightsForm');
    const userInfo = document.getElementById('userInfo');
    const messageDiv = document.getElementById('message');
    
    // Initialize state
    let currentUser = null;
    // Use production URL if available, otherwise fallback to localhost for development
    const API_BASE = 'http://localhost:3001/api/v1';
    
    // Google OAuth configuration
    const GOOGLE_CLIENT_ID = '103202343935-5dkesvf5dp06af09o0d2373ji2ccd0rc.apps.googleusercontent.com';
    const GOOGLE_SCOPES = [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
    ];
    
    // Handle Google OAuth authentication
    async function handleGoogleAuth() {
        console.log('🔐 Starting Google OAuth flow...');
        try {
            // Launch OAuth flow using Chrome extension identity API
            console.log('📡 Launching Chrome identity OAuth flow...');
            const authResult = await chrome.identity.launchWebAuthFlow({
                url: `https://accounts.google.com/o/oauth2/v2/auth?` +
                     `client_id=${GOOGLE_CLIENT_ID}&` +
                     `response_type=code&` +
                     `scope=${encodeURIComponent(GOOGLE_SCOPES.join(' '))}&` +
                     `redirect_uri=${encodeURIComponent(chrome.identity.getRedirectURL())}&` +
                     `state=${Math.random().toString(36).substring(7)}`,
                interactive: true
            });
            
            console.log('✅ OAuth flow completed, result:', authResult);
            
            if (chrome.runtime.lastError) {
                console.error('❌ OAuth error:', chrome.runtime.lastError);
                showMessage('Google authentication failed', true);
                return;
            }
            
            // Extract authorization code from URL
            const url = new URL(authResult);
            const code = url.searchParams.get('code');
            const state = url.searchParams.get('state');
            
            console.log('🔍 Extracted from OAuth response:');
            console.log('  - Code:', code ? 'Present' : 'Missing');
            console.log('  - State:', state);
            console.log('  - Full URL:', authResult);
            
            if (!code) {
                console.error('❌ No authorization code found in response');
                showMessage('Google authentication failed', true);
                return;
            }
            
            // Exchange code for tokens and user info
            console.log('🔄 Exchanging authorization code for tokens...');
            await exchangeCodeForUserInfo(code);
            
        } catch (error) {
            console.error('❌ Google auth error:', error);
            showMessage('Google authentication failed', true);
        }
    }
    
    // Exchange authorization code for user info
    async function exchangeCodeForUserInfo(code) {
        console.log('🔄 Starting token exchange...');
        try {
            const redirectUri = chrome.identity.getRedirectURL();
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
            
            // The backend has already processed the user info and returned the user data
            currentUser = result.user;
            console.log('👤 Current user set:', currentUser);
            
            // Save session
            console.log('💾 Saving session to Chrome storage...');
            await chrome.storage.local.set({
                quest_user_session: {
                    user: result.user,
                    timestamp: Date.now()
                }
            });
            
            console.log('✅ Session saved successfully');
            showUserInterface();
            showMessage('Successfully logged in with Google!');
            
        } catch (error) {
            console.error('❌ Token exchange error:', error);
            showMessage('Authentication failed', true);
        }
    }
    
    // Show message
    function showMessage(message, isError = false) {
        messageDiv.textContent = message;
        messageDiv.className = isError ? 'message error' : 'message success';
        messageDiv.style.display = 'block';
        
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 3000);
    }
    
    // Check user session
    async function checkUserSession() {
        try {
            const result = await chrome.storage.local.get('quest_user_session');
            if (result.quest_user_session) {
                currentUser = result.quest_user_session.user;
                showUserInterface();
                return true;
            } else {
                showLoginInterface();
                return false;
            }
        } catch (error) {
            console.error('Session check error:', error);
            showLoginInterface();
            return false;
        }
    }
    
    // Show login interface
    function showLoginInterface() {
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
        insightsForm.style.display = 'none';
        userInfo.style.display = 'none';
        
        // Hide user avatar on login page
        const userAvatar = document.getElementById('userAvatar');
        userAvatar.style.display = 'none';
    }

    // Show user interface
    function showUserInterface() {
        loginForm.style.display = 'none';
        signupForm.style.display = 'none';
        insightsForm.style.display = 'block';
        userInfo.style.display = 'block';
        
        if (currentUser) {
            // Show user avatar
            const userAvatar = document.getElementById('userAvatar');
            const nickname = currentUser.nickname || currentUser.email.split('@')[0];
            
            // If avatar URL exists, use avatar image
            if (currentUser.avatar_url) {
                userAvatar.innerHTML = `<img src="${currentUser.avatar_url}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            } else {
                // Otherwise show first letter
                userAvatar.textContent = nickname.charAt(0).toUpperCase();
            }
            userAvatar.style.display = 'flex';
            userAvatar.style.cursor = 'pointer';
            
            // Add avatar click event
            userAvatar.onclick = () => {
                if (confirm('Are you sure you want to logout?')) {
                    handleLogout();
                }
            };
            
            userInfo.innerHTML = `
                <div class="user-info">
                </div>
            `;
        } else {
            // If no user info, hide avatar
            const userAvatar = document.getElementById('userAvatar');
            userAvatar.style.display = 'none';
        }
    }
    
    // Handle login
    async function handleLogin(event) {
        event.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        if (!email || !password) {
            showMessage('Please fill in email and password', true);
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                const errorData = await response.json();
                showMessage(errorData.message || 'Login failed', true);
                return;
            }

            const result = await response.json();
            currentUser = result.user;
            
            // 保存会话
            await chrome.storage.local.set({
                quest_user_session: {
                    user: result.user,
                    timestamp: Date.now()
                }
            });
            
            showUserInterface();
            
        } catch (error) {
            console.error('Login error:', error);
            showMessage('Login failed, please try again', true);
        }
    }
    
    // 处理注册
    async function handleSignup(event) {
        event.preventDefault();
        
        const email = document.getElementById('signupEmail').value;
        const nickname = document.getElementById('signupNickname').value;
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('signupConfirmPassword').value;

        if (!email || !nickname || !password || !confirmPassword) {
            showMessage('Please fill in all fields', true);
            return;
        }

        if (password !== confirmPassword) {
            showMessage('Passwords do not match', true);
            return;
        }

        try {
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

            if (!response.ok) {
                const errorData = await response.json();
                showMessage(errorData.message || 'Registration failed', true);
                return;
            }

            const result = await response.json();
            currentUser = result.user;
            
            // 保存会话
            await chrome.storage.local.set({
                quest_user_session: {
                    user: result.user,
                    timestamp: Date.now()
                }
            });
            
            showUserInterface();
            
        } catch (error) {
            console.error('Registration error:', error);
            showMessage('Registration failed, please try again', true);
        }
    }

    // 处理退出登录
    async function handleLogout() {
        try {
            await chrome.storage.local.remove('quest_user_session');
            currentUser = null;
            // 隐藏用户头像
            document.getElementById('userAvatar').style.display = 'none';
            showLoginInterface();
        } catch (error) {
            console.error('Logout error:', error);
            showMessage('Logout failed', true);
        }
    }
    
    // 选中的tags数组
    let selectedTags = [];
    
    // 更新选中的tags显示（现在只是更新选中状态，不显示在下方）
    function updateSelectedTagsDisplay() {
        // 移除所有选中状态
        document.querySelectorAll('.tag-option').forEach(tag => {
            tag.classList.remove('selected');
        });
        
        // 为选中的标签添加选中状态
        selectedTags.forEach(tag => {
            const tagElement = document.querySelector(`[data-tag="${tag}"]`);
            if (tagElement) {
                tagElement.classList.add('selected');
            }
        });
    }
    
    // 添加tag
    function addTag(tag) {
        tag = tag.trim().toLowerCase();
        if (tag && !selectedTags.includes(tag)) {
            selectedTags.push(tag);
            updateSelectedTagsDisplay();
        }
    }
    
    // 删除tag
    function removeTag(tag) {
        selectedTags = selectedTags.filter(t => t !== tag);
        updateSelectedTagsDisplay();
    }
    
    // 全局函数，供HTML调用
    window.removeTag = removeTag;
    
    // 处理保存洞察
    async function handleSaveInsight(event) {
        event.preventDefault();
        
        if (!currentUser) {
            showMessage('Please login first', true);
            return;
        }
        
        const url = document.getElementById('insightUrl').value;
        
        if (!url) {
            showMessage('Please enter page URL', true);
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/insights`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: url || window.location.href,
                    email: currentUser.email,
                    tags: selectedTags
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                showMessage(errorData.message || 'Save failed', true);
                return;
            }

            showMessage('Saved to collection!');
            document.getElementById('insightUrl').value = '';
            // 清除选中的tags
            selectedTags = [];
            updateSelectedTagsDisplay();
            
        } catch (error) {
            console.error('Save insight error:', error);
            showMessage('Save failed, please try again', true);
        }
    }
    
    // 绑定事件监听器
    loginForm.addEventListener('submit', handleLogin);
    signupForm.addEventListener('submit', handleSignup);
    insightsForm.addEventListener('submit', handleSaveInsight);
    
    // Google OAuth button event listeners
    document.getElementById('googleLoginBtn').addEventListener('click', handleGoogleAuth);
    document.getElementById('googleSignupBtn').addEventListener('click', handleGoogleAuth);

    // Tag选择事件
    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('tag-option')) {
            const tagElement = event.target;
            const tag = tagElement.dataset.tag;
            
            tagElement.classList.toggle('selected');
            if (tagElement.classList.contains('selected')) {
                addTag(tag);
            } else {
                removeTag(tag);
            }
        }
    });
    

    

    

    
    // 打开Side Panel按钮
    document.addEventListener('click', function(event) {

    });
    
    // 切换表单显示
    document.getElementById('showSignup').addEventListener('click', () => {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
    });
    
    document.getElementById('showLogin').addEventListener('click', () => {
        signupForm.style.display = 'none';
        loginForm.style.display = 'block';
    });
    
    // 初始化
    checkUserSession();
    
    // 获取当前页面URL
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0]) {
            document.getElementById('insightUrl').value = tabs[0].url;
        }
    });
    
    // 监听登录状态变化
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.quest_user_session) {
            const newValue = changes.quest_user_session.newValue;
            if (newValue && newValue.user) {
                console.log('检测到登录状态变化:', newValue.user);
                currentUser = newValue.user;
                showUserInterface();
                loadUserTags();
            } else {
                console.log('检测到登出状态变化');
                currentUser = null;
                showLoginInterface();
            }
        }
    });
    
    // 加载用户所有标签（包括预设标签和自定义标签）
    async function loadUserTags() {
        if (!currentUser) return;
        
        try {
            const response = await fetch(`${API_BASE}/user-tags?email=${encodeURIComponent(currentUser.email)}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.tags) {
                    // 清空现有的标签选择器
                    const tagSelector = document.getElementById('tagSelector');
                    
                    // 移除所有现有的标签选项
                    const existingTags = tagSelector.querySelectorAll('.tag-option');
                    existingTags.forEach(tag => tag.remove());
                    
                    // 添加所有用户标签
                    data.tags.forEach(tag => {
                        const tagElement = document.createElement('div');
                        tagElement.className = 'tag-option';
                        tagElement.setAttribute('data-tag', tag.name);
                        tagElement.style.borderColor = tag.color;
                        tagElement.style.color = tag.color;
                        tagElement.textContent = tag.name.charAt(0).toUpperCase() + tag.name.slice(1);
                        tagSelector.appendChild(tagElement);
                    });
                }
            }
        } catch (error) {
            console.error('Error loading user tags:', error);
        }
    }
    
    // 在用户登录后加载自定义标签
    const originalShowUserInterface = showUserInterface;
    showUserInterface = function() {
        originalShowUserInterface();
        loadUserTags();
    };
}); 