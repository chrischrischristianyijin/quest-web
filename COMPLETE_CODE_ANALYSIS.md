# Quest Web App - Complete Code Analysis for Data Persistence Issue

## Problem Summary
**Issue**: Insights and stacks disappear after page refresh despite localStorage backup implementation.

## Complete Code Files

### 1. Main Application Logic
**File**: `src/client/js/my-space.js`

```javascript
import { auth } from './auth.js';
import { api } from './api.js';
import { API_CONFIG } from './config.js';
import { PATHS, navigateTo } from './paths.js';

// DOM Element Cache for Performance Optimization
const DOM_CACHE = new Map();

function getCachedElement(selector) {
    if (!DOM_CACHE.has(selector)) {
        const element = document.querySelector(selector);
        if (element) {
            DOM_CACHE.set(selector, element);
        }
    }
    return DOM_CACHE.get(selector);
}

function getCachedElementById(id) {
    const selector = `#${id}`;
    if (!DOM_CACHE.has(selector)) {
        const element = document.getElementById(id);
        if (element) {
            DOM_CACHE.set(selector, element);
        }
    }
    return DOM_CACHE.get(selector);
}

// DOM 元素 - Using cached access for better performance
const profileAvatar = getCachedElementById('profileAvatar');
const usernamePlaceholder = getCachedElementById('usernamePlaceholder');
const contentCards = getCachedElementById('contentCards');
const headerLogout = getCachedElementById('headerLogout');
const headerEditProfile = getCachedElementById('headerEditProfile');
const headerAvatar = getCachedElementById('headerAvatar');
const addContentForm = getCachedElementById('addContentForm');
const addContentModal = getCachedElementById('addContentModal');
const closeAddModal = getCachedElementById('closeAddModal');
const cancelAddBtn = getCachedElementById('cancelAddBtn');

const filterButtons = getCachedElementById('filterButtons');

// 页面状态
let currentUser = null;
let currentInsights = [];
let currentFilters = {
    latest: 'latest',  // 时间排序
    tags: null         // 标签筛选
};
let isEditMode = false; // Edit mode state
let draggedCard = null;
let dragOffset = { x: 0, y: 0 };
let stackHoverTimeout = null;
let stacks = new Map(); // Store stacks data
let stackIdCounter = 1;

// 页面初始化
async function initPage() {
    try {
        console.log('🚀 初始化My Space页面...');
        console.log('🔍 Debug: auth module available:', typeof auth);
        console.log('🔍 Debug: api module available:', typeof api);
        
        // 恢复会话状态
        try {
            auth.restoreSession();
            console.log('✅ Session restore completed');
        } catch (sessionError) {
            console.error('❌ Session restore failed:', sessionError);
        }
        
        // 检查认证状态（放宽：先尝试恢复会话后再判断，避免闪跳）
        console.log('🔍 Debug: Checking auth status...');
        const isAuthenticated = auth.checkAuth();
        console.log('🔍 Debug: Auth status:', isAuthenticated);
        
        if (!isAuthenticated) {
            console.log('⚠️ 未检测到会话，尝试恢复...');
            const restored = auth.restoreSession();
            console.log('🔍 Debug: Session restoration result:', restored);
            
            if (!restored) {
                console.log('❌ 无会话可恢复，保持在当前页并提示登录');
                showErrorMessage('Please sign in to use My Space.');
                
                // 即使未认证，也绑定基础UI事件（如用户资料编辑）
                console.log('🔧 未认证状态下绑定基础UI事件...');
                bindProfileEditEvents();
                
                return;
            }
        }
        
        // 检查token是否过期（放宽：不过期也允许继续加载基础UI）
        const tokenOk = await auth.checkAndHandleTokenExpiration();
        if (!tokenOk) {
            console.log('⏰ Token校验失败，继续以降级模式加载My Space UI');
        }
        
        console.log('✅ 认证状态正常，继续初始化...');
        
        // 并行加载所有数据以提高性能
        const [profileResult, insightsResult, tagsResult, stacksResult] = await Promise.allSettled([
            loadUserProfile(),
            loadUserInsights(),
            loadUserTags(),
            loadUserStacks()
        ]);
        
        // 检查每个加载结果并记录错误
        if (profileResult.status === 'rejected') {
            console.error('❌ 用户资料加载失败:', profileResult.reason);
        }
        if (stacksResult.status === 'rejected') {
            console.error('❌ 用户stacks加载失败:', stacksResult.reason);
        }
        if (insightsResult.status === 'rejected') {
            console.error('❌ 用户insights加载失败:', insightsResult.reason);
        }
        if (tagsResult.status === 'rejected') {
            console.error('❌ 用户标签加载失败:', tagsResult.reason);
        }
        
        // 初始化过滤器按钮
        initFilterButtons();
        
        // 绑定事件
        bindEvents();
        
        // 绑定编辑模式按钮事件
        bindEditModeEvents();
        
        // Set up event delegation for card interactions (performance optimization)
        setupCardEventDelegation();
        
        console.log('✅ My Space页面初始化完成');
    } catch (error) {
        console.error('❌ 页面初始化失败:', error);
        
        // 如果是认证错误，重定向到登录页面
        if (error.message.includes('认证已过期') || error.message.includes('请重新登录')) {
            window.location.href = PATHS.LOGIN;
            return;
        }
        
        showErrorMessage('页面初始化失败，请刷新重试');
    }
}

