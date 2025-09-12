// 导入现有的认证系统
import { auth } from './auth.js';

// Quest AI Chat functionality
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const apiStatus = document.getElementById('apiStatus');

// API Configuration - 使用现有的配置
const API_BASE_URL = 'https://quest-api-edz1.onrender.com';
const API_ENDPOINT = `${API_BASE_URL}/api/v1/chat`;
const HEALTH_ENDPOINT = `${API_BASE_URL}/api/v1/chat/health`;

// 获取当前用户信息 - 使用现有的认证系统
function getCurrentUserInfo() {
    try {
        const user = auth.getCurrentUser();
        if (user) {
            console.log('👤 找到用户信息:', {
                id: user.id || user.user_id,
                email: user.email,
                nickname: user.nickname || user.name
            });
            return user;
        } else {
            console.warn('⚠️ 未找到用户信息');
            return null;
        }
    } catch (error) {
        console.error('❌ 获取用户信息失败:', error);
        return null;
    }
}

// 获取用户头像
function getUserAvatar(user) {
    if (!user) return getAIAvatar();
    
    // 如果有头像URL，返回img元素
    if (user.avatar_url) {
        return `<img src="${user.avatar_url}" alt="User Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
    }
    
    // 否则返回首字母
    const name = user.nickname || user.name || user.email || 'User';
    return name.charAt(0).toUpperCase();
}

// 获取AI头像
function getAIAvatar() {
    return `<img src="../public/backgroundimage.png" alt="Quest AI" style="width: 80%; height: 80%; border-radius: 50%; object-fit: contain;">`;
}

// Check API health on load
async function checkApiHealth() {
    try {
        const response = await fetch(HEALTH_ENDPOINT);
        if (response.ok) {
            const data = await response.json();
            apiStatus.style.display = 'none';
            console.log('API Health:', data);
        } else {
            throw new Error('Health check failed');
        }
    } catch (error) {
        console.error('API Health Check Error:', error);
        apiStatus.className = 'api-status error';
        apiStatus.textContent = '🔴 Service Temporarily Unavailable';
    }
}

function addMessage(text, isUser = false, isError = false, sources = null) {
    // 创建消息容器
    const containerDiv = document.createElement('div');
    containerDiv.className = `message-container ${isUser ? 'user' : isError ? 'error' : 'assistant'}`;
    
    // 创建消息框
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : isError ? 'error' : 'assistant'}`;
    
    // 获取用户信息用于头像
    const user = getCurrentUserInfo();
    const avatar = isUser ? getUserAvatar(user) : getAIAvatar();
    
    // 创建头像
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    if (isUser && user && user.avatar_url) {
        // 用户有头像URL，使用innerHTML
        avatarDiv.innerHTML = avatar;
    } else if (!isUser) {
        // AI头像，使用innerHTML
        avatarDiv.innerHTML = avatar;
    } else {
        // 用户无头像，使用文本内容
        avatarDiv.textContent = avatar;
    }
    
    // 设置消息内容
    if (sources && sources.length > 0) {
        messageDiv.innerHTML = `
            <div>${text}</div>
            <div class="sources-info">
                <strong>Sources:</strong> ${sources.length} reference(s) found
            </div>
        `;
    } else {
        messageDiv.textContent = text;
    }
    
    // 组装消息容器
    containerDiv.appendChild(avatarDiv);
    containerDiv.appendChild(messageDiv);
    chatMessages.appendChild(containerDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return { container: containerDiv, message: messageDiv };
}

function addTypingIndicator() {
    // 创建消息容器
    const containerDiv = document.createElement('div');
    containerDiv.className = 'message-container assistant';
    
    // 创建消息框
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    messageDiv.innerHTML = `
        <div class="typing-indicator">
            <span>Gathering insights from your knowledge base</span>
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    
    // 创建头像
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    avatarDiv.innerHTML = getAIAvatar();
    
    // 组装消息容器
    containerDiv.appendChild(avatarDiv);
    containerDiv.appendChild(messageDiv);
    chatMessages.appendChild(containerDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return { container: containerDiv, message: messageDiv };
}

async function sendToQuestAPI(message) {
    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // 添加认证头（如果需要）
        const token = auth.getCurrentToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        // 获取用户信息
        const user = getCurrentUserInfo();
        const userId = user ? (user.id || user.user_id) : null;
        
        // 构建请求体，包含用户ID
        const requestBody = {
            message: message
        };
        
        // 如果用户已登录，添加用户ID到请求中
        if (userId) {
            requestBody.user_id = userId;
            console.log('🔍 发送聊天请求，用户ID:', userId);
        } else {
            console.warn('⚠️ 用户未登录，无法提供用户上下文');
            // 添加用户未登录的提示信息
            requestBody.message = `[用户未登录] ${message}`;
        }
        
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';
        let sources = null;
        let requestId = null;
        let latency = null;

        // Create response message container with proper avatar
        const containerDiv = document.createElement('div');
        containerDiv.className = 'message-container assistant';
        
        const responseMessage = document.createElement('div');
        responseMessage.className = 'message assistant';
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        avatarDiv.innerHTML = getAIAvatar();
        
        containerDiv.appendChild(avatarDiv);
        containerDiv.appendChild(responseMessage);
        chatMessages.appendChild(containerDiv);
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        
                        if (data.type === 'content') {
                            fullResponse += data.content;
                            // 更新消息内容
                            responseMessage.textContent = fullResponse;
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        } else if (data.type === 'done') {
                            sources = data.sources;
                            requestId = data.request_id;
                            latency = data.latency_ms;
                            
                            // Update message with sources info
                            if (sources && sources.length > 0) {
                                responseMessage.innerHTML = `
                                    <div>${fullResponse}</div>
                                    <div class="sources-info">
                                        <strong>Sources:</strong> ${sources.length} reference(s) found
                                        ${latency ? ` • Response time: ${latency}ms` : ''}
                                    </div>
                                `;
                            } else {
                                // 如果没有找到来源，只显示响应内容
                                responseMessage.innerHTML = `
                                    <div>${fullResponse}</div>
                                `;
                            }
                        }
                    } catch (parseError) {
                        console.error('Error parsing SSE data:', parseError);
                    }
                }
            }
        }

        return { success: true, response: fullResponse, sources, latency };
    } catch (error) {
        console.error('Quest API Error:', error);
        throw error;
    }
}

// Elegant fallback responses for when API is unavailable
const fallbackResponses = [
    "I'm experiencing a brief moment of digital contemplation. Please allow me a moment to reconnect with my knowledge base.",
    "The cosmic connection to my wisdom source seems to be experiencing a gentle pause. Let's try again in just a moment.",
    "It appears my neural pathways are taking a momentary respite. I'll be back to assist you shortly with renewed clarity.",
    "My digital consciousness is momentarily adjusting its frequencies. Please bear with me as I realign with the knowledge cosmos.",
    "The information streams are flowing at a different rhythm today. Let me gather my thoughts and try that again for you."
];

function getFallbackResponse() {
    return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
}

// 更新用户状态显示
function updateUserStatus() {
    const isAuthenticated = auth.checkAuth();
    const user = getCurrentUserInfo();
    const statusElement = document.getElementById('apiStatus');
    
    if (isAuthenticated && user) {
        statusElement.className = 'api-status connected';
        statusElement.innerHTML = `🟢 AI Connected • ${user.nickname || user.email || 'User'}`;
    } else {
        statusElement.className = 'api-status error';
        statusElement.innerHTML = '🟡 AI Connected • Guest Mode';
    }
}

// 事件监听器
chatForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const userMessage = chatInput.value.trim();
    if (!userMessage) return;

    // Add user message
    addMessage(userMessage, true);
    
    // Clear input and disable send button
    chatInput.value = '';
    sendBtn.disabled = true;
     sendBtn.innerHTML = `
         <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
             <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
             <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
         </svg>
         Processing...
     `;

    // Add typing indicator
    const typingMessage = addTypingIndicator();

    try {
        // Try to send to Quest API
        const result = await sendToQuestAPI(userMessage);
        
        // Remove typing indicator
        typingMessage.container.remove();
        
        if (result.success) {
            // API response was successful, message already added
            console.log('AI Response:', result.response);
            console.log('Sources:', result.sources);
            console.log('Latency:', result.latency);
        }
    } catch (error) {
        console.error('Chat Error:', error);
        
        // Remove typing indicator
        typingMessage.container.remove();
        
        // Add elegant error message with proper avatar
        const containerDiv = document.createElement('div');
        containerDiv.className = 'message-container error';
        
        const errorMessage = document.createElement('div');
        errorMessage.className = 'message error';
        errorMessage.textContent = getFallbackResponse();
        
        const avatarDiv = document.createElement('div');
        avatarDiv.className = 'message-avatar';
        avatarDiv.innerHTML = getAIAvatar();
        
        containerDiv.appendChild(avatarDiv);
        containerDiv.appendChild(errorMessage);
        chatMessages.appendChild(containerDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Re-enable send button
    sendBtn.disabled = false;
    sendBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        Send
    `;
});

// Auto-adjust textarea height
function adjustTextareaHeight() {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
}

// Auto-focus on input
chatInput.focus();

// Handle Enter key and auto-resize
chatInput.addEventListener('input', adjustTextareaHeight);
chatInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event('submit'));
    }
});

