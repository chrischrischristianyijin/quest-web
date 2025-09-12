// 导入现有的认证系统
import { auth } from './auth.js';

// Quest AI Chat functionality
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const apiStatus = document.getElementById('apiStatus');

// API Configuration - 根据实际API端点更新
const API_BASE_URL = 'https://quest-api-edz1.onrender.com';
const CHAT_ENDPOINT = `${API_BASE_URL}/api/v1/chat`;  // 主要聊天接口
const HEALTH_ENDPOINT = `${API_BASE_URL}/api/v1/chat/health`;  // 健康检查
const SESSIONS_ENDPOINT = `${API_BASE_URL}/api/v1/sessions`;  // 会话管理 - 修正端点

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
    return `<img src="../public/Q.png" alt="Quest AI" style="width: 80%; height: 80%; border-radius: 50%; object-fit: contain;" class="ai-avatar-img">`;
}

// 会话管理功能
class SessionManager {
    constructor() {
        this.currentSession = null;
        this.sessions = [];
        this.memories = [];
    }

    // 获取会话列表
    async getSessions(userId, page = 1, size = 20) {
        try {
            const token = auth.getCurrentToken();
            const headers = {
                'Content-Type': 'application/json'
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const url = `${SESSIONS_ENDPOINT}?user_id=${userId}&page=${page}&size=${size}`;
            console.log('🔍 获取会话列表请求:', url);
            console.log('🔍 尝试的端点:', SESSIONS_ENDPOINT);

            const response = await fetch(url, {
                headers
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ 获取会话列表失败:', response.status, errorText);
                console.log('🔍 尝试的URL:', url);
                console.log('🔍 请求头:', headers);
                
                // 如果是404，尝试不同的端点格式
                if (response.status === 404) {
                    console.log('🔄 404错误，会话端点可能不正确');
                    console.log('💡 建议检查后端API的会话端点配置');
                }
                
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            const data = await response.json();
            this.sessions = data.sessions || [];
            console.log('✅ 获取会话列表成功:', data);
            return data;
        } catch (error) {
            console.error('❌ 获取会话列表失败:', error);
            return { sessions: [], total: 0 };
        }
    }

    // 创建新会话
    async createSession(userId, title = null) {
        try {
            const token = auth.getCurrentToken();
            const headers = {
                'Content-Type': 'application/json'
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const requestBody = {
                user_id: userId,
                title: title || '新对话'
            };

            console.log('🔍 创建会话请求:', requestBody);

            const response = await fetch(SESSIONS_ENDPOINT, {
                method: 'POST',
                headers,
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ 创建会话失败:', response.status, errorText);
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            const session = await response.json();
            this.currentSession = session;
            console.log('✅ 创建会话成功:', session);
            return session;
        } catch (error) {
            console.error('❌ 创建会话失败:', error);
            throw error;
        }
    }

    // 获取会话详情
    async getSession(sessionId) {
        try {
            const token = auth.getCurrentToken();
            const headers = {
                'Content-Type': 'application/json'
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(`${SESSIONS_ENDPOINT}/${sessionId}`, {
                headers
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('获取会话详情失败:', error);
            throw error;
        }
    }

    // 获取会话消息
    async getSessionMessages(sessionId, limit = 50) {
        try {
            const token = auth.getCurrentToken();
            const headers = {
                'Content-Type': 'application/json'
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(`${SESSIONS_ENDPOINT}/${sessionId}/messages?limit=${limit}`, {
                headers
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('获取会话消息失败:', error);
            return { messages: [] };
        }
    }

    // 获取完整上下文（包括记忆）
    async getSessionContext(sessionId, limitMessages = 20) {
        try {
            const token = auth.getCurrentToken();
            const headers = {
                'Content-Type': 'application/json'
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const url = `${SESSIONS_ENDPOINT}/${sessionId}/context?limit_messages=${limitMessages}`;
            console.log('🧠 获取会话上下文API调用:');
            console.log('  - URL:', url);
            console.log('  - Session ID:', sessionId);
            console.log('  - Limit Messages:', limitMessages);
            console.log('  - Headers:', headers);

            const response = await fetch(url, {
                headers
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ 获取会话上下文失败:', response.status, errorText);
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }

            const context = await response.json();
            console.log('✅ 会话上下文API响应:', context);
            console.log('  - Messages:', context.messages?.length || 0);
            console.log('  - Memories:', context.memories?.length || 0);
            
            this.memories = context.memories || [];
            return context;
        } catch (error) {
            console.error('❌ 获取会话上下文失败:', error);
            return { messages: [], memories: [] };
        }
    }

    // 删除会话
    async deleteSession(sessionId) {
        try {
            const token = auth.getCurrentToken();
            const headers = {
                'Content-Type': 'application/json'
            };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(`${SESSIONS_ENDPOINT}/${sessionId}`, {
                method: 'DELETE',
                headers
            });

            return response.ok;
        } catch (error) {
            console.error('删除会话失败:', error);
            return false;
        }
    }
}

// 创建全局会话管理器实例
const sessionManager = new SessionManager();

// UI组件管理
class ChatUI {
    constructor() {
        this.sidebarOpen = false;
        this.memoryPanelOpen = false;
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        // 侧边栏相关元素
        this.sessionSidebar = document.getElementById('sessionSidebar');
        this.sessionsList = document.getElementById('sessionsList');
        this.newSessionBtn = document.getElementById('newSessionBtn');
        this.closeSidebarBtn = document.getElementById('closeSidebarBtn');
        this.sidebarToggle = document.getElementById('sidebarToggle');

        // 记忆面板相关元素
        this.memoryPanel = document.getElementById('memoryPanel');
        this.memoriesList = document.getElementById('memoriesList');
        this.closeMemoryBtn = document.getElementById('closeMemoryBtn');
        this.memoryIndicator = document.getElementById('memoryIndicator');
        this.memoryCount = document.getElementById('memoryCount');

        // 聊天相关元素
        this.chatLogo = document.getElementById('chatLogo');
    }

    bindEvents() {
        // 侧边栏事件
        this.sidebarToggle?.addEventListener('click', () => this.toggleSidebar());
        this.closeSidebarBtn?.addEventListener('click', () => this.closeSidebar());
        this.newSessionBtn?.addEventListener('click', () => this.createNewSession());

        // 记忆面板事件
        this.closeMemoryBtn?.addEventListener('click', () => this.closeMemoryPanel());
        this.memoryIndicator?.addEventListener('click', () => this.toggleMemoryPanel());

        // Logo点击事件
        this.chatLogo?.addEventListener('click', () => {
            window.location.href = '/';
        });

        // 点击外部关闭面板
        document.addEventListener('click', (e) => {
            if (this.sidebarOpen && !this.sessionSidebar.contains(e.target) && !this.sidebarToggle.contains(e.target)) {
                this.closeSidebar();
            }
            if (this.memoryPanelOpen && !this.memoryPanel.contains(e.target) && !this.memoryIndicator.contains(e.target)) {
                this.closeMemoryPanel();
            }
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.sidebarOpen) {
                    this.closeSidebar();
                }
                if (this.memoryPanelOpen) {
                    this.closeMemoryPanel();
                }
            }
            // Ctrl/Cmd + B 切换侧边栏
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                this.toggleSidebar();
            }
        });
    }

    // 侧边栏管理
    toggleSidebar() {
        this.sidebarOpen = !this.sidebarOpen;
        this.sessionSidebar.classList.toggle('open', this.sidebarOpen);
        this.sidebarToggle.classList.toggle('active', this.sidebarOpen);
        
        // 当侧边栏打开时隐藏侧边栏按钮
        if (this.sidebarOpen) {
            this.sidebarToggle.classList.add('hidden');
        } else {
            this.sidebarToggle.classList.remove('hidden');
        }
        
        // 保存侧边栏状态到localStorage
        localStorage.setItem('quest-sidebar-open', this.sidebarOpen.toString());
        
        // 更新切换按钮的图标
        this.updateSidebarToggleIcon();
        
        // 调整布局
        this.adjustLayout();
    }

    closeSidebar() {
        this.sidebarOpen = false;
        this.sessionSidebar.classList.remove('open');
        this.sidebarToggle.classList.remove('active');
        
        // 显示侧边栏按钮
        this.sidebarToggle.classList.remove('hidden');
        
        // 保存状态
        localStorage.setItem('quest-sidebar-open', 'false');
        
        // 更新切换按钮的图标
        this.updateSidebarToggleIcon();
        
        // 调整布局
        this.adjustLayout();
    }

    // 调整布局以适应侧边栏状态
    adjustLayout() {
        // CSS已经处理了宽度变化，这里只需要确保flex布局正确
        const chatContainer = document.querySelector('.chat-container');
        const sidebar = this.sessionSidebar;
        const chatMain = document.querySelector('.chat-main-container');
        
        chatContainer.style.flexDirection = 'row';
        
        // 调试信息
        if (this.sidebarOpen) {
            console.log('📐 侧边栏打开');
            console.log('  - 侧边栏宽度:', sidebar.offsetWidth + 'px');
            console.log('  - 聊天区域宽度:', chatMain.offsetWidth + 'px');
        } else {
            console.log('📐 侧边栏关闭');
            console.log('  - 侧边栏宽度:', sidebar.offsetWidth + 'px');
            console.log('  - 聊天区域宽度:', chatMain.offsetWidth + 'px');
            console.log('  - 容器总宽度:', chatContainer.offsetWidth + 'px');
        }
    }

    updateSidebarToggleIcon() {
        const icon = this.sidebarToggle.querySelector('svg path');
        if (this.sidebarOpen) {
            // 显示关闭图标
            icon.setAttribute('d', 'M18 6L6 18M6 6l12 12');
        } else {
            // 显示菜单图标
            icon.setAttribute('d', 'M3 12h18M3 6h18M3 18h18');
        }
    }

    // 初始化侧边栏状态
    initializeSidebarState() {
        const savedState = localStorage.getItem('quest-sidebar-open');
        if (savedState === 'true') {
            this.sidebarOpen = true;
            this.sessionSidebar.classList.add('open');
            this.sidebarToggle.classList.add('active');
            // 如果侧边栏是打开的，隐藏按钮
            this.sidebarToggle.classList.add('hidden');
        } else {
            // 确保按钮显示
            this.sidebarToggle.classList.remove('hidden');
        }
        this.updateSidebarToggleIcon();
        this.adjustLayout();
    }

    // 记忆面板管理
    toggleMemoryPanel() {
        this.memoryPanelOpen = !this.memoryPanelOpen;
        this.memoryPanel.classList.toggle('open', this.memoryPanelOpen);
    }

    closeMemoryPanel() {
        this.memoryPanelOpen = false;
        this.memoryPanel.classList.remove('open');
    }

    // 会话管理
    async createNewSession() {
        try {
            const user = getCurrentUserInfo();
            if (!user) {
                alert('Please login first');
                return;
            }

            const session = await sessionManager.createSession(user.id || user.user_id, 'New Chat');
            this.updateChatTitle(session.title || 'New Chat');
            this.closeSidebar();
            
            // 清空当前消息
            this.clearMessages();
            
            // 清空记忆显示（新会话没有记忆）
            this.renderMemories([]);
            
            // 重新加载会话列表
            await this.loadSessions();
            
            console.log('✅ 创建新会话成功:', session);
        } catch (error) {
            console.error('❌ 创建新会话失败:', error);
            alert('Failed to create new session, please try again');
        }
    }

    async loadSessions() {
        try {
            const user = getCurrentUserInfo();
            if (!user) {
                this.sessionsList.innerHTML = '<div class="no-sessions">请先登录</div>';
                return;
            }

            const data = await sessionManager.getSessions(user.id || user.user_id);
            this.renderSessions(data.sessions || []);
        } catch (error) {
            console.error('❌ 加载会话列表失败:', error);
            this.sessionsList.innerHTML = '<div class="error-sessions">Failed to load</div>';
        }
    }

        renderSessions(sessions) {
            if (sessions.length === 0) {
                this.sessionsList.innerHTML = '<div class="no-sessions">No chat history</div>';
                return;
            }

        this.sessionsList.innerHTML = sessions.map(session => `
            <div class="session-item ${session.id === sessionManager.currentSession?.id ? 'active' : ''}" 
                 data-session-id="${session.id}">
                <div class="session-title">${session.title || 'Untitled Chat'}</div>
                <div class="session-meta">
                    <span>${session.message_count || 0} messages</span>
                    <span>${new Date(session.updated_at).toLocaleDateString()}</span>
                </div>
                <div class="session-actions">
                    <button class="delete-session-btn" data-session-id="${session.id}" title="Delete chat">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');

        // 绑定会话点击事件
        this.sessionsList.querySelectorAll('.session-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.delete-session-btn')) return;
                const sessionId = item.dataset.sessionId;
                this.switchToSession(sessionId);
            });
        });

        // 绑定删除按钮事件
        this.sessionsList.querySelectorAll('.delete-session-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const sessionId = btn.dataset.sessionId;
                if (confirm('确定要删除这个对话吗？')) {
                    await this.deleteSession(sessionId);
                }
            });
        });
    }

    async switchToSession(sessionId) {
        try {
            this.sessionsList.innerHTML = '<div class="loading-sessions">加载中...</div>';
            
            console.log('🔄 切换到会话:', sessionId);
            const context = await sessionManager.getSessionContext(sessionId);
            sessionManager.currentSession = { id: sessionId };
            
            // 更新UI
            this.updateChatTitle(context.title || 'Chat');
            this.renderMessages(context.messages || []);
            
            // 更新记忆显示
            if (context.memories && context.memories.length > 0) {
                this.renderMemories(context.memories);
                console.log('🧠 会话记忆:', context.memories.length, '条');
            } else {
                this.renderMemories([]);
                console.log('ℹ️ 会话暂无记忆');
            }
            
            this.closeSidebar();
            
            console.log('✅ 切换到会话成功:', sessionId);
        } catch (error) {
            console.error('❌ 切换会话失败:', error);
            alert('Failed to switch session, please try again');
        }
    }

    async deleteSession(sessionId) {
        try {
            const success = await sessionManager.deleteSession(sessionId);
            if (success) {
                // 如果删除的是当前会话，清空消息
                if (sessionManager.currentSession?.id === sessionId) {
                    this.clearMessages();
                    this.updateChatTitle('Quest AI Assistant');
                    sessionManager.currentSession = null;
                }
                
                // 重新加载会话列表
                await this.loadSessions();
                console.log('✅ 删除会话成功');
            } else {
                throw new Error('Delete failed');
            }
        } catch (error) {
            console.error('❌ 删除会话失败:', error);
            alert('Failed to delete session, please try again');
        }
    }

    // 消息管理
    renderMessages(messages) {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = '';

        messages.forEach(message => {
            const containerDiv = document.createElement('div');
            containerDiv.className = `message-container ${message.role}`;
            
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${message.role}`;
            messageDiv.textContent = message.content;
            
            const avatarDiv = document.createElement('div');
            avatarDiv.className = 'message-avatar';
            
            if (message.role === 'user') {
                const user = getCurrentUserInfo();
                avatarDiv.innerHTML = getUserAvatar(user);
            } else {
                avatarDiv.innerHTML = getAIAvatar();
            }
            
            containerDiv.appendChild(avatarDiv);
            containerDiv.appendChild(messageDiv);
            chatMessages.appendChild(containerDiv);
        });

        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    clearMessages() {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = `
            <div class="demo-notice">
                <strong>✨ Welcome to Quest AI:</strong> I'm your intelligent companion, ready to explore your personal knowledge collection and provide thoughtful insights tailored just for you.
            </div>
            
            <div class="message-container assistant">
                <div class="message-avatar">
                    <img src="../public/Q.png" alt="Quest AI" style="width: 80%; height: 80%; border-radius: 50%; object-fit: contain;" class="ai-avatar-img">
                </div>
                <div class="message assistant">
                    Hi 👋 I'm Quest's AI assistant.<br>
                    I use your saved content to give smarter, context-based answers.<br>
                    Ask me about your notes, articles, or research, and I'll pull up what's most relevant for you!
                </div>
            </div>
        `;
    }

    // 记忆管理
    renderMemories(memories) {
        if (!memories || memories.length === 0) {
            // 没有记忆时隐藏记忆按钮
            this.memoryIndicator.style.display = 'none';
            this.memoriesList.innerHTML = '<div class="empty-memories">暂无记忆</div>';
            this.memoryCount.textContent = '0';
            return;
        }

        // 有记忆时显示记忆按钮
        this.memoryIndicator.style.display = 'flex';
        this.memoryCount.textContent = memories.length;

        this.memoriesList.innerHTML = memories.map(memory => `
            <div class="memory-item" style="background-color: ${this.getMemoryColor(memory.memory_type)}">
                <div class="memory-header">
                    <span class="memory-icon">${this.getMemoryIcon(memory.memory_type)}</span>
                    <span class="memory-type">${memory.memory_type.replace('_', ' ')}</span>
                    <span class="importance-score">${Math.round(memory.importance_score * 100)}%</span>
                </div>
                <div class="memory-content">${memory.content}</div>
                <div class="memory-date">${new Date(memory.created_at).toLocaleDateString()}</div>
            </div>
        `).join('');
        
        console.log('🧠 渲染记忆:', memories.length, '条记忆');
    }

    getMemoryIcon(type) {
        const icons = {
            'user_preference': '👤',
            'fact': '📊',
            'context': '📝',
            'insight': '💡'
        };
        return icons[type] || '🧠';
    }

    getMemoryColor(type) {
        const colors = {
            'user_preference': '#e3f2fd',
            'fact': '#f3e5f5',
            'context': '#e8f5e8',
            'insight': '#fff3e0'
        };
        return colors[type] || '#f5f5f5';
    }

    updateChatTitle(title) {
        // 现在使用logo，不需要更新标题
        // 但保留这个方法以防其他地方调用
        console.log('Chat title updated to:', title);
    }
}

// 创建UI管理器实例
const chatUI = new ChatUI();

// 聊天完成后更新记忆显示
async function updateMemoriesAfterChat() {
    try {
        if (sessionManager.currentSession && sessionManager.currentSession.id) {
            console.log('🧠 聊天完成，更新记忆显示...');
            
            // 获取最新的会话上下文
            const context = await sessionManager.getSessionContext(sessionManager.currentSession.id);
            
            // 更新记忆显示
            if (context.memories && context.memories.length > 0) {
                chatUI.renderMemories(context.memories);
                console.log('✅ 记忆更新成功，共', context.memories.length, '条记忆');
            } else {
                console.log('ℹ️ 当前会话暂无记忆');
            }
        }
    } catch (error) {
        console.error('❌ 更新记忆失败:', error);
    }
}

// 初始化侧边栏状态
chatUI.initializeSidebarState();

// Check API health on load
async function checkApiHealth() {
    try {
        console.log('🔍 检查API健康状态:', HEALTH_ENDPOINT);
        const response = await fetch(HEALTH_ENDPOINT);
        if (response.ok) {
            const data = await response.json();
            // API健康检查成功，但不显示状态（除非用户已登录）
            console.log('✅ API健康检查成功:', data);
            apiStatus.style.display = 'none';
            
            // 测试API集成
            await testApiIntegration();
        } else {
            console.error('❌ API健康检查失败，状态码:', response.status);
            throw new Error(`Health check failed with status: ${response.status}`);
        }
    } catch (error) {
        console.error('❌ API健康检查错误:', error);
        console.log('🔍 尝试的端点:', HEALTH_ENDPOINT);
        // API连接失败时完全隐藏状态
        apiStatus.style.display = 'none';
    }
}

// 测试API集成功能
async function testApiIntegration() {
    try {
        const user = getCurrentUserInfo();
        if (user) {
            console.log('🧪 测试API集成功能...');
            
            // 测试获取会话列表
            const sessionsData = await sessionManager.getSessions(user.id || user.user_id, 1, 5);
            console.log('✅ 会话列表API测试通过:', sessionsData);
            
            // 如果有会话，测试获取上下文和记忆
            if (sessionsData.sessions && sessionsData.sessions.length > 0) {
                const firstSession = sessionsData.sessions[0];
                console.log('🧪 测试会话上下文API:', firstSession.id);
                
                const contextData = await sessionManager.getSessionContext(firstSession.id);
                console.log('✅ 上下文API测试通过:', contextData);
                
                // 特别检查记忆数据
                if (contextData.memories && contextData.memories.length > 0) {
                    console.log('🧠 发现记忆数据:', contextData.memories.length, '条');
                    contextData.memories.forEach((memory, index) => {
                        console.log(`  记忆 ${index + 1}:`, {
                            type: memory.memory_type,
                            content: memory.content?.substring(0, 50) + '...',
                            importance: memory.importance_score
                        });
                    });
                } else {
                    console.log('ℹ️ 该会话暂无记忆数据');
                }
            } else {
                console.log('ℹ️ 用户暂无会话');
            }
        } else {
            console.log('ℹ️ 用户未登录，跳过API测试');
        }
    } catch (error) {
        console.warn('⚠️ API集成测试失败:', error);
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
        
        // 构建请求体，尝试不同的格式
        let requestBody;
        
        if (userId) {
            // 用户已登录的请求格式
            requestBody = {
                message: message,  // 尝试使用message而不是question
                user_id: userId
            };
            
            console.log('🔍 发送聊天请求，用户ID:', userId);
            
            // 如果有当前会话，添加会话ID
            if (sessionManager.currentSession && sessionManager.currentSession.id) {
                requestBody.session_id = sessionManager.currentSession.id;
                console.log('🔍 使用现有会话ID:', sessionManager.currentSession.id);
            }
        } else {
            // 用户未登录的请求格式
            requestBody = {
                message: message
            };
            console.warn('⚠️ 用户未登录，发送匿名请求');
        }
        
        // 添加调试信息
        console.log('🚀 API请求信息:');
        console.log('  - URL:', CHAT_ENDPOINT);
        console.log('  - Method: POST');
        console.log('  - Headers:', headers);
        console.log('  - Body:', requestBody);
        
        const response = await fetch(CHAT_ENDPOINT, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ 聊天API请求失败:', response.status, errorText);
            console.log('🔍 请求体:', requestBody);
            console.log('🔍 请求头:', headers);
            
            // 422错误通常是请求格式问题
            if (response.status === 422) {
                console.log('🔄 422错误，请求格式可能不正确');
                console.log('💡 建议检查请求体格式和必需参数');
            }
            
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        // 从响应头获取会话ID
        const sessionIdFromResponse = response.headers.get('X-Session-ID');
        if (sessionIdFromResponse && !sessionManager.currentSession) {
            // 如果是新会话，创建会话对象
            sessionManager.currentSession = { id: sessionIdFromResponse };
            console.log('🆕 创建新会话:', sessionIdFromResponse);
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
                            
                            // 聊天完成后，更新记忆显示
                            await updateMemoriesAfterChat();
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
    
    // 默认隐藏API状态，保持界面简洁
    statusElement.style.display = 'none';
    
    // 可选：只在用户已登录时显示连接状态（取消注释下面的代码）
    /*
    if (isAuthenticated && user) {
        statusElement.className = 'api-status connected';
        statusElement.innerHTML = `🟢 AI Connected • ${user.nickname || user.email || 'User'}`;
        statusElement.style.display = 'block';
    }
    */
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

// 初始化memory按钮显示 - 不显示记忆，等待会话加载
// chatUI.renderMemories([]);  // 注释掉，让记忆按钮在会话加载时自动显示

// 加载会话列表
chatUI.loadSessions();

// 监听认证状态变化
auth.subscribe((authState) => {
    console.log('🔔 认证状态变化:', authState.isAuthenticated ? '已登录' : '未登录');
    updateUserStatus();
    // 重新加载会话列表
    chatUI.loadSessions();
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