// 加载用户stacks
async function loadUserStacks() {
    try {
        console.log('📚 开始加载用户stacks...');
        
        // 检查认证状态
        if (!auth.checkAuth()) {
            console.warn('⚠️ 用户未认证，跳过stacks加载');
            return;
        }
        
        try {
            // Load all insights and group them by stack_id
            const response = await api.getInsights();
            
            console.log('🔍 Stack loading API response:', response);
            
            if (response.success && response.data) {
                // Handle different response structures
                let allInsights;
                if (Array.isArray(response.data)) {
                    allInsights = response.data;
                } else if (response.data.insights && Array.isArray(response.data.insights)) {
                    allInsights = response.data.insights;
                } else if (response.data.data && Array.isArray(response.data.data)) {
                    allInsights = response.data.data;
                } else {
                    console.warn('⚠️ Unexpected API response structure:', response.data);
                    allInsights = [];
                }
                
                stacks.clear(); // 清空现有stacks
                
                console.log('🔍 All insights loaded:', allInsights.length);
                console.log('🔍 Sample insight fields:', allInsights[0] ? Object.keys(allInsights[0]) : 'No insights');
                console.log('🔍 Insights with stack_id:', allInsights.filter(i => i.stack_id));
                
                // Group insights by stack_id
                const stackGroups = {};
                allInsights.forEach(insight => {
                    if (insight.stack_id) {
                        console.log('🔍 Found insight with stack_id:', insight.id, '->', insight.stack_id);
                        if (!stackGroups[insight.stack_id]) {
                            stackGroups[insight.stack_id] = [];
                        }
                        stackGroups[insight.stack_id].push(insight);
                    }
                });
                
                // Create stack objects from grouped insights
                Object.entries(stackGroups).forEach(([stackId, stackInsights]) => {
                    if (stackInsights.length >= 2) { // Only create stacks with 2+ items
                        const stackData = {
                            id: stackId,
                            name: 'Stack', // Default name
                            cards: stackInsights,
                            createdAt: stackInsights[0]?.created_at || new Date().toISOString(),
                            modifiedAt: stackInsights[0]?.modified_at || new Date().toISOString(),
                            isExpanded: false
                        };
                        
                        stacks.set(stackId, stackData);
                    }
                });
                
                // Always try to load metadata from localStorage to preserve user preferences
                console.log('🔍 Loading stack metadata from localStorage...');
                const savedStacks = localStorage.getItem('quest_stacks');
                if (savedStacks) {
                    try {
                        const stackEntries = JSON.parse(savedStacks);
                        stackEntries.forEach(([stackId, stackData]) => {
                            if (stacks.has(stackId)) {
                                // Merge metadata from localStorage with database data
                                const existingStack = stacks.get(stackId);
                                if (existingStack && stackData.name) {
                                    existingStack.name = stackData.name;
                                    existingStack.isExpanded = stackData.isExpanded || false;
                                    console.log('🔍 Merged stack metadata from localStorage:', stackId);
                                }
                            } else {
                                // Load stack from localStorage if not found in database
                                stacks.set(stackId, stackData);
                                console.log('🔍 Loaded stack from localStorage:', stackId);
                            }
                        });
                    } catch (error) {
                        console.error('❌ Failed to parse saved stacks:', error);
                    }
                }
                
                // If no stacks found in database, try loading from localStorage
                if (Object.keys(stackGroups).length === 0 && stacks.size === 0) {
                    console.log('🔍 No stacks found in database or localStorage');
                }
                
                // 更新stackIdCounter
                if (Object.keys(stackGroups).length > 0) {
                    const maxTimestamp = Math.max(...Object.keys(stackGroups).map(id => {
                        const timestamp = id.split('_')[1];
                        return timestamp ? parseInt(timestamp) : 0;
                    }));
                    stackIdCounter = Math.max(stackIdCounter, maxTimestamp + 1);
                }
                
                console.log('✅ 用户stacks加载成功:', stacks.size, '个stacks');
            } else {
                console.warn('⚠️ 没有stacks数据或API返回格式错误，尝试从localStorage加载');
                // Try loading from localStorage as fallback
                const savedStacks = localStorage.getItem('quest_stacks');
                if (savedStacks) {
                    try {
                        const stackEntries = JSON.parse(savedStacks);
                        stackEntries.forEach(([stackId, stackData]) => {
                            stacks.set(stackId, stackData);
                            console.log('🔍 Loaded stack from localStorage:', stackId);
                        });
                    } catch (error) {
                        console.error('❌ Failed to parse saved stacks:', error);
                    }
                }
            }
        } catch (apiError) {
            console.error('❌ API调用失败:', apiError);
            // 如果API调用失败，继续使用本地存储
            console.log('🔍 API failed, trying localStorage fallback...');
            const savedStacks = localStorage.getItem('quest_stacks');
            if (savedStacks) {
                try {
                    const stackEntries = JSON.parse(savedStacks);
                    stackEntries.forEach(([stackId, stackData]) => {
                        stacks.set(stackId, stackData);
                        console.log('🔍 Loaded stack from localStorage:', stackId);
                    });
                } catch (error) {
                    console.error('❌ Failed to parse saved stacks:', error);
                }
            }
        }
    } catch (error) {
        console.error('❌ 加载用户stacks失败:', error);
    }
}