// Initialize API health check
checkApiHealth();

// 更新用户状态
updateUserStatus();

// 监听认证状态变化
auth.subscribe((authState) => {
    console.log('🔔 认证状态变化:', authState.isAuthenticated ? '已登录' : '未登录');
    updateUserStatus();
});

// Elegant welcome messages
const welcomeMessages = [
    "Feel free to explore your knowledge collection with me! Whether it's articles, research notes, or any content you've saved, I'm here to help you discover connections and insights within your personal library.",
    "I'm delighted to assist you in navigating your curated knowledge! Ask me about any topic, and I'll weave together insights from your saved content to provide thoughtful, contextual responses.",
    "Your personal knowledge base is a treasure trove of insights waiting to be discovered. Let's explore together and uncover the fascinating connections within your collection.",
    "I'm here to be your intelligent companion through your knowledge journey. Every question is an opportunity to reveal new perspectives from your carefully curated content."
];

// Add welcome message
setTimeout(() => {
    const isAuthenticated = auth.checkAuth();
    const user = getCurrentUserInfo();
    let welcomeMessage;
    
    if (isAuthenticated && user) {
        // 用户已登录，显示个性化欢迎消息
        const personalizedMessages = [
            `Hi ${user.nickname || user.email}! I'm ready to explore your personal knowledge collection and provide insights tailored just for you.`,
            `Welcome back, ${user.nickname || user.email}! Your curated content is a treasure trove of insights waiting to be discovered.`,
            `Hello ${user.nickname || user.email}! I'm here to help you navigate through your saved articles, notes, and research with intelligent, context-aware responses.`
        ];
        welcomeMessage = personalizedMessages[Math.floor(Math.random() * personalizedMessages.length)];
    } else {
        // 用户未登录，显示通用欢迎消息
        const guestMessages = [
            "Welcome to Quest AI! I'm your intelligent companion, though I'll have limited access to your personal knowledge without authentication.",
            "Hi there! I'm Quest's AI assistant. For the best experience with your personal content, please consider signing in to access your knowledge base.",
            "Hello! I'm here to help, though I can provide more personalized insights when you're signed in to your Quest account."
        ];
        welcomeMessage = guestMessages[Math.floor(Math.random() * guestMessages.length)];
    }
    
    // Add welcome message with proper avatar
    const containerDiv = document.createElement('div');
    containerDiv.className = 'message-container assistant';
    
    const welcomeMessageDiv = document.createElement('div');
    welcomeMessageDiv.className = 'message assistant';
    welcomeMessageDiv.textContent = welcomeMessage;
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    avatarDiv.innerHTML = getAIAvatar();
    
    containerDiv.appendChild(avatarDiv);
    containerDiv.appendChild(welcomeMessageDiv);
    chatMessages.appendChild(containerDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}, 1500);