// 加载用户见解
async function loadUserInsights() {
    try {
        console.log('📚 开始加载用户insights...');
        console.log('🔍 Auth status before API call:', auth.checkAuth());
        console.log('🔍 Current user:', auth.getCurrentUser());
        
        // 使用新的API方法获取insights
        const response = await api.getInsights();
        
        console.log('📡 API响应:', response);
        console.log('🔍 Response structure:', {
            success: response?.success,
            hasData: !!response?.data,
            dataKeys: response?.data ? Object.keys(response.data) : 'no data',
            insightsCount: response?.data?.insights?.length || 0
        });
        
        if (response.success && response.data && response.data.insights) {
            // Filter out insights that are already in stacks
            const allInsights = response.data.insights;
            currentInsights = allInsights.filter(insight => !insight.stack_id);
            console.log('✅ 用户insights加载成功:', allInsights.length, '条');
            console.log('📚 过滤掉已在stacks中的insights后:', currentInsights.length, '条');
            
            // Save insights to localStorage as backup with timestamp
            try {
                const insightsBackup = {
                    data: currentInsights,
                    timestamp: Date.now(),
                    version: '1.0'
                };
                localStorage.setItem('quest_insights_backup', JSON.stringify(insightsBackup));
                console.log('💾 Insights saved to localStorage backup');
            } catch (storageError) {
                console.warn('⚠️ Failed to save insights to localStorage:', storageError);
            }
            
            // 检查每个insight的标签数据
            currentInsights.forEach((insight, index) => {
                console.log(`📖 Insight ${index + 1}:`, {
                    id: insight.id,
                    title: insight.title || insight.url,
                    tags: insight.tags,
                    tagsType: typeof insight.tags,
                    tagsLength: insight.tags ? insight.tags.length : 'null/undefined',
                    tagIds: insight.tag_ids,
                    allFields: Object.keys(insight)
                });
                
                // 详细检查标签数据结构
                if (insight.tags && insight.tags.length > 0) {
                    insight.tags.forEach((tag, tagIndex) => {
                        console.log(`  🏷️ Tag ${tagIndex + 1}:`, {
                            tag: tag,
                            type: typeof tag,
                            isObject: tag && typeof tag === 'object',
                            hasId: tag && tag.id,
                            hasName: tag && tag.name
                        });
                    });
                }
            });
            
            // Normalize tag structure for all insights first
            currentInsights.forEach(insight => {
                if (insight.tags && insight.tags.length > 0) {
                    // Normalize tag structure - backend returns {tag_id, name, color}, frontend expects {id, name, color}
                    insight.tags = insight.tags.map(tag => ({
                        id: tag.tag_id || tag.id,
                        name: tag.name,
                        color: tag.color
                    }));
                }
            });
            
            // Check if insights have tags, if not, try to load them separately
            const insightsWithoutTags = currentInsights.filter(insight => !insight.tags || insight.tags.length === 0);
            if (insightsWithoutTags.length > 0) {
                console.log('⚠️ Found insights without tags, attempting to load tags separately...');
                await loadTagsForInsights(insightsWithoutTags);
            }
            
            renderInsights();
        } else {
            console.warn('⚠️ API返回格式不正确:', response);
            console.log('🔍 响应数据结构:', {
                success: response.success,
                hasData: !!response.data,
                dataKeys: response.data ? Object.keys(response.data) : 'no data',
                insightsField: response.data ? response.data.insights : 'no insights field'
            });
            
            // Try loading from localStorage backup
            console.log('📦 Attempting to load insights from localStorage backup...');
            const backupInsights = localStorage.getItem('quest_insights_backup');
            if (backupInsights) {
                try {
                    const backup = JSON.parse(backupInsights);
                    // Check if backup is recent (within 24 hours)
                    const isRecent = backup.timestamp && (Date.now() - backup.timestamp < 24 * 60 * 60 * 1000);
                    if (isRecent && backup.data) {
                        currentInsights = backup.data;
                        console.log('📦 Loaded recent insights from localStorage backup:', currentInsights.length);
                    } else {
                        console.log('📦 Backup is too old or invalid, using empty array');
                        currentInsights = [];
                    }
                } catch (error) {
                    console.error('❌ Failed to parse backup insights:', error);
                    currentInsights = [];
                }
            } else {
                currentInsights = [];
            }
            renderInsights();
        }
    } catch (error) {
        console.error('❌ 加载用户insights失败:', error);
        
        // Try loading from localStorage backup before showing error
        console.log('📦 Attempting to load insights from localStorage backup after error...');
        const backupInsights = localStorage.getItem('quest_insights_backup');
        if (backupInsights) {
            try {
                const backup = JSON.parse(backupInsights);
                // Check if backup is recent (within 24 hours)
                const isRecent = backup.timestamp && (Date.now() - backup.timestamp < 24 * 60 * 60 * 1000);
                if (isRecent && backup.data) {
                    currentInsights = backup.data;
                    console.log('📦 Loaded recent insights from localStorage backup after error:', currentInsights.length);
                    renderInsights();
                    return; // Don't show error if we successfully loaded from backup
                } else {
                    console.log('📦 Backup is too old or invalid after error, using empty array');
                    currentInsights = [];
                }
            } catch (parseError) {
                console.error('❌ Failed to parse backup insights:', parseError);
                currentInsights = [];
            }
        } else {
            currentInsights = [];
        }
        
        // 检查是否是后端服务问题
        if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
            showErrorMessage('Backend service temporarily unavailable. Please try again later.');
        } else if (error.message.includes('401') || error.message.includes('403')) {
            showErrorMessage('Authentication failed. Please log in again.');
            // 重定向到登录页面
            setTimeout(() => {
                window.location.href = PATHS.LOGIN;
            }, 2000);
        } else {
            showErrorMessage('Failed to load insights. Please refresh and try again.');
        }
        
        renderInsights();
    }
}

// Save stacks to localStorage (called periodically to prevent data loss)
function saveStacksToLocalStorage() {
    try {
        const stacksData = Array.from(stacks.entries());
        localStorage.setItem('quest_stacks', JSON.stringify(stacksData));
        console.log('💾 Saved stacks to localStorage:', stacksData.length, 'stacks');
    } catch (error) {
        console.error('❌ Failed to save stacks to localStorage:', error);
    }
}

// Save insights to localStorage backup
function saveInsightsToLocalStorage() {
    try {
        const insightsBackup = {
            data: currentInsights,
            timestamp: Date.now(),
            version: '1.0'
        };
        localStorage.setItem('quest_insights_backup', JSON.stringify(insightsBackup));
        console.log('💾 Saved insights to localStorage backup:', currentInsights.length, 'insights');
    } catch (error) {
        console.error('❌ Failed to save insights to localStorage:', error);
    }
}

// Auto-save stacks and insights every 30 seconds to prevent data loss
setInterval(() => {
    saveStacksToLocalStorage();
    saveInsightsToLocalStorage();
}, 30000);

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initPage);
```

### 2. Authentication Management
**File**: `src/client/js/auth.js`

```javascript
import { api } from './api.js';

// 用户状态管理
class AuthManager {
    constructor() {
        this.user = null;
        this.isAuthenticated = false;
        this.listeners = [];
        this.init();
    }

    // 初始化
    init() {
        // 检查本地存储的用户会话
        const session = localStorage.getItem('quest_user_session');
        if (session) {
            try {
                const parsed = JSON.parse(session);
                if (parsed.user && parsed.timestamp) {
                    // 检查会话是否过期（24小时）
                    const now = Date.now();
                    if (now - parsed.timestamp < 24 * 60 * 60 * 1000) {
                        this.user = parsed.user;
                        this.isAuthenticated = true;
                        this.notifyListeners();
                    } else {
                        // 会话过期，清除
                        this.clearSession();
                    }
                }
            } catch (error) {
                console.error('解析用户会话失败:', error);
                this.clearSession();
            }
        }
    }

    // 用户登录
    async login(email, password) {
        try {
            console.log('🔐 开始登录流程...', { email });
            const result = await api.login({ email, password });
            console.log('📡 API 响应结果:', result);
            
            if (result && result.success && result.user) {
                console.log('✅ 登录成功，获取到 token:', result.token);
                
                // 设置认证 token
                api.setAuthToken(result.token);
                
                // 获取完整的用户资料
                try {
                    console.log('🔍 获取用户完整资料...');
                    const profileResult = await api.getUserProfile();
                    console.log('📡 用户资料 API 响应:', profileResult);
                    
                    if (profileResult && profileResult.success && profileResult.data) {
                        this.user = profileResult.data;
                        console.log('✅ 获取到完整用户信息:', this.user);
                        // 更新本地存储的会话数据
                        this.saveSession(this.user, result.token);
                    } else {
                        // 如果获取资料失败，尝试使用不同的响应格式
                        console.warn('⚠️ 获取用户资料失败，尝试其他响应格式');
                        console.warn('⚠️ Profile API response structure:', {
                            hasSuccess: !!profileResult?.success,
                            hasData: !!profileResult?.data,
                            fullResponse: profileResult
                        });
                        
                        // 尝试直接使用 profileResult 作为用户数据（某些API可能直接返回用户数据）
                        if (profileResult && (profileResult.id || profileResult.email)) {
                            console.log('✅ 使用直接返回的用户数据');
                            this.user = profileResult;
                            // 更新本地存储的会话数据
                            this.saveSession(this.user, result.token);
                        } else {
                            // 最后回退到登录返回的基本信息
                            console.warn('⚠️ 使用基本登录信息作为回退');
                            this.user = result.user;
                        }
                    }
                } catch (profileError) {
                    console.warn('⚠️ 获取用户资料时出错，使用基本登录信息:', profileError);
                    console.warn('⚠️ Profile API error details:', {
                        error: profileError.message,
                        stack: profileError.stack
                    });
                    this.user = result.user;
                }
                
                this.isAuthenticated = true;
                
                // 保存用户会话
                this.saveSession(this.user, result.token);
                
                this.notifyListeners();
                return { success: true, user: this.user };
            } else {
                throw new Error(result?.message || '登录失败');
            }
        } catch (error) {
            console.error('❌ 登录失败:', error);
            return { success: false, message: error.message || '登录失败，请重试' };
        }
    }

    // 用户登出
    async logout() {
        try {
            console.log('🚪 开始用户登出流程...');
            
            // 直接清除本地状态，不需要调用后端API
            this.clearSession();
            this.notifyListeners();
            
            console.log('✅ 登出成功');
            return { success: true };
            
        } catch (error) {
            console.error('❌ 登出错误:', error);
            // 即使出错，也要清除本地会话
            this.clearSession();
            this.notifyListeners();
            return { success: false, message: error.message };
        }
    }

    // 保存用户会话
    saveSession(user, token) {
        if (token) {
            // 只在一个地方存储token：quest_user_session
            api.setAuthToken(token);
        }
        
        localStorage.setItem('quest_user_session', JSON.stringify({
            user,
            token: token,
            timestamp: Date.now()
        }));
        
        console.log('💾 会话已保存:', { 
            user: user.email || user.username, 
            hasToken: !!token,
            sessionToken: !!localStorage.getItem('quest_user_session')
        });
    }

    // 清除用户会话
    clearSession() {
        console.log('🗑️ 开始清理用户会话...');
        
        // 清除用户状态
        this.user = null;
        this.isAuthenticated = false;
        
        // 清除所有token存储
        api.setAuthToken(null);
        localStorage.removeItem('quest_user_session');
        localStorage.removeItem('authToken'); // 清理可能存在的旧存储
        
        // 清除其他可能存在的相关存储
        localStorage.removeItem('quest_user_profile');
        localStorage.removeItem('quest_user_insights');
        
        console.log('✅ 会话已完全清除');
    }

    // 获取当前用户
    getCurrentUser() {
        return this.user;
    }

    // 检查是否已认证
    checkAuth() {
        return this.isAuthenticated;
    }

    // 订阅状态变化
    subscribe(listener) {
        this.listeners.push(listener);
        // 立即调用一次
        listener(this);
        
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }

    // 通知监听器
    notifyListeners() {
        this.listeners.forEach(listener => {
            try {
                listener(this);
            } catch (error) {
                console.error('状态监听器错误:', error);
            }
        });
    }
    
    // 恢复会话状态
    restoreSession() {
        try {
            console.log('🔄 开始恢复会话状态...');
            const sessionData = localStorage.getItem('quest_user_session');
            console.log('📦 会话数据:', sessionData ? '存在' : '不存在');
            
            if (sessionData) {
                const session = JSON.parse(sessionData);
                console.log('🔍 解析的会话数据:', {
                    hasUser: !!session.user,
                    hasToken: !!session.token,
                    timestamp: session.timestamp
                });
                
                const now = Date.now();
                const sessionAge = now - session.timestamp;
                
                // 检查会话是否过期（24小时）
                console.log('🔍 会话年龄检查:', {
                    sessionAge: sessionAge,
                    sessionAgeHours: sessionAge / (1000 * 60 * 60),
                    maxAge: 24 * 60 * 60 * 1000,
                    maxAgeHours: 24,
                    isExpired: sessionAge >= 24 * 60 * 60 * 1000,
                    sessionTimestamp: session.timestamp,
                    currentTime: now,
                    timeDiff: now - session.timestamp
                });
                
                if (sessionAge < 24 * 60 * 60 * 1000) {
                    console.log('🔄 恢复会话状态...');
                    this.user = session.user;
                    this.isAuthenticated = true;
                    
                    // 恢复 token - 只从 quest_user_session 恢复
                    if (session.token) {
                        console.log('🔑 从会话恢复 token...');
                        api.setAuthToken(session.token);
                        console.log('✅ Token恢复成功，当前API token状态:', api.authToken ? '已设置' : '未设置');
                    } else {
                        console.log('⚠️ 会话中没有token，清除会话');
                        this.clearSession();
                        return false;
                    }
                    
                    this.notifyListeners();
                    return true;
                } else {
                    console.log('⏰ 会话已过期');
                    this.clearSession();
                    return false;
                }
            } else {
                console.log('📦 没有找到会话数据');
                return false;
            }
        } catch (error) {
            console.error('❌ 恢复会话状态失败:', error);
            this.clearSession();
            return false;
        }
    }

    // 验证token是否有效
    async validateToken() {
        try {
            if (!this.isAuthenticated || !this.user) {
                console.log('⚠️ 用户未认证，无法验证token');
                return false;
            }
            
            // 尝试获取用户资料来验证token
            const profileResult = await api.getUserProfile();
            if (profileResult && profileResult.success) {
                console.log('✅ Token验证成功');
                return true;
            } else {
                console.log('❌ Token验证失败');
                return false;
            }
        } catch (error) {
            console.error('❌ Token验证出错:', error);
            if (error.message.includes('401') || error.message.includes('403')) {
                console.log('🔑 Token已过期，清除会话');
                this.clearSession();
            }
            return false;
        }
    }
    
    // 获取当前token
    getCurrentToken() {
        try {
            const sessionData = localStorage.getItem('quest_user_session');
            if (sessionData) {
                const session = JSON.parse(sessionData);
                return session.token || null;
            }
            return null;
        } catch (error) {
            console.error('获取token失败:', error);
            return null;
        }
    }
    
    // 检查token是否存在
    hasValidToken() {
        const token = this.getCurrentToken();
        return !!token;
    }

    // 检查token是否过期
    isTokenExpired() {
        const session = localStorage.getItem('quest_user_session');
        if (!session) return true;
        
        try {
            const parsed = JSON.parse(session);
            if (!parsed.timestamp) return true;
            
            const now = Date.now();
            const sessionAge = now - parsed.timestamp;
            
            // 24小时过期
            return sessionAge >= 24 * 60 * 60 * 1000;
        } catch (error) {
            console.error('检查token过期失败:', error);
            return true;
        }
    }

    // 刷新token（如果需要的话）
    async refreshToken() {
        try {
            console.log('🔄 尝试刷新token...');
            
            // 检查是否有有效的会话
            if (!this.isAuthenticated || !this.user) {
                throw new Error('没有有效的会话可以刷新');
            }
            
            // 这里可以调用后端刷新token的API
            // 目前后端没有提供刷新token的接口，所以直接返回false
            console.log('⚠️ 后端暂不支持token刷新');
            return false;
        } catch (error) {
            console.error('刷新token失败:', error);
            return false;
        }
    }

    // 检查并处理token过期
    async checkAndHandleTokenExpiration() {
        if (this.isTokenExpired()) {
            console.log('⏰ Token已过期，尝试刷新...');
            
            const refreshed = await this.refreshToken();
            if (!refreshed) {
                console.log('❌ Token刷新失败，清除会话');
                this.clearSession();
                return false;
            }
        }
        
        return true;
    }
    
    // 刷新用户资料数据
    async refreshUserProfile() {
        try {
            console.log('🔄 刷新用户资料数据...');
            const profileResult = await api.getUserProfile();
            console.log('📡 刷新用户资料 API 响应:', profileResult);
            
            if (profileResult && profileResult.success && profileResult.data) {
                this.user = profileResult.data;
                console.log('✅ 用户资料刷新成功:', this.user);
                // 更新本地存储
                this.saveSession(this.user, this.getCurrentToken());
                this.notifyListeners();
                return true;
            } else if (profileResult && (profileResult.id || profileResult.email)) {
                this.user = profileResult;
                console.log('✅ 用户资料刷新成功 (直接格式):', this.user);
                // 更新本地存储
                this.saveSession(this.user, this.getCurrentToken());
                this.notifyListeners();
                return true;
            } else {
                console.warn('⚠️ 用户资料刷新失败，响应格式异常');
                return false;
            }
        } catch (error) {
            console.error('❌ 刷新用户资料失败:', error);
            return false;
        }
    }
}

// 创建全局认证管理器实例
export const auth = new AuthManager();
```

### 3. API Service Layer
**File**: `src/client/js/api.js`

```javascript
import { API_CONFIG } from './config.js';

// API服务类
class ApiService {
    constructor() {
        this.baseUrl = API_CONFIG.API_BASE_URL;
        this.authToken = null;
    }

    // 设置认证token
    setAuthToken(token) {
        this.authToken = token;
        console.log('🔑 Token已设置:', token ? '存在' : '不存在');
    }

    // 通用请求方法
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        
        // Debug: Log token status for non-GET requests
        if ((options.method || 'GET') !== 'GET') {
            console.log('🔍 API Request Debug:', {
                endpoint,
                method: options.method || 'GET',
                hasToken: !!this.authToken,
                tokenPreview: this.authToken ? `${this.authToken.substring(0, 20)}...` : 'None'
            });
        }
        
        // Check cache for GET requests
        if ((options.method || 'GET') === 'GET' && window.apiCache) {
            const cached = window.apiCache.get(url);
            if (cached) {
                logger.log(`📦 Cache hit: ${url}`);
                return cached;
            }
        }
        
        // 设置默认headers
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        // 添加认证token
        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        } else {
            console.warn('⚠️ No auth token available for request:', endpoint);
        }

        // 如果是FormData，移除Content-Type让浏览器自动设置
        if (options.body instanceof FormData) {
            delete headers['Content-Type'];
        }

        const config = {
            method: options.method || 'GET',
            headers,
            ...options
        };

        try {
            logger.log(`📡 API请求: ${config.method} ${url}`);
            const response = await fetch(url, config);
            
            logger.log(`📡 API响应: ${response.status} ${response.statusText}`);
            
            // 处理认证错误
            if (response.status === 401 || response.status === 403) {
                console.error('❌ 认证失败:', response.status, response.statusText);
                // 清除无效的token
                this.setAuthToken(null);
                localStorage.removeItem('authToken');
                localStorage.removeItem('quest_user_session');
                
                // Try to get more specific error message from response
                let errorMessage = '认证已过期，请重新登录';
                try {
                    const errorData = await response.json();
                    if (errorData.detail) {
                        errorMessage = errorData.detail;
                    }
                } catch (e) {
                    // If we can't parse the error response, use default message
                }
                
                throw new Error(errorMessage);
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.detail || errorData.message || response.statusText;
                console.error('❌ API错误响应:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorData: errorData,
                    errorMessage: errorMessage
                });
                throw new Error(`HTTP ${response.status}: ${errorMessage}`);
            }

            const data = await response.json();
            logger.log('✅ API响应成功:', data);
            
            // Cache successful GET responses
            if ((options.method || 'GET') === 'GET' && window.apiCache) {
                window.apiCache.set(url, data);
            }
            
            return data;
        } catch (error) {
            console.error('❌ API请求错误:', error);
            throw error;
        }
    }

    // 获取用户所有insights（不分页）
    async getInsights(userId = null, search = '') {
        let endpoint = API_CONFIG.INSIGHTS.ALL;
        const params = new URLSearchParams();
        
        if (userId) params.append('user_id', userId);
        if (search) params.append('search', search);
        
        // Add parameter to include tags in the response
        params.append('include_tags', 'true');
        
        if (params.toString()) {
            endpoint += `?${params.toString()}`;
        }
        
        console.log('📡 Fetching insights with endpoint:', endpoint);
        return await this.request(endpoint);
    }

    // 创建insight
    async createInsight(insightData) {
        return await this.request(API_CONFIG.INSIGHTS.CREATE, {
            method: 'POST',
            body: JSON.stringify(insightData)
        });
    }

    // 更新insight
    async updateInsight(insightId, insightData) {
        return await this.request(`${API_CONFIG.INSIGHTS.UPDATE}/${insightId}`, {
            method: 'PUT',
            body: JSON.stringify(insightData)
        });
    }

    // 删除insight
    async deleteInsight(insightId) {
        return await this.request(`${API_CONFIG.INSIGHTS.DELETE}/${insightId}`, {
            method: 'DELETE'
        });
    }

    // 获取用户资料
    async getUserProfile() {
        return await this.request(API_CONFIG.USER.PROFILE);
    }

    // 用户登录
    async login(credentials) {
        try {
            console.log('🔐 开始用户登录...', credentials);
            const response = await fetch(`${this.baseUrl}${API_CONFIG.AUTH.LOGIN}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(credentials)
            });

            const result = await response.json();
            console.log('📡 登录API响应:', result);

            if (result.success) {
                // 兼容多种返回格式：
                // A) { success, data: { user_id, email, access_token } }
                // B) { success, data: { user, access_token } }
                // C) { success, user, access_token }
                // D) { success, data: { success, message, data: { user, access_token } } }
                const dataLevel1 = result.data || {};
                const dataLevel2 = dataLevel1.data || {};

                const token = result.access_token 
                    || dataLevel1.access_token 
                    || dataLevel2.access_token 
                    || result.token 
                    || dataLevel1.token 
                    || dataLevel2.token 
                    || null;

                const user = result.user 
                    || dataLevel1.user 
                    || dataLevel2.user 
                    || {
                        id: dataLevel1.user_id || dataLevel2.user_id || null,
                        email: dataLevel1.email || dataLevel2.email || credentials.email
                    };

                if (token) {
                    this.setAuthToken(token);
                }

                return {
                    success: true,
                    user,
                    token
                };
            } else {
                throw new Error(result.detail || '登录失败');
            }
        } catch (error) {
            console.error('❌ 登录失败:', error);
            throw error;
        }
    }
}

// 创建API实例
export const api = new ApiService();
```

### 4. Cache Management
**File**: `src/client/js/cache.js`

```javascript
// Simple in-memory cache for API responses
class ApiCache {
    constructor() {
        this.cache = new Map();
        this.ttl = 5 * 60 * 1000; // 5 minutes TTL
    }

    set(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        // Check if expired
        if (Date.now() - item.timestamp > this.ttl) {
            this.cache.delete(key);
            return null;
        }

        return item.data;
    }

    delete(key) {
        return this.cache.delete(key);
    }

    clear() {
        this.cache.clear();
    }

    // Clear specific patterns
    clearPattern(pattern) {
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }
}

// Create global cache instance
window.apiCache = new ApiCache();
```

### 5. Configuration
**File**: `src/client/js/config.js`

```javascript
// Quest 应用配置
export const CONFIG = {
    // API 配置 - 直接使用后端地址
    API_BASE_URL: 'https://quest-api-edz1.onrender.com',
    API_VERSION: 'v1',
    
    // 应用配置
    APP_NAME: 'Quest',
    APP_DESCRIPTION: 'Curate your world',
    
    // 功能开关
    FEATURES: {
        GOOGLE_AUTH: true,
        USER_TAGS: true,
        SHARING: true
    }
};

// API配置
export const API_CONFIG = {
    // 基础URL
    API_BASE_URL: 'https://quest-api-edz1.onrender.com',
    
    // 认证相关接口
    AUTH: {
        REGISTER: '/api/v1/auth/signup',
        LOGIN: '/api/v1/auth/login',
        LOGOUT: '/api/v1/auth/signout',
        PROFILE: '/api/v1/auth/profile',
        FORGOT_PASSWORD: '/api/v1/auth/forgot-password'
    },
    
    // 用户管理接口
    USER: {
        PROFILE: '/api/v1/user/profile',
        UPLOAD_AVATAR: '/api/v1/user/upload-avatar'
    },
    
    // 元数据相关接口
    METADATA: {
        EXTRACT: '/api/v1/metadata/extract',
        CREATE_INSIGHT: '/api/v1/metadata/create-insight'
    },
    
    // 见解管理接口
    INSIGHTS: {
        LIST: '/api/v1/insights',
        ALL: '/api/v1/insights/all',
        GET: '/api/v1/insights',
        CREATE: '/api/v1/insights',
        UPDATE: '/api/v1/insights',
        DELETE: '/api/v1/insights'
    },
    
    // 标签管理接口
    USER_TAGS: {
        LIST: '/api/v1/user-tags',
        GET: '/api/v1/user-tags',
        CREATE: '/api/v1/user-tags',
        UPDATE: '/api/v1/user-tags',
        DELETE: '/api/v1/user-tags',
        SEARCH: '/api/v1/user-tags/search'
    },
    
    // 堆叠管理接口
    STACKS: {
        LIST: '/api/v1/stacks',
        GET: '/api/v1/stacks',
        CREATE: '/api/v1/stacks',
        UPDATE: '/api/v1/stacks',
        DELETE: '/api/v1/stacks',
        ITEMS: '/api/v1/stacks/items'
    },
    
    // 系统接口
    SYSTEM: {
        HEALTH: '/health',
        INFO: '/'
    }
};
```

## Critical Analysis Points

### 1. Data Flow Issues
- **Session Management**: 24-hour session expiration might be clearing localStorage
- **API Cache**: 5-minute TTL might serve stale data
- **localStorage Backup**: 24-hour freshness check might be too strict
- **Race Conditions**: Parallel loading might cause conflicts

### 2. Authentication Issues
- **Token Expiration**: 401/403 errors clear localStorage
- **Session Restoration**: Complex logic might fail silently
- **Token Validation**: Might trigger unnecessary data clearing

### 3. Storage Issues
- **localStorage Quota**: Might be exceeded
- **Data Corruption**: JSON parsing might fail
- **Synchronization**: Database and localStorage might be out of sync

### 4. Error Handling Issues
- **Silent Failures**: Errors might not be properly caught
- **Fallback Logic**: Might not work as expected
- **Recovery Mechanisms**: Might not be comprehensive enough

## Recommended Investigation Steps

1. **Monitor localStorage State**: Check what's actually stored
2. **Track API Calls**: Monitor all network requests
3. **Check Console Errors**: Look for JavaScript errors
4. **Test Authentication Flow**: Verify session management
5. **Test Edge Cases**: Network failures, storage limits, etc.

## Expected Outcome

The higher-level AI should identify the specific failure point and provide a targeted solution that ensures reliable data persistence across all scenarios.
