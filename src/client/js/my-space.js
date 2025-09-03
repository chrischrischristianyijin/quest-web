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
// Make currentInsights globally accessible for event handlers
window.currentInsights = currentInsights;
// Cache for user tags to reduce API calls
let cachedUserTags = null;
let userTagsCacheTime = 0;
const USER_TAGS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
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

// Pagination state for insights
const PAGE_SIZE = 9;
let insightsPage = 1;
let insightsHasMore = true;
let insightsLoading = false;
const renderedInsightIds = new Set();
let insightsObserver = null;

// Guard flags to prevent autosave from overwriting with empty data
let hasLoadedStacksOnce = false;
let hasLoadedInsightsOnce = false;


// 页面初始化
async function initPage() {
    try {
        // 恢复会话状态
        try {
            auth.restoreSession();
        } catch (sessionError) {
            console.error('❌ Session restore failed:', sessionError);
        }
        
        // 检查认证状态（放宽：先尝试恢复会话后再判断，避免闪跳）
        const isAuthenticated = auth.checkAuth();
        
        if (!isAuthenticated) {
            const restored = auth.restoreSession();
            
            if (!restored) {
                showErrorMessage('Please sign in. Showing last local backup.');
                
                // 即使未认证，也绑定基础UI事件（如用户资料编辑）
                bindProfileEditEvents();
                
                // 不要return，允许加载本地备份数据
            }
        }
        
        // 检查token是否过期（放宽：不过期也允许继续加载基础UI）
        const tokenOk = await auth.checkAndHandleTokenExpiration();
        if (!tokenOk) {
            // Token校验失败，继续以降级模式加载My Space UI
        }
        
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
        
        // Fallback: Ensure infinite scroll is set up even if loadUserInsights didn't call it
        setTimeout(() => {
            if (!insightsObserver) {
                setupInsightsInfiniteScroll();
            }
        }, 1000);
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
        // 允许在未认证时也从 localStorage 加载，避免数据丢失
        const unauthenticated = !auth.checkAuth();
        if (unauthenticated) {
            const saved = localStorage.getItem('quest_stacks');
            if (saved) {
                try {
                    const entries = JSON.parse(saved);
                    stacks.clear();
                    entries.forEach(([id, data]) => stacks.set(id, data));
                    if (stacks.size > 0) hasLoadedStacksOnce = true;
                } catch (e) {
                    console.error('❌ 解析本地 stacks 失败:', e);
                }
            }
            // 在未认证时不要继续调用后端
            return;
        }
        
        try {
            // Load all insights and group them by stack_id
            const response = await api.getInsights();
            
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
                
                // Group insights by stack_id
                const stackGroups = {};
                allInsights.forEach(insight => {
                    if (insight.stack_id) {
                        if (!stackGroups[insight.stack_id]) {
                            stackGroups[insight.stack_id] = [];
                        }
                        stackGroups[insight.stack_id].push(insight);
                    }
                });
                
                // Create stack objects from grouped insights
                Object.entries(stackGroups).forEach(([stackId, stackInsights]) => {
                    if (stackInsights.length > 0) {
                        const stackData = {
                            id: stackId,
                            name: 'Stack',
                            cards: stackInsights,
                            createdAt: stackInsights[0].created_at || new Date().toISOString(),
                            modifiedAt: stackInsights[0].modified_at || new Date().toISOString(),
                            isExpanded: false
                        };
                        
                        stacks.set(stackId, stackData);
                    }
                });
                
                // Always try to load metadata from localStorage to preserve user preferences
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
                                }
                            } else {
                                // Load stack from localStorage if not found in database
                                stacks.set(stackId, stackData);
                            }
                        });
                    } catch (error) {
                        console.error('❌ Failed to parse saved stacks:', error);
                    }
                }
                
                // 更新stackIdCounter
                if (Object.keys(stackGroups).length > 0) {
                    const maxTimestamp = Math.max(...Object.keys(stackGroups).map(id => {
                        const timestamp = id.split('_')[1];
                        return timestamp ? parseInt(timestamp) : 0;
                    }));
                    stackIdCounter = maxTimestamp + 1;
                }
            
            // 验证one-to-one约束 (现在由数据库保证)
            const allInsightIds = new Set();
            let hasDuplicates = false;
            
            stacks.forEach(stack => {
                stack.cards.forEach(card => {
                    if (allInsightIds.has(card.id)) {
                        console.warn('⚠️ 发现重复的insight ID:', card.id, '违反one-to-one约束');
                        hasDuplicates = true;
                    }
                    allInsightIds.add(card.id);
                });
            });
            
            if (hasDuplicates) {
                console.error('❌ 数据违反one-to-one约束，请检查后端数据');
            }
            
                if (stacks.size > 0) hasLoadedStacksOnce = true;
            } else {
                // Try loading from localStorage as fallback
                const savedStacks = localStorage.getItem('quest_stacks');
                if (savedStacks) {
                    try {
                        const stackEntries = JSON.parse(savedStacks);
                        stackEntries.forEach(([stackId, stackData]) => {
                            stacks.set(stackId, stackData);
                        });
                        if (stacks.size > 0) hasLoadedStacksOnce = true;
                    } catch (error) {
                        console.error('❌ Failed to parse saved stacks:', error);
                    }
                }
            }
        } catch (apiError) {
            console.error('❌ API调用失败:', apiError);
            // 如果API调用失败，继续使用本地存储
            const savedStacks = localStorage.getItem('quest_stacks');
            if (savedStacks) {
                try {
                    const stackEntries = JSON.parse(savedStacks);
                    stackEntries.forEach(([stackId, stackData]) => {
                        stacks.set(stackId, stackData);
                    });
                    if (stacks.size > 0) hasLoadedStacksOnce = true;
                } catch (error) {
                    console.error('❌ Failed to parse saved stacks:', error);
                }
            }
        }
        } catch (error) {
            console.error('❌ 加载用户stacks失败:', error);
            // 如果stacks端点不存在，继续使用本地存储
            if (error.message.includes('404') || error.message.includes('Not Found')) {
                // Stacks API端点尚未实现，使用本地存储模式
            }
            // 不抛出错误，允许页面继续加载
        }
}


// 加载用户资料
async function loadUserProfile() {
    try {
        // 再次检查认证状态
        if (!auth.checkAuth()) {
            throw new Error('用户未认证');
        }
        
        // 总是尝试从 API 获取最新的用户资料
        try {
            const response = await api.getUserProfile();
            
            if (response.success && response.data) {
                currentUser = response.data;
                // 更新auth管理器中的用户数据
                auth.user = currentUser;
                auth.saveSession(currentUser, auth.getCurrentToken());
                updateUserProfileUI();
                return;
            } else if (response && (response.id || response.email)) {
                // 如果API直接返回用户数据而不是包装在success/data中
                currentUser = response;
                // 更新auth管理器中的用户数据
                auth.user = currentUser;
                auth.saveSession(currentUser, auth.getCurrentToken());
                updateUserProfileUI();
                return;
            } else {
                console.warn('⚠️ 后端用户资料格式异常，尝试使用本地存储');
                throw new Error('API 返回格式错误');
            }
        } catch (profileError) {
            console.warn('⚠️ Profile API 调用失败，使用本地存储作为回退:', profileError);
            
            // 回退到本地存储
            const localUser = auth.getCurrentUser();
            if (localUser) {
                currentUser = localUser;
                updateUserProfileUI();
                return;
            }
            
            // 最后的回退：使用默认用户信息
            currentUser = {
                id: 'user_' + Date.now(),
                email: 'user@example.com',
                nickname: 'User'
            };
            updateUserProfileUI();
        }
    } catch (error) {
        console.error('❌ 获取用户资料失败:', error);
        // 使用默认用户信息
        currentUser = {
            id: 'user_' + Date.now(),
            email: 'user@example.com',
            nickname: 'User'
        };
        updateUserProfileUI();
    }
}

// 更新用户资料UI
function updateUserProfileUI() {
    if (!currentUser) return;
    
    // Hide skeleton and show actual content
    const profileContainer = document.getElementById('profileContainer');
    const avatarSkeleton = document.getElementById('avatarSkeleton');
    const usernameSkeleton = document.getElementById('usernameSkeleton');
    const userAvatar = document.getElementById('userAvatar');
    const actualUsername = document.getElementById('actualUsername');
    
    if (profileContainer) {
        profileContainer.classList.add('profile-loaded');
    }
    
    // Hide skeletons
    if (avatarSkeleton) {
        avatarSkeleton.style.display = 'none';
    }
    if (usernameSkeleton) {
        usernameSkeleton.style.display = 'none';
    }
    
    // 更新头像
    if (userAvatar) {
        if (currentUser.avatar_url) {
            userAvatar.src = currentUser.avatar_url;
            userAvatar.style.display = 'block';
        } else {
            // 如果没有头像URL，使用默认头像或隐藏
            userAvatar.style.display = 'block';
            // 可以设置一个默认头像或者保持当前状态
        }
    }
    
    // 更新用户名
    if (actualUsername) {
        // 尝试多种可能的显示名称字段
        const displayName = currentUser.nickname || 
                           currentUser.username || 
                           currentUser.name || 
                           currentUser.display_name ||
                           currentUser.email || 
                           'User';
        
        actualUsername.textContent = displayName;
        actualUsername.style.display = 'inline';
    }
    
    // 更新header头像
    if (headerAvatar) {
        if (currentUser.avatar_url) {
            headerAvatar.src = currentUser.avatar_url;
        }
    }
    
    // 更新header欢迎消息
    const welcomeMessage = document.querySelector('.WelcomeToYourPersonalSpacePlaceholder');
    if (welcomeMessage) {
        const displayName = currentUser.nickname || 
                           currentUser.username || 
                           currentUser.name || 
                           currentUser.display_name ||
                           currentUser.email || 
                           'User';
        welcomeMessage.textContent = `Welcome, ${displayName}!`;
    }
}

// 加载用户见解
async function loadUserInsights() {
    try {
        // 使用分页API方法获取insights
        insightsLoading = true;
        const response = await api.getInsightsPaginated(1, PAGE_SIZE, null, '', true);
        
        if (response?.success) {
            const { items, hasMore } = normalizePaginatedInsightsResponse(response);
            const firstBatch = (items || []).filter(x => !x.stack_id);
            // normalize tags to {id,name,color} (you already do this later; keep it)
            currentInsights = firstBatch;
            window.currentInsights = currentInsights;
            insightsPage = 1;
            insightsHasMore = hasMore;
            renderedInsightIds.clear();
            firstBatch.forEach(i => renderedInsightIds.add(i.id));
            if (currentInsights.length > 0) hasLoadedInsightsOnce = true;
            
            // Save insights to localStorage as backup with timestamp
            try {
                const insightsBackup = {
                    data: currentInsights,
                    timestamp: Date.now(),
                    version: '1.0'
                };
                localStorage.setItem('quest_insights_backup', JSON.stringify(insightsBackup));
            } catch (storageError) {
                console.warn('⚠️ Failed to save insights to localStorage:', storageError);
            }
            
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
                await loadTagsForInsights(insightsWithoutTags);
            }
            
            renderInsightsInitial();      // new: only clears once and renders current batch
            setupInsightsInfiniteScroll();// new: attaches observer/sentinel
        } else {
            // Try loading from localStorage backup
            const backupInsights = localStorage.getItem('quest_insights_backup');
            if (backupInsights) {
                try {
                    const backup = JSON.parse(backupInsights);
                    // Check if backup is recent (within 24 hours)
                    const isRecent = backup.timestamp && (Date.now() - backup.timestamp < 24 * 60 * 60 * 1000);
                    // For unexpected response format, prefer backup if present (even if stale)
                    if (Array.isArray(backup.data)) {
                        currentInsights = backup.data;
                        window.currentInsights = currentInsights;
                        if (currentInsights.length > 0) hasLoadedInsightsOnce = true;
                    } else {
                        currentInsights = [];
                        window.currentInsights = currentInsights;
                    }
                } catch (error) {
                    console.error('❌ Failed to parse backup insights:', error);
                    currentInsights = [];
                    window.currentInsights = currentInsights;
                }
            } else {
                currentInsights = [];
                window.currentInsights = currentInsights;
            }
            renderInsights();
        }
    } catch (error) {
        console.error('❌ 加载用户insights失败:', error);
        
        // Try loading from localStorage backup before showing error
        const backupInsights = localStorage.getItem('quest_insights_backup');
        const isAuthErr = /401|403|unauthor/i.test(error?.message || '');
        const isNetErr = (typeof navigator !== 'undefined' && navigator.onLine === false) ||
                        /Failed to fetch|NetworkError/i.test(error?.message || '');
        if (backupInsights) {
            try {
                const backup = JSON.parse(backupInsights);
                // Check if backup is recent (within 24 hours)
                const isRecent = backup.timestamp && (Date.now() - backup.timestamp < 24 * 60 * 60 * 1000);
                // 认证/网络错误时允许使用"过期"备份，避免空数据
                if ((isRecent || isAuthErr || isNetErr) && Array.isArray(backup.data)) {
                    currentInsights = backup.data;
                    window.currentInsights = currentInsights;
                    if (currentInsights.length > 0) hasLoadedInsightsOnce = true;
                    renderInsights();
                    return; // Don't show error if we successfully loaded from backup
                } else {
                    currentInsights = [];
                    window.currentInsights = currentInsights;
                }
            } catch (parseError) {
                console.error('❌ Failed to parse backup insights:', parseError);
                currentInsights = [];
                window.currentInsights = currentInsights;
            }
        } else {
            currentInsights = [];
            window.currentInsights = currentInsights;
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
        
        renderInsightsInitial();
        setupInsightsInfiniteScroll();
    } finally {
        insightsLoading = false;
    }
}

// 渲染见解列表
function renderInsights() {
    if (!contentCards) {
        console.error('❌ contentCards element not found!');
        return;
    }
    
    // Hide loading skeleton
    const loadingSkeleton = getCachedElementById('loadingSkeleton');
    if (loadingSkeleton) {
        loadingSkeleton.style.display = 'none';
    }
    
    // Mark content as loaded
    contentCards.classList.add('content-loaded');
    
    // Clear existing content cards (but keep skeleton for next time)
    const existingCards = contentCards.querySelectorAll('.content-card, .empty-state');
    existingCards.forEach(card => card.remove());
    
    // Check if we have any content to render (insights OR stacks)
    const hasInsights = currentInsights.length > 0;
    const hasStacks = stacks.size > 0;
    
    if (!hasInsights && !hasStacks) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <div class="empty-state-icon">📚</div>
            <h3>No content collected yet</h3>
            <p>Start adding your favorite media content to your collection</p>
            <button class="btn btn-primary add-content-btn" onclick="showAddContentModal()">
                Add Content
            </button>
        `;
        contentCards.appendChild(emptyState);
        return;
    }
    
    // Use DocumentFragment for batch DOM operations to reduce reflows
    const fragment = document.createDocumentFragment();
    
    // Render individual insights if we have any
    if (hasInsights) {
        // 根据筛选条件排序
        let sortedInsights = getFilteredInsights();
        
        sortedInsights.forEach(insight => {
            const card = createInsightCard(insight);
            fragment.appendChild(card);
        });
    }
    
    // 渲染stacks
    if (hasStacks) {
        stacks.forEach(stackData => {
            const stackCard = createStackCard(stackData);
            fragment.appendChild(stackCard);
        });
    }
    
    // Single append to DOM for all cards (reduces reflows from N to 1)
    contentCards.appendChild(fragment);
    
    // Update edit mode state after rendering cards
    updateEditModeState();
}

// Create insight card element (using original structure)
function createInsightCardEl(insight) {
    // Use the original createInsightCard function
    return createInsightCard(insight);
}

function renderInsightsInitial() {
    const container = document.getElementById('contentCards');
    if (!container) {
        console.error('❌ contentCards element not found!');
        return;
    }
    
    container.innerHTML = '';
    
    // For initial render, show all insights (getFilteredInsights handles stack filtering)
    const filtered = getFilteredInsights();
    console.log('🎨 Rendering initial insights:', {
        totalInsights: currentInsights.length,
        filteredInsights: filtered.length,
        container: container
    });
    
    filtered.forEach(i => container.appendChild(createInsightCardEl(i)));
    ensureInsightsSentinel(container);
    
    // Update edit mode state after rendering cards
    updateEditModeState();
}

function appendInsightsBatch(newItems) {
    const container = document.getElementById('contentCards');
    if (!container) {
        console.error('❌ contentCards element not found!');
        return;
    }
    
    // Only append the new items, not all insights
    newItems.forEach(i => container.appendChild(createInsightCardEl(i)));
    // keep sentinel at the end
    ensureInsightsSentinel(container);
    
    // Update edit mode state after rendering cards
    updateEditModeState();
}

function ensureInsightsSentinel(container) {
    let sentinel = document.getElementById('insightsSentinel');
    if (!sentinel) {
        sentinel = document.createElement('div');
        sentinel.id = 'insightsSentinel';
        sentinel.style.height = '1px';
        sentinel.style.width = '100%';
        sentinel.style.opacity = '0';
        // sentinel.style.backgroundColor = 'red'; // Make it visible for debugging
    }
    container.appendChild(sentinel); // keep it as last child
    return sentinel;
}

function elementScrolls(el) {
    const s = getComputedStyle(el);
    const scrolls = /(auto|scroll)/.test(s.overflowY);
    return scrolls;
}

function setupInsightsInfiniteScroll() {
    const container = document.getElementById('contentCards');
    if (!container) {
        return;
    }

    const sentinel = ensureInsightsSentinel(container);

    if (insightsObserver) {
        insightsObserver.disconnect();
    }

    const rootEl = elementScrolls(container) ? container : null;

    insightsObserver = new IntersectionObserver(async (entries) => {
        const entry = entries[0];
        if (!entry.isIntersecting) return;
        if (!insightsHasMore || insightsLoading) return;
        await loadMoreInsights();
    }, { root: rootEl, rootMargin: '300px 0px', threshold: 0.01 });

    insightsObserver.observe(sentinel);

    // Fallback: if list is too short to scroll, keep prefetching until it fills
    requestAnimationFrame(maybePrefetchIfShort);
}

async function maybePrefetchIfShort() {
    const container = document.getElementById('contentCards');
    if (!container) {
        return;
    }
    const rootEl = insightsObserver?.root || null;
    const visibleH = rootEl ? rootEl.clientHeight : window.innerHeight;
    const contentH = container.scrollHeight;

    if (contentH <= visibleH + 16 && insightsHasMore && !insightsLoading) {
        await loadMoreInsights();       // already implemented here: calls API, appends, updates flags
        requestAnimationFrame(maybePrefetchIfShort);
    }
}

async function loadMoreInsights() {
    try {
        insightsLoading = true;
        const nextPage = insightsPage + 1;
        const resp = await api.getInsightsPaginated(nextPage, PAGE_SIZE, null, '', true);
        if (!resp?.success) return;

        const { items, hasMore } = normalizePaginatedInsightsResponse(resp);
        const batch = (items || []).filter(x => !x.stack_id);

        // normalize tags like you already do elsewhere
        batch.forEach(insight => {
            if (Array.isArray(insight.tags) && insight.tags.length > 0) {
                insight.tags = insight.tags.map(tag => ({
                    id: tag.tag_id || tag.id,
                    name: tag.name,
                    color: tag.color
                }));
            }
        });

        // de-dup
        const toAppend = batch.filter(i => !renderedInsightIds.has(i.id));
        toAppend.forEach(i => renderedInsightIds.add(i.id));

        currentInsights = currentInsights.concat(toAppend);
        window.currentInsights = currentInsights;
        appendInsightsBatch(toAppend);

        insightsPage = nextPage;
        insightsHasMore = hasMore;
        
        console.log('✅ LoadMoreInsights completed:', {
            page: insightsPage,
            hasMore: insightsHasMore,
            totalRendered: currentInsights.length
        });
    } catch (e) {
        console.error('loadMoreInsights failed:', e);
    } finally {
        insightsLoading = false;
    }
}

function resetInsightsPaginationAndRerender() {
    // Do NOT refetch page 1 from server here (keeps it snappy); just re-render what we have.
    const container = document.getElementById('contentCards');
    if (container) {
        container.innerHTML = '';
        renderedInsightIds.clear();
        currentInsights.forEach(i => renderedInsightIds.add(i.id));
        renderInsightsInitial();
    }
}

// Manual trigger for debugging
function forceLoadMore() {
    if (!insightsLoading && insightsHasMore) {
        return loadMoreInsights();
    }
    return Promise.resolve();
}





// Load tags for insights that don't have them
async function loadTagsForInsights(insights) {
    try {
        // Get all user tags first
        const tagsResponse = await getCachedUserTags();
        const allTags = tagsResponse.success ? tagsResponse.data : [];
        
        // For each insight without tags, try to find its tags
        for (const insight of insights) {
            try {
                // Try to get the insight individually to see if it has tags
                const insightResponse = await api.getInsight(insight.id);
                
                if (insightResponse.success && insightResponse.data) {
                    const fullInsight = insightResponse.data;
                    
                    if (fullInsight.tags && fullInsight.tags.length > 0) {
                        // Normalize tag structure - backend returns {tag_id, name, color}, frontend expects {id, name, color}
                        const normalizedTags = fullInsight.tags.map(tag => ({
                            id: tag.tag_id || tag.id,
                            name: tag.name,
                            color: tag.color
                        }));
                        
                        // Update the insight in currentInsights
                        const insightIndex = currentInsights.findIndex(i => i.id === insight.id);
                        if (insightIndex !== -1) {
                            currentInsights[insightIndex].tags = normalizedTags;
                        }
                    } else if (fullInsight.tag_ids && fullInsight.tag_ids.length > 0) {
                        // Convert tag_ids to tag objects
                        const tagObjects = fullInsight.tag_ids.map(tagId => {
                            const tag = allTags.find(t => t.id === tagId);
                            return tag || { id: tagId, name: 'Unknown Tag' };
                        });
                        
                        // Update the insight in currentInsights
                        const insightIndex = currentInsights.findIndex(i => i.id === insight.id);
                        if (insightIndex !== -1) {
                            currentInsights[insightIndex].tags = tagObjects;
                        }
                    }
                } else {
                    console.warn(`⚠️ Failed to get individual insight ${insight.id}:`, insightResponse);
                }
            } catch (error) {
                console.warn(`⚠️ Failed to load tags for insight ${insight.id}:`, error.message);
            }
        }
    } catch (error) {
        console.error('❌ Failed to load tags for insights:', error);
    }
}

// 创建见解卡片
function createInsightCard(insight) {
    const card = document.createElement('div');
    card.className = 'content-card';
    card.dataset.insightId = insight.id;
    
    // Add delete button for edit mode
    const editDeleteBtn = document.createElement('button');
    editDeleteBtn.className = 'content-card-delete-btn';
    editDeleteBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12H19" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    editDeleteBtn.title = 'Delete';
    editDeleteBtn.dataset.insightId = insight.id; // Store ID for event delegation
    card.appendChild(editDeleteBtn);
    
    // Add drag and drop functionality
    setupCardDragAndDrop(card, insight);
    
    // 卡片图片区域
    if (insight.image_url) {
        const imageContainer = document.createElement('div');
        imageContainer.className = 'content-card-image-container';
        
        const image = document.createElement('img');
        image.className = 'content-card-image';
        image.src = insight.image_url;
        image.alt = insight.title || 'Content image';
        image.loading = 'lazy';
        
        // 图片加载错误处理
        image.onerror = function() {
            this.style.display = 'none';
            this.parentElement.classList.add('no-image');
        };
        
        imageContainer.appendChild(image);
        card.appendChild(imageContainer);
    }
    
    // 卡片内容区域
    const cardContent = document.createElement('div');
    cardContent.className = 'content-card-content';
    
    // 卡片头部 - Top row with date and source info
    const cardHeader = document.createElement('div');
    cardHeader.className = 'content-card-header';
    
    // Top row: Date on left, source info on right
    const topRow = document.createElement('div');
    topRow.className = 'content-card-top-row';
    
    const headerDate = document.createElement('div');
    headerDate.className = 'content-card-date';
    headerDate.textContent = new Date(insight.created_at).toLocaleDateString('en-US');
    
    const sourceInfo = document.createElement('div');
    sourceInfo.className = 'content-card-source';
    
    const sourceLogo = document.createElement('div');
    sourceLogo.className = 'content-card-source-logo';
    // You can customize this based on the source
    sourceLogo.innerHTML = '🎵'; // Default music icon, can be replaced with actual logos
    
    const sourceName = document.createElement('span');
    sourceName.className = 'content-card-source-name';
    sourceName.textContent = getSourceName(insight.url);
    
    sourceInfo.appendChild(sourceLogo);
    sourceInfo.appendChild(sourceName);
    
    topRow.appendChild(headerDate);
    topRow.appendChild(sourceInfo);
    
    // Title below the top row
    const title = document.createElement('div');
    title.className = 'content-card-title';
    
    // Extract clean title (remove source name if it's concatenated)
    let cleanTitle = insight.title || 'Untitled';
    const sourceNameForTitle = getSourceName(insight.url);
    
    // If title contains source name, try to clean it
    if (cleanTitle.includes(sourceNameForTitle)) {
        cleanTitle = cleanTitle.replace(sourceNameForTitle, '').trim();
    }
    
    // For Wikipedia URLs, extract just the article title
    if (insight.url.includes('wikipedia.org')) {
        const urlPath = new URL(insight.url).pathname;
        const articleTitle = urlPath.split('/').pop().replace(/_/g, ' ');
        if (articleTitle && articleTitle !== cleanTitle) {
            cleanTitle = articleTitle;
        }
    }
    
    title.textContent = cleanTitle;
    
    cardHeader.appendChild(topRow);
    cardHeader.appendChild(title);
    
    // 卡片描述
    const description = document.createElement('div');
    description.className = 'content-card-description';
    description.textContent = insight.description || `Content from ${new URL(insight.url).hostname}`;
    
    // 标签功能已移除 - 只在底部显示主要标签
    
    // 卡片底部
    const cardFooter = document.createElement('div');
    cardFooter.className = 'content-card-footer';
    
    // Tag based on actual insight tags or default to Project
    const tag = document.createElement('div');
    tag.className = 'content-card-tag-main';
    
    // Use the first tag from insight.tags, or default to "Project"
    let tagText = 'Project'; // Default
    let tagId = null;
    
    if (insight.tags && insight.tags.length > 0) {
        const firstTag = insight.tags[0];
        if (typeof firstTag === 'string') {
            tagText = firstTag;
        } else if (firstTag && typeof firstTag === 'object') {
            tagText = firstTag.name || 'Project';
            tagId = firstTag.id;
        }
    }
    
    tag.textContent = tagText;
    tag.dataset.tagId = tagId || '';
    tag.dataset.insightId = insight.id;
    
    // Make tag clickable to edit tags
    tag.style.cursor = 'pointer';
    tag.onclick = () => openTagEditModal(insight);
    
    cardFooter.appendChild(tag);
    
    // 组装卡片内容
    cardContent.appendChild(cardHeader);
    cardContent.appendChild(description);
    // 标签区域只在有标签时才添加
    cardContent.appendChild(cardFooter);
    
    // 组装完整卡片
    card.appendChild(cardContent);
    
    // 使卡片可点击
    makeCardClickable(card, insight);
    
    return card;
}

// 为标签筛选器加载用户标签
async function loadUserTagsForFilter(dropdownOptions) {
    try {
        const response = await getCachedUserTags();
        const tags = response.success ? response.data : [];
        
        if (tags.length > 0) {
            // 为每个标签创建选项
            tags.forEach(tag => {
                const tagOption = document.createElement('div');
                tagOption.className = 'filter-option';
                tagOption.dataset.filter = `tag_${tag.id}`;
                tagOption.innerHTML = `
                    <span class="filter-option-label">
                        <span class="tag-color-dot" style="background-color: ${tag.color || '#8B5CF6'}; width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 8px;"></span>
                        ${tag.name}
                    </span>
                `;
                dropdownOptions.appendChild(tagOption);
            });
        }
    } catch (error) {
        console.error('❌ 加载用户标签失败:', error);
    }
}

// 初始化筛选按钮
async function initFilterButtons() {
    if (!filterButtons) return;
    
    try {
        console.log('🏷️ 开始初始化筛选按钮...');
        
        // 获取用户标签
        const response = await getCachedUserTags();
        const userTags = response.success ? response.data : [];
        
        console.log('🏷️ 获取到用户标签:', userTags);
        
        // 清空现有按钮
        filterButtons.innerHTML = '';
        
        // 创建两个主要筛选按钮
        const mainFilterButtons = [
            {
                key: 'latest',
                label: 'Latest',
                type: 'dropdown',
                options: [
                    { key: 'latest', label: 'Latest' },
                    { key: 'oldest', label: 'Oldest' },
                    { key: 'alphabetical', label: 'Alphabetical' }
                ]
            },
            {
                key: 'tags',
                label: 'Filter by Tag',
                type: 'dropdown',
                options: []
            }
        ];
        
        // Hide filter loading skeleton
        const filterLoading = document.getElementById('filterLoading');
        if (filterLoading) {
            filterLoading.style.display = 'none';
        }
        
        // Mark filters as loaded
        filterButtons.classList.add('filters-loaded');
        
        // 创建筛选按钮
        mainFilterButtons.forEach(filterConfig => {
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'filter-button-container';
            
            const button = document.createElement('button');
            button.className = 'FilterButton main-filter-btn';
            button.dataset.filter = filterConfig.key;
            button.innerHTML = `
                <span class="filter-label">${filterConfig.label}</span>
                <svg class="filter-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
            
            // 根据按钮类型创建不同的内容
            if (filterConfig.type === 'dropdown') {
                // 所有按钮都创建下拉菜单
                const dropdownOptions = document.createElement('div');
                dropdownOptions.className = 'filter-dropdown-options';
                
                // 如果是标签按钮，动态加载用户标签
                if (filterConfig.key === 'tags') {
                    dropdownOptions.innerHTML = '<div class="filter-option" data-filter="all"><span class="filter-option-label">All Tags</span></div>';
                    // 动态加载用户标签
                    loadUserTagsForFilter(dropdownOptions);
                } else {
                    dropdownOptions.innerHTML = filterConfig.options.map(option => `
                        <div class="filter-option" data-filter="${option.key}">
                            <span class="filter-option-label">${option.label}</span>
                        </div>
                    `).join('');
                }
                
                // 绑定点击事件
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    buttonContainer.classList.toggle('open');
                    
                    // 更新箭头方向
                    const arrow = button.querySelector('.filter-arrow');
                    if (arrow) {
                        arrow.style.transform = buttonContainer.classList.contains('open') ? 'rotate(180deg)' : 'rotate(0deg)';
                    }
                });
                
                // 绑定选项点击事件
                dropdownOptions.addEventListener('click', (e) => {
                    const option = e.target.closest('.filter-option');
                    if (option) {
                        const filterKey = option.dataset.filter;
                        const filterType = filterConfig.key; // latest, tags
                        const optionLabel = option.querySelector('.filter-option-label').textContent;
                        setFilter(filterType, filterKey, optionLabel);
                        
                        // 关闭所有下拉框
                        document.querySelectorAll('.filter-button-container').forEach(container => {
                            container.classList.remove('open');
                            const arrow = container.querySelector('.filter-arrow');
                            if (arrow) arrow.style.transform = 'rotate(0deg)';
                        });
                    }
                });
                
                // 阻止下拉选项点击事件冒泡
                dropdownOptions.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
                
                buttonContainer.appendChild(button);
                buttonContainer.appendChild(dropdownOptions);
            } else {
                // 其他按钮：创建下拉菜单
                const dropdownOptions = document.createElement('div');
                dropdownOptions.className = 'filter-dropdown-options';
                dropdownOptions.innerHTML = filterConfig.options.map(option => `
                    <div class="filter-option" data-filter="${option.key}">
                        <span class="filter-option-label">${option.label}</span>
                    </div>
                `).join('');
                
                // 绑定点击事件
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    buttonContainer.classList.toggle('open');
                    
                    // 更新箭头方向
                    const arrow = button.querySelector('.filter-arrow');
                    if (arrow) {
                        arrow.style.transform = buttonContainer.classList.contains('open') ? 'rotate(180deg)' : 'rotate(0deg)';
                    }
                });
                
                // 绑定选项点击事件
                dropdownOptions.addEventListener('click', (e) => {
                    const option = e.target.closest('.filter-option');
                    if (option) {
                        const filterKey = option.dataset.filter;
                        const filterType = filterConfig.key; // latest, tags
                        const optionLabel = option.querySelector('.filter-option-label').textContent;
                        setFilter(filterType, filterKey, optionLabel);
                        
                        // 关闭所有下拉框
                        document.querySelectorAll('.filter-button-container').forEach(container => {
                            container.classList.remove('open');
                            const arrow = container.querySelector('.filter-arrow');
                            if (arrow) arrow.style.transform = 'rotate(0deg)';
                        });
                    }
                });
                
                // 阻止下拉选项点击事件冒泡
                dropdownOptions.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
                
                buttonContainer.appendChild(button);
                buttonContainer.appendChild(dropdownOptions);
            }
            filterButtons.appendChild(buttonContainer);
        });
        
        // Edit Tags按钮已移到标签选择器旁边，不再需要在这里添加
        
    } catch (error) {
        console.error('❌ 初始化筛选按钮失败:', error);
        
        // 显示基础筛选选项
        const filterOptions = [
            { key: 'all', label: 'All' },
            { key: 'latest', label: 'Latest' },
            { key: 'oldest', label: 'Oldest' }
        ];
        
        filterButtons.innerHTML = '';
        filterOptions.forEach(option => {
            const button = document.createElement('button');
            button.className = `FilterButton ${option.key === currentFilter ? 'active' : ''}`;
            button.textContent = option.label;
            button.dataset.filter = option.key;
            button.onclick = () => setFilter(option.key);
            filterButtons.appendChild(button);
        });
    }
}

// 设置筛选条件
function setFilter(filterType, filterValue, optionLabel = null) {
    // 更新对应的筛选条件
    currentFilters[filterType] = filterValue;
    
    // 更新按钮显示文本
    updateFilterButtonDisplay(filterType, filterValue, optionLabel);
    
    // 更新按钮状态
    updateFilterButtonStates();
    
    // 显示筛选状态
    showFilterStatus();
    
    // 重新渲染
    resetInsightsPaginationAndRerender();
}

// 更新筛选按钮显示文本
function updateFilterButtonDisplay(filterType, filterValue, optionLabel) {
    const buttonContainer = filterButtons.querySelector(`[data-filter="${filterType}"]`).closest('.filter-button-container');
    const button = buttonContainer.querySelector('.filter-label');
    
    if (filterType === 'tags' && filterValue && filterValue.startsWith('tag_')) {
        // 标签筛选：显示选中的标签名称
        if (optionLabel) {
            button.textContent = optionLabel;
        }
    } else if (filterType === 'latest') {
        // 排序方式：显示排序方式
        if (filterValue === 'latest') {
            button.textContent = 'Latest';
        } else if (filterValue === 'oldest') {
            button.textContent = 'Oldest';
        } else if (filterValue === 'alphabetical') {
            button.textContent = 'Alphabetical';
        }
    }
}

// 更新筛选按钮状态
function updateFilterButtonStates() {
    const buttons = filterButtons.querySelectorAll('.FilterButton');
    buttons.forEach(btn => {
        // Remove active class from all buttons - no purple highlighting
        btn.classList.remove('active');
    });
}

// 显示筛选状态
function showFilterStatus() {
    const statusParts = [];
    
    // 排序状态
    if (currentFilters.latest === 'latest') {
        statusParts.push('最新优先');
    } else if (currentFilters.latest === 'oldest') {
        statusParts.push('最旧优先');
    } else if (currentFilters.latest === 'alphabetical') {
        statusParts.push('字母排序');
    }
    
    // 标签筛选状态
    if (currentFilters.tags && currentFilters.tags !== 'all') {
        if (currentFilters.tags.startsWith('tag_')) {
            const tagButton = document.querySelector(`[data-filter="tags"]`);
            if (tagButton) {
                const tagOption = tagButton.closest('.filter-button-container').querySelector(`[data-filter="${currentFilters.tags}"]`);
                if (tagOption) {
                    statusParts.push(`标签: ${tagOption.textContent.trim()}`);
                }
            }
        }
    } else if (currentFilters.tags === 'all') {
        statusParts.push('所有标签');
    }
    

    
    const statusText = statusParts.length > 0 ? statusParts.join(' | ') : '显示所有内容';
    console.log('📊 筛选状态:', statusText);
    
    // 可以在这里添加UI显示筛选状态
    // 比如在页面顶部显示一个小提示
}

// 获取当前筛选的文章
function getFilteredInsights() {
    let filteredInsights = [...currentInsights];
    
    // Filter out cards that are already in stacks
    const cardsInStacks = new Set();
    stacks.forEach(stackData => {
        stackData.cards.forEach(card => {
            cardsInStacks.add(card.id);
        });
    });
    
    filteredInsights = filteredInsights.filter(insight => !cardsInStacks.has(insight.id));
    
    // 1. 排序逻辑（始终应用）
    if (currentFilters.latest === 'latest') {
        // 按最新时间排序
        filteredInsights.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (currentFilters.latest === 'oldest') {
        // 按最旧时间排序
        filteredInsights.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (currentFilters.latest === 'alphabetical') {
        // 按标题首字母A-Z排序
        filteredInsights.sort((a, b) => {
            const titleA = (a.title || a.url || '').toLowerCase();
            const titleB = (b.title || b.url || '').toLowerCase();
            return titleA.localeCompare(titleB);
        });
    } else {
        // 默认按最新时间排序
        filteredInsights.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    
    // 2. 标签筛选
    if (currentFilters.tags && currentFilters.tags !== 'all') {
        if (currentFilters.tags.startsWith('tag_')) {
            const tagId = currentFilters.tags.replace('tag_', '');
            
            filteredInsights = filteredInsights.filter(insight => {
                if (insight.tags && insight.tags.length > 0) {
                    const hasTag = insight.tags.some(tag => {
                        let tagIdToCheck = null;
                        
                        if (typeof tag === 'string') {
                            tagIdToCheck = tag;
                        } else if (tag && typeof tag === 'object') {
                            tagIdToCheck = tag.id || tag.tag_id || tag.user_tag_id;
                        }
                        
                        return tagIdToCheck === tagId;
                    });
                    return hasTag;
                }
                return false;
            });
        }
    }
    
    return filteredInsights;
}



// 分享见解
async function shareInsight(insight) {
    try {
        const shareData = {
            title: insight.title || 'Shared content',
            text: insight.description || 'Amazing content from Quest',
            url: insight.url
        };
        if (navigator.share) {
            await navigator.share(shareData);
            alert('Content shared successfully!');
        } else {
            // 复制链接到剪贴板
            navigator.clipboard.writeText(insight.url).then(() => {
                alert('Link copied to clipboard!');
            }).catch(() => {
                // 降级方案
                const textArea = document.createElement('textarea');
                textArea.value = insight.url;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                alert('Link copied to clipboard!');
            });
        }
    } catch (error) {
        console.error('Share failed:', error);
        alert('Share failed, please try again later.');
    }
}

// 删除见解
async function deleteInsight(id) {
    if (!confirm('确定要删除这个内容吗？')) {
        return;
    }
    
    try {
        await api.deleteInsight(id);
        
        // Clear cache for insights endpoint to ensure fresh data
        if (window.apiCache) {
            window.apiCache.clearPattern('/api/v1/insights');
            console.log('🗑️ Cleared insights cache after deletion');
        }
        
        await loadUserInsights();
        
        // Also save to localStorage backup
        saveInsightsToLocalStorage();
        
        alert('Content deleted successfully!');
    } catch (error) {
        console.error('删除内容失败:', error);
        alert(error.message || '删除内容失败，请重试');
    }
}

// 滚动状态管理工具
const scrollManager = {
    disable() {
        // 保存当前滚动位置
        this.scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        
        // 禁用滚动
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.top = `-${this.scrollPosition}px`;
        document.body.style.width = '100%';
        
        console.log('📱 滚动已禁用，保存位置:', this.scrollPosition);
    },
    
    enable() {
        // 恢复滚动
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        
        // 恢复滚动位置
        if (this.scrollPosition !== undefined) {
            window.scrollTo(0, this.scrollPosition);
        }
        
        console.log('📱 滚动已恢复，恢复位置:', this.scrollPosition);
        this.scrollPosition = undefined;
    }
};

// 显示添加内容模态框
function showAddContentModal() {
    if (addContentModal) {
        // 确保弹窗可见
        addContentModal.style.display = 'flex';
        addContentModal.style.alignItems = 'center';
        addContentModal.style.justifyContent = 'center';
        
        // 添加show类
        addContentModal.classList.add('show');
        
        // 使用滚动管理器禁用滚动
        scrollManager.disable();
        
        // 加载用户标签
        loadUserTags();
        
        // 重置表单
        if (addContentForm) {
            addContentForm.reset();
        }
    } else {
        console.error('❌ 弹窗元素未找到');
    }
}

// 隐藏添加内容模态框
function hideAddContentModal() {
    if (addContentModal) {
        addContentModal.classList.remove('show');
        addContentModal.style.display = 'none';
        
        // 使用滚动管理器恢复滚动
        scrollManager.enable();
    }
}

// 绑定事件
function bindEvents() {
    // Header logout button
    if (headerLogout) {
        headerLogout.addEventListener('click', () => {
            console.log('🚪 用户点击登出...');
            
            // 直接清除本地状态
            auth.clearSession();
            
            // 立即跳转到首页
            window.location.href = PATHS.HOME;
        });
    }
    
    // Header edit profile button
    if (headerEditProfile) {
        headerEditProfile.addEventListener('click', () => {
            console.log('✏️ 用户点击编辑资料...');
            
            // 触发编辑资料模态框
            const profileContainer = document.getElementById('profileContainer');
            if (profileContainer) {
                profileContainer.click();
            }
        });
    }
    
    // 添加内容表单
    if (addContentForm) {
        addContentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const url = document.getElementById('contentUrl').value.trim();
            const tagSelector = document.getElementById('tagSelector');
            
            if (!url) {
                alert('Please enter a content URL');
                return;
            }
            
            // 验证 URL 格式
            try {
                new URL(url);
            } catch {
                alert('Please enter a valid URL');
                return;
            }
            
            try {
                // 检查用户认证状态
                if (!auth.checkAuth()) {
                    showErrorMessage('Please log in to add content.');
                    return;
                }
                
                // 验证token是否有效
                const tokenValid = await auth.validateToken();
                if (!tokenValid) {
                    showErrorMessage('Your session has expired. Please log in again.');
                    return;
                }
                
                // 显示加载状态
                const submitBtn = document.getElementById('addContentBtn');
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<svg class="loading-spinner" width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.416" stroke-dashoffset="31.416"><animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/><animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/></circle></svg> Adding...';
                submitBtn.disabled = true;
                
                // 获取选中的标签
                const selectedTags = getSelectedTags();
                
                // 构建insight数据
                const insightData = {
                    url: url
                };
                
                // 获取自定义字段
                const customTitle = document.getElementById('customTitle')?.value?.trim();
                const customThought = document.getElementById('customThought')?.value?.trim();
                
                // 只有当有选中的标签时才添加tag_ids（使用标签ID而不是名称）
                if (selectedTags.length > 0) {
                    const tagIds = selectedTags.map(tag => tag.id);
                    if (tagIds.length > 0) {
                        insightData.tag_ids = tagIds;
                    }
                }
                
                // 添加自定义字段（如果用户输入了的话）
                if (customTitle) insightData.title = customTitle;
                if (customThought) insightData.thought = customThought;
                
                // 使用正确的API端点创建insight
                const result = await api.createInsight(insightData);
                
                // 清空表单并隐藏模态框
                addContentForm.reset();
                // 手动清空自定义字段
                document.getElementById('customTitle').value = '';
                document.getElementById('customThought').value = '';
                hideAddContentModal();
                
                // 显示成功消息
                showSuccessMessage('Content added successfully!');
                
                // 等待一下再重新加载内容，确保后端处理完成
                setTimeout(async () => {
                    try {
                        // Clear cache for insights endpoint to ensure fresh data
                        if (window.apiCache) {
                            window.apiCache.clearPattern('/api/v1/insights');
                        }
                        
                        await loadUserInsights();
                        
                        // Also save to localStorage backup
                        saveInsightsToLocalStorage();
                    } catch (error) {
                        console.error('❌ 重新加载内容失败:', error);
                        // 不要显示错误，因为内容已经添加成功了
                    }
                }, 1000);
                
            } catch (error) {
                console.error('❌ 添加内容失败:', error);
                let errorMessage = 'Failed to add content. Please try again.';
                
                if (error.message) {
                    if (error.message.includes('401') || error.message.includes('unauthorized')) {
                        errorMessage = 'Please log in again to add content.';
                    } else if (error.message.includes('400') || error.message.includes('bad request')) {
                        errorMessage = 'Invalid URL or content format.';
                    } else if (error.message.includes('422')) {
                        errorMessage = 'Data validation failed. Please check your input and try again.';
                        console.error('🔍 422错误详情 - 错误信息:', error.message);
                        console.error('🔍 422错误详情 - URL:', url);
                        console.error('🔍 422错误详情 - 标签数量:', selectedTags ? selectedTags.length : 0);
                        console.error('🔍 422错误详情 - 标签ID数组:', insightData.tag_ids);
                    } else if (error.message.includes('500') || error.message.includes('server error')) {
                        errorMessage = 'Server error. Please try again later.';
                    } else {
                        errorMessage = error.message;
                    }
                }
                
                showErrorMessage(errorMessage);
            } finally {
                // 恢复按钮状态
                const submitBtn = document.getElementById('addContentBtn');
                if (submitBtn) {
                    submitBtn.innerHTML = submitBtn.innerHTML.includes('Adding...') ? 'Add Content' : submitBtn.innerHTML;
                    submitBtn.disabled = false;
                }
            }
        });
    }
    
    // 关闭模态框
    if (closeAddModal) {
        closeAddModal.addEventListener('click', hideAddContentModal);
    }
    
    if (cancelAddBtn) {
        cancelAddBtn.addEventListener('click', hideAddContentModal);
    }
    

    
    // 点击模态框外部关闭
    if (addContentModal) {
        addContentModal.addEventListener('click', (e) => {
            if (e.target === addContentModal) {
                hideAddContentModal();
            }
        });
    }

    // 左上角添加内容按钮
    const addContentBtnLeft = document.getElementById('addContentBtnLeft');
    if (addContentBtnLeft) {
        addContentBtnLeft.addEventListener('click', showAddContentModal);
    }
    
    // 绑定标签相关事件
    bindTagEvents();
    
            // 绑定标签选择器下拉事件
        bindTagSelectorEvents();
        
        // 绑定筛选按钮点击外部关闭事件
        bindFilterButtonOutsideClick();
        
        // 绑定用户资料编辑事件
        bindProfileEditEvents();
        
        // 绑定内容详情模态框事件
        bindContentDetailModalEvents();
}

// Event delegation for card interactions (performance optimization)
function setupCardEventDelegation() {
    if (!contentCards) return;
    
    // Single event listener for all card interactions
    contentCards.addEventListener('click', (e) => {
        // Handle delete button clicks
        if (e.target.matches('.content-card-delete-btn') || e.target.closest('.content-card-delete-btn')) {
            e.stopPropagation();
            const deleteBtn = e.target.matches('.content-card-delete-btn') ? e.target : e.target.closest('.content-card-delete-btn');
            const insightId = deleteBtn.dataset.insightId;
            if (insightId) {
                deleteInsight(insightId);
            }
            return;
        }
        
        // Handle card clicks for details
        const card = e.target.closest('.content-card');
        if (card && !e.target.matches('.content-card-delete-btn') && !e.target.closest('.content-card-delete-btn')) {
            const insightId = card.dataset.insightId;
            if (insightId) {
                // Find the insight data and open the modal
                const insight = window.currentInsights?.find(i => i.id === insightId);
                if (insight) {
                    openContentDetailModal(insight);
                } else {
                    console.error('❌ Insight not found for ID:', insightId);
                }
            }
        }
    });
    
    console.log('✅ Card event delegation set up');
}

// Cached version of getUserTags to reduce API calls
async function getCachedUserTags() {
    const now = Date.now();
    
    // Return cached data if it's still fresh
    if (cachedUserTags && (now - userTagsCacheTime) < USER_TAGS_CACHE_DURATION) {
        console.log('📦 Using cached user tags');
        return { success: true, data: cachedUserTags };
    }
    
    // Fetch fresh data
    console.log('🔄 Fetching fresh user tags from API');
    const response = await api.getUserTags();
    
    if (response.success && response.data) {
        cachedUserTags = response.data;
        userTagsCacheTime = now;
        console.log('💾 Cached user tags:', cachedUserTags.length);
    }
    
    return response;
}

// Clear user tags cache (call this when tags are updated)
function clearUserTagsCache() {
    cachedUserTags = null;
    userTagsCacheTime = 0;
    console.log('🗑️ Cleared user tags cache');
}

// Utility to normalize various response shapes
function normalizePaginatedInsightsResponse(response) {
    const d = response?.data || {};
    let items = [];
    if (Array.isArray(d)) items = d;
    else if (Array.isArray(d.insights)) items = d.insights;
    else if (Array.isArray(d.data)) items = d.data;
    else if (Array.isArray(d.items)) items = d.items; // <— add this line

    // basic pagination hints (support multiple back-end styles safely)
    const page = d.page ?? d.current_page ?? insightsPage;
    const perPage = d.limit ?? d.per_page ?? PAGE_SIZE;
    const total = d.total ?? d.total_items ?? d.count;
    const totalPages = d.total_pages ?? (total && perPage ? Math.ceil(total / perPage) : undefined);
    const hasMore = (d.has_next !== undefined) ? d.has_next
                   : (d.next_page !== undefined) ? Boolean(d.next_page)
                   : (totalPages !== undefined) ? page < totalPages
                   : (items.length === perPage); // fallback heuristic

    return { items, hasMore };
}

// 加载用户标签
async function loadUserTags() {
    try {
        console.log('🏷️ 开始加载用户标签...');
        
        // 使用缓存的API方法获取标签
        const response = await getCachedUserTags();
        
        if (response.success && response.data) {
            const tags = response.data;
            console.log('✅ 用户标签加载成功:', tags.length, '个');
            
            // 更新标签选择器
            renderTagSelector(tags);
            
            // 更新过滤器按钮
            updateFilterButtons(tags);
        } else {
            console.warn('⚠️ API返回格式不正确:', response);
            renderTagSelector([]);
        }
    } catch (error) {
        console.error('❌ 加载用户标签失败:', error);
        
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
            showErrorMessage('Failed to load tags. Please refresh and try again.');
        }
        
        renderTagSelector([]);
    }
}

// 渲染标签选择器
function renderTagSelector(tags) {
    const tagSelectorOptions = document.getElementById('tagSelectorOptions');
    if (!tagSelectorOptions) {
        console.error('❌ 标签选择器选项容器未找到');
        return;
    }
    
    tagSelectorOptions.innerHTML = '';
    
    if (tags.length === 0) {
        tagSelectorOptions.innerHTML = '<div class="no-tags">No tags available. Create some tags first!</div>';
        return;
    }
    
    // 创建标签选项
    tags.forEach((tag, index) => {
        const tagOption = document.createElement('div');
        tagOption.className = 'tag-option';
        tagOption.dataset.tagId = tag.id;
        tagOption.dataset.tagName = tag.name;
        tagOption.dataset.tagColor = tag.color || '#FF5733';
        
        tagOption.innerHTML = `
            <div class="tag-option-content">
                <span class="tag-name">${tag.name}</span>
                <input type="radio" name="selectedTag" id="tag_${tag.id}" value="${tag.id}" class="tag-radio">
            </div>
        `;
        
        // 绑定点击事件
        tagOption.addEventListener('click', (e) => {
            // 防止点击radio时触发两次
            if (e.target.type === 'radio') {
                return;
            }
            
            // 清除之前选中的标签
            const previouslySelected = tagSelectorOptions.querySelector('.tag-option.selected');
            if (previouslySelected) {
                previouslySelected.classList.remove('selected');
                const prevRadio = previouslySelected.querySelector('.tag-radio');
                if (prevRadio) prevRadio.checked = false;
            }
            
            // 选中当前标签
            const radio = tagOption.querySelector('.tag-radio');
            radio.checked = true;
            tagOption.classList.add('selected');
            
            updateSelectedTagsDisplay();
        });
        
        tagSelectorOptions.appendChild(tagOption);
    });
}

// 更新已选标签显示
function updateSelectedTagsDisplay() {
    const selectedTagsDisplay = document.getElementById('selectedTagsDisplay');
    const selectedTags = getSelectedTags();
    
    if (!selectedTagsDisplay) return;
    
    selectedTagsDisplay.innerHTML = '';
    
    if (selectedTags.length === 0) {
        selectedTagsDisplay.innerHTML = '<span class="no-selected-tags">No tag selected</span>';
        return;
    }
    
    // Since we only allow one tag, we'll only have one tag in the array
    const tag = selectedTags[0];
    const tagElement = document.createElement('span');
    tagElement.className = 'selected-tag';
    tagElement.innerHTML = `
        ${tag.name}
        <button class="remove-tag-btn" onclick="removeSelectedTag('${tag.id}')">&times;</button>
    `;
    selectedTagsDisplay.appendChild(tagElement);
}

// 移除已选标签
function removeSelectedTag(tagId) {
    const radio = document.getElementById(`tag_${tagId}`);
    if (radio) {
        radio.checked = false;
        const tagOption = radio.closest('.tag-option');
        if (tagOption) {
            tagOption.classList.remove('selected');
        }
    }
    updateSelectedTagsDisplay();
}

// 将移除标签函数暴露到全局
window.removeSelectedTag = removeSelectedTag;

// 绑定筛选按钮点击外部关闭事件
function bindFilterButtonOutsideClick() {
    document.addEventListener('click', (e) => {
        // 如果点击的不是筛选按钮容器，关闭所有下拉框
        if (!e.target.closest('.filter-button-container')) {
            document.querySelectorAll('.filter-button-container').forEach(container => {
                container.classList.remove('open');
                const arrow = container.querySelector('.filter-arrow');
                if (arrow) arrow.style.transform = 'rotate(0deg)';
            });
        }
    });
}

// 绑定标签选择器事件
function bindTagSelectorEvents() {
    const tagSelectorTrigger = document.getElementById('tagSelectorTrigger');
    const tagSelectorDropdown = document.getElementById('tagSelectorDropdown');
    
    if (!tagSelectorTrigger || !tagSelectorDropdown) {
        console.error('❌ 标签选择器元素未找到');
        return;
    }
    
    // 点击触发器显示/隐藏下拉选项
    tagSelectorTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        tagSelectorDropdown.classList.toggle('open');
        
        const isOpen = tagSelectorDropdown.classList.contains('open');
        
        // 更新箭头方向
        const arrow = tagSelectorTrigger.querySelector('.tag-selector-arrow');
        if (arrow) {
            arrow.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    });
    
    // 点击外部关闭下拉选项
    document.addEventListener('click', (e) => {
        if (!tagSelectorDropdown.contains(e.target)) {
            tagSelectorDropdown.classList.remove('open');
            const arrow = tagSelectorTrigger.querySelector('.tag-selector-arrow');
            if (arrow) {
                arrow.style.transform = 'rotate(0deg)';
            }
        }
    });
    
    // 阻止下拉选项内部点击事件冒泡
    const tagSelectorOptions = document.getElementById('tagSelectorOptions');
    if (tagSelectorOptions) {
        tagSelectorOptions.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
}

// 更新过滤器按钮
function updateFilterButtons(tags) {
    // 重新初始化筛选按钮，包括标签下拉选择器
    initFilterButtons();
}

// 获取选中的标签
function getSelectedTags() {
    const selectedTags = [];
    const radio = document.querySelector('#tagSelectorOptions .tag-radio:checked');
    
    if (radio) {
        const tagId = radio.value;
        const tagOption = radio.closest('.tag-option');
        
        if (tagOption) {
            const tagName = tagOption.dataset.tagName || 'Unknown Tag';
            const tagColor = tagOption.dataset.tagColor || '#667eea';
            
            selectedTags.push({ 
                id: tagId, 
                name: tagName, 
                color: tagColor 
            });
        }
    }
    
    return selectedTags;
}

// 显示创建标签模态框
function showCreateTagModal() {
    const modal = document.getElementById('createTagModal');
    
    if (modal) {
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        
        // 确保弹窗居中
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.zIndex = '1000';
        
        // 聚焦到输入框
        const tagNameInput = document.getElementById('newTagName');
        if (tagNameInput) {
            tagNameInput.focus();
        } else {
            console.error('❌ 找不到标签名称输入框');
        }
    } else {
        console.error('❌ 找不到创建标签模态框');
    }
}

// 隐藏创建标签模态框
function hideCreateTagModal() {
    const modal = document.getElementById('createTagModal');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('createTagForm').reset();
    }
}

// 显示管理标签模态框
function showManageTagsModal() {
    const modal = document.getElementById('manageTagsModal');
    if (modal) {
        modal.style.display = 'flex';
        // loadTagsForManagement() 已删除
    }
}

// 隐藏管理标签模态框
function hideManageTagsModal() {
    const modal = document.getElementById('manageTagsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 标签管理函数已删除，使用简单的标签下拉选择器

// Edit tag in management interface
async function editTagInManagement(userTagId, currentName, currentColor) {
    const newName = prompt('Enter new tag name:', currentName);
    if (!newName || newName.trim() === currentName) return;
    
    try {
        const defaultColor = currentColor || '#8B5CF6'; // 使用当前颜色或默认颜色
        
        const response = await api.updateUserTag(userTagId, { 
            name: newName.trim(),
            color: defaultColor
        });
        
        if (response.success && response.data) {
            console.log('✅ Tag updated successfully:', response.data);
            
            // Reload tags
            await loadUserTags();
            
            // Reinitialize filter buttons
            await initFilterButtons();
            
            showSuccessMessage('Tag updated successfully!');
        } else {
            throw new Error(response.message || 'Failed to update tag');
        }
    } catch (error) {
        console.error('❌ Failed to update tag:', error);
        showErrorMessage(`Failed to update tag: ${error.message}`);
    }
}

// Delete tag in management interface
async function deleteTagInManagement(userTagId) {
    if (!confirm('Are you sure you want to delete this tag? This action cannot be undone.')) {
        return;
    }
    
    try {
        console.log('🗑️ Deleting tag:', userTagId);
        
        const response = await api.deleteUserTag(userTagId);
        
        if (response.success) {
            console.log('✅ Tag deleted successfully');
            
            // Reload tags
            await loadUserTags();
            
            // Reinitialize filter buttons
            await initFilterButtons();
            
            showSuccessMessage('Tag deleted successfully!');
        } else {
            throw new Error(response.message || 'Failed to delete tag');
        }
    } catch (error) {
        console.error('❌ Failed to delete tag:', error);
        showErrorMessage(`Failed to delete tag: ${error.message}`);
    }
}

// Bind tag-related events
function bindTagEvents() {
    // Create tag button
    const createTagBtn = document.getElementById('createTagBtn');
    if (createTagBtn) {
        createTagBtn.addEventListener('click', showCreateTagModal);
    }
    
    // Manage tags button
    // 标签管理按钮已删除，使用简单的标签下拉选择器
    
    // Create tag form
    const createTagForm = document.getElementById('createTagForm');
    if (createTagForm) {
        createTagForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await createNewTag();
        });
    }
    
    // Close create tag modal
    const closeCreateTagModal = document.getElementById('closeCreateTagModal');
    if (closeCreateTagModal) {
        closeCreateTagModal.addEventListener('click', hideCreateTagModal);
    }
    
    const cancelCreateTagBtn = document.getElementById('cancelCreateTagBtn');
    if (cancelCreateTagBtn) {
        cancelCreateTagBtn.addEventListener('click', hideCreateTagModal);
    }
    
    // Close manage tags modal
    const closeManageTagsModal = document.getElementById('closeManageTagsModal');
    if (closeManageTagsModal) {
        closeManageTagsModal.addEventListener('click', hideManageTagsModal);
    }
    
    const closeManageTagsBtn = document.getElementById('closeManageTagsBtn');
    if (closeManageTagsBtn) {
        closeManageTagsBtn.addEventListener('click', hideManageTagsModal);
    }
    
    // Color preset selection
    const colorPresets = document.querySelectorAll('.color-preset');
    colorPresets.forEach(preset => {
        preset.addEventListener('click', () => {
            const color = preset.getAttribute('data-color');
            document.getElementById('newTagColor').value = color;
        });
    });
    
    // Click outside modal to close
    const createTagModal = document.getElementById('createTagModal');
    if (createTagModal) {
        createTagModal.addEventListener('click', (e) => {
            if (e.target === createTagModal) {
                hideCreateTagModal();
            }
        });
    }
    
    const manageTagsModal = document.getElementById('manageTagsModal');
    if (manageTagsModal) {
        manageTagsModal.addEventListener('click', (e) => {
            if (e.target === manageTagsModal) {
                hideManageTagsModal();
            }
        });
    }
}

// 从标签管理弹窗创建新标签函数已删除

// 创建新标签
async function createNewTag() {
    const tagNameInput = document.getElementById('newTagName');
    
    if (!tagNameInput) {
        console.error('❌ 找不到标签名称输入框');
        showErrorMessage('Tag name input not found');
        return;
    }
    
    const tagName = tagNameInput.value.trim();
    
    if (!tagName) {
        showErrorMessage('Please enter a tag name');
        return;
    }
    
    const defaultColor = '#8B5CF6'; // 默认紫色
    
    try {
        // 使用API方法创建标签
        const response = await api.createUserTag({
            name: tagName,
            color: defaultColor
        });
        
        if (response.success && response.data) {
            // 清空表单
            tagNameInput.value = '';
            
            // 重新加载用户标签（用于筛选按钮）
            await loadUserTags();
            
            // 重新初始化筛选按钮
            await initFilterButtons();
            
            showSuccessMessage('Tag created successfully!');
        } else {
            throw new Error(response.message || 'Failed to create tag');
        }
    } catch (error) {
        console.error('❌ Failed to create tag:', error);
        showErrorMessage(`Failed to create tag: ${error.message}`);
    }
}



// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initPage);

// 标签管理弹窗已删除，使用简单的标签下拉选择器

// 显示编辑标签模态框
function showEditTagsModal() {
    const modal = document.createElement('div');
    modal.className = 'edit-tags-modal';
    modal.innerHTML = `
        <div class="edit-tags-modal-content">
            <div class="modal-header">
                <h2 class="modal-title">Edit Tags</h2>
                <button class="modal-close" onclick="this.closest('.edit-tags-modal').remove()">&times;</button>
            </div>
            <div class="tags-list" id="tagsList">
                <!-- Tags list will be dynamically generated by JavaScript -->
            </div>
            <div class="modal-actions">
                <button class="modal-btn modal-btn-secondary" onclick="this.closest('.edit-tags-modal').remove()">Close</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 加载并显示标签
    loadTagsForEditing();
}

// 加载标签用于编辑
async function loadTagsForEditing() {
    try {
        const response = await getCachedUserTags();
        const tags = response.success ? response.data : [];
        
        const tagsList = document.getElementById('tagsList');
        if (!tagsList) return;
        
        tagsList.innerHTML = '';
        
        if (tags.length === 0) {
            tagsList.innerHTML = '<p class="no-tags">No tags created yet</p>';
            return;
        }
        
        tags.forEach(tag => {
            const tagItem = document.createElement('div');
            tagItem.className = 'tag-item';
            tagItem.innerHTML = `
                <span class="tag-name">${tag.name || tag}</span>
                <div class="tag-actions">
                    <button class="action-btn edit-tag-btn" onclick="editUserTag('${tag.id || tag.name}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <button class="action-btn delete-tag-btn" onclick="deleteUserTag('${tag.id || tag.name}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
            `;
            tagsList.appendChild(tagItem);
        });
        
    } catch (error) {
        console.error('Failed to load tags:', error);
        const tagsList = document.getElementById('tagsList');
        if (tagsList) {
            tagsList.innerHTML = '<p class="error">Failed to load tags</p>';
        }
    }
}

// 编辑标签
async function editUserTag(userTagId) {
    const newName = prompt('Please enter new tag name:');
    if (newName && newName.trim()) {
        updateUserTag(userTagId, newName.trim());
    }
}



// 更新标签
async function updateUserTag(userTagId, newName) {
    try {
        const response = await api.updateUserTag(userTagId, { name: newName });
        
        if (response.success) {
            // 重新加载标签
            await loadTagsForEditing();
            // 重新初始化筛选按钮
            await initFilterButtons();
            alert('Tag updated successfully!');
        } else {
            alert('Tag update failed: ' + (response.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Failed to update tag:', error);
        alert('Failed to update tag: ' + error.message);
    }
}

// 删除标签
async function deleteUserTag(userTagId) {
    if (!confirm('Are you sure you want to delete this tag?')) {
        return;
    }
    
    try {
        console.log('🗑️ 删除标签:', userTagId);
        
        // 使用新的API方法删除标签
        const response = await api.deleteUserTag(userTagId);
        
        if (response.success) {
            console.log('✅ 标签删除成功');
            
            // 重新加载标签
            await loadUserTags();
            
            showSuccessMessage('Tag deleted successfully!');
        } else {
            throw new Error(response.message || 'Failed to delete tag');
        }
    } catch (error) {
        console.error('❌ 删除标签失败:', error);
        showErrorMessage(`Failed to delete tag: ${error.message}`);
    }
}

// 显示成功消息
function showSuccessMessage(message) {
    showMessage(message, 'success');
}

// 显示错误消息
function showErrorMessage(message) {
    showMessage(message, 'error');
}

// 显示消息提示
function showMessage(message, type = 'info') {
    // 移除现有消息
    const existingMessage = document.querySelector('.message-toast');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    const messageToast = document.createElement('div');
    messageToast.className = `message-toast message-toast-${type}`;
    messageToast.innerHTML = `
        <div class="message-content">
            <svg class="message-icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
                ${type === 'success' ? 
                    '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="22,4 12,14.01 9,11.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' :
                    type === 'error' ?
                    '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2"/><line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2"/>' :
                    '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
                }
            </svg>
            <span class="message-text">${message}</span>
        </div>
    `;
    
    document.body.appendChild(messageToast);
    
    // 显示动画
    setTimeout(() => {
        messageToast.classList.add('show');
    }, 100);
    
    // 自动隐藏
    setTimeout(() => {
        messageToast.classList.remove('show');
        setTimeout(() => {
            if (messageToast.parentNode) {
                messageToast.remove();
            }
        }, 300);
    }, 3000);
}

// 暴露全局函数
window.deleteInsight = deleteInsight;
window.shareInsight = shareInsight;
window.showAddContentModal = showAddContentModal;
window.hideAddContentModal = hideAddContentModal;
window.editUserTag = editUserTag;
window.updateUserTag = updateUserTag;
window.deleteUserTag = deleteUserTag;
window.editTagInManagement = editTagInManagement;
window.deleteTagInManagement = deleteTagInManagement;
    // showTagsManagementModal 已删除
    // loadTagsForManagement 已删除
window.createNewTag = createNewTag;
    // createNewTagFromManagement 已删除
window.selectAllTags = selectAllTags;
window.deselectAllTags = deselectAllTags;
window.bulkEditTags = bulkEditTags;
window.bulkDeleteTags = bulkDeleteTags;
    // applySelectedTagFilter 已删除












// ===== PROFILE EDIT FUNCTIONALITY =====

// Profile Edit DOM Elements (will be retrieved fresh in bindProfileEditEvents)

// 绑定用户资料编辑事件
function bindProfileEditEvents() {
    console.log('🔧 绑定用户资料编辑事件...');
    
    // 重新获取DOM元素（确保元素存在）
    const profileContainer = document.getElementById('profileContainer');
    const profileEditModal = document.getElementById('profileEditModal');
    const profileEditForm = document.getElementById('profileEditForm');
    const closeProfileModal = document.getElementById('closeProfileModal');
    const cancelProfileEdit = document.getElementById('cancelProfileEdit');
    const profileAvatarUpload = document.getElementById('profileAvatarUpload');
    const avatarEditBtn = document.getElementById('avatarEditBtn');
    
    console.log('🔍 检查DOM元素:', {
        profileContainer: !!profileContainer,
        profileEditModal: !!profileEditModal,
        closeProfileModal: !!closeProfileModal,
        cancelProfileEdit: !!cancelProfileEdit,
        avatarEditBtn: !!avatarEditBtn
    });
    
    // 点击头像区域打开编辑模态框
    if (profileContainer) {
        // 添加多种事件测试
        profileContainer.addEventListener('mousedown', function(e) {
            console.log('🖱️ 鼠标按下事件触发', e.target);
        });
        
        profileContainer.addEventListener('mouseup', function(e) {
            console.log('🖱️ 鼠标抬起事件触发', e.target);
        });
        
        profileContainer.addEventListener('click', function(e) {
            console.log('🖱️ 用户点击了用户资料区域');
            console.log('  - 事件目标:', e.target);
            console.log('  - 当前目标:', e.currentTarget);
            console.log('  - 事件类型:', e.type);
            e.preventDefault();
            e.stopPropagation();
            openProfileEditModal();
        }, true); // 使用捕获阶段
        
        // 也添加普通的点击事件作为备用
        profileContainer.addEventListener('click', function(e) {
            console.log('🖱️ 备用点击事件触发');
            openProfileEditModal();
        });
        
        console.log('✅ 用户资料容器点击事件已绑定');
        console.log('  - 元素信息:', profileContainer);
        console.log('  - 元素样式:', window.getComputedStyle(profileContainer));
    } else {
        console.error('❌ 找不到profileContainer元素');
    }
    
    // 关闭编辑模态框
    if (closeProfileModal) {
        closeProfileModal.addEventListener('click', function() {
            console.log('🖱️ 用户点击了关闭按钮');
            closeProfileEditModal();
        });
        console.log('✅ 关闭按钮事件已绑定');
    } else {
        console.error('❌ 找不到closeProfileModal元素');
    }
    
    if (cancelProfileEdit) {
        cancelProfileEdit.addEventListener('click', function() {
            console.log('🖱️ 用户点击了取消按钮');
            closeProfileEditModal();
        });
        console.log('✅ 取消按钮事件已绑定');
    } else {
        console.error('❌ 找不到cancelProfileEdit元素');
    }
    
    // 点击模态框外部关闭
    if (profileEditModal) {
        profileEditModal.addEventListener('click', function(e) {
            if (e.target === profileEditModal) {
                console.log('🖱️ 用户点击了模态框外部');
                closeProfileEditModal();
            }
        });
        console.log('✅ 模态框外部点击事件已绑定');
    } else {
        console.error('❌ 找不到profileEditModal元素');
    }
    
    // 表单提交
    if (profileEditForm) {
        profileEditForm.addEventListener('submit', handleProfileUpdate);
        console.log('✅ 表单提交事件已绑定');
    } else {
        console.error('❌ 找不到profileEditForm元素');
    }
    
    // 头像预览
    if (profileAvatarUpload) {
        profileAvatarUpload.addEventListener('change', handleAvatarPreview);
        console.log('✅ 头像预览事件已绑定');
    } else {
        console.error('❌ 找不到profileAvatarUpload元素');
    }
    
    // 头像编辑按钮
    if (avatarEditBtn) {
        avatarEditBtn.addEventListener('click', () => {
            if (profileAvatarUpload) {
                profileAvatarUpload.click();
            }
        });
        console.log('✅ 头像编辑按钮事件已绑定');
    } else {
        console.error('❌ 找不到avatarEditBtn元素');
    }
    
    console.log('✅ 用户资料编辑事件绑定完成');
}

// 打开用户资料编辑模态框
function openProfileEditModal() {
    console.log('📝 打开用户资料编辑模态框...');
    
    const profileEditModal = document.getElementById('profileEditModal');
    const profileAvatarUpload = document.getElementById('profileAvatarUpload');
    const avatarPreviewImg = document.getElementById('avatarPreviewImg');
    
    if (!profileEditModal) {
        console.error('❌ 找不到用户资料编辑模态框');
        return;
    }
    
    // 预填充当前用户信息
    const usernameInput = document.getElementById('profileUsername');
    const emailInput = document.getElementById('profileEmail');
    
    if (usernameInput && currentUser) {
        const usernameValue = currentUser.nickname || currentUser.email || '';
        usernameInput.value = usernameValue;
    }
    
    if (emailInput && currentUser) {
        emailInput.value = currentUser.email || '';
    }
    
    // 设置当前头像
    if (avatarPreviewImg && currentUser) {
        if (currentUser.avatar_url) {
            avatarPreviewImg.src = currentUser.avatar_url;
        } else if (currentUser.avatar) {
            avatarPreviewImg.src = currentUser.avatar;
        } else {
            avatarPreviewImg.src = '/public/3d_avatar_12.png';
        }
        
        // Ensure avatar is visible
        avatarPreviewImg.style.display = 'block';
        avatarPreviewImg.style.visibility = 'visible';
        avatarPreviewImg.style.opacity = '1';
        
        // Add error handling for image loading
        avatarPreviewImg.onerror = function() {
            this.src = '/public/3d_avatar_12.png';
            this.style.display = 'block';
        };
    }
    
    // 重置头像上传
    if (profileAvatarUpload) {
        profileAvatarUpload.value = '';
    }
    
    // 显示模态框
    profileEditModal.classList.add('show');
    profileEditModal.style.display = 'flex';
    
    // 使用滚动管理器禁用滚动
    scrollManager.disable();
}

// 关闭用户资料编辑模态框
function closeProfileEditModal() {
    const profileEditModal = document.getElementById('profileEditModal');
    const profileEditForm = document.getElementById('profileEditForm');
    const avatarPreviewImg = document.getElementById('avatarPreviewImg');
    
    if (!profileEditModal) return;
    
    // 隐藏模态框
    profileEditModal.classList.remove('show');
    
    // 延迟设置display为none，以保证动画效果
    setTimeout(() => {
        profileEditModal.style.display = 'none';
    }, 300);
    
    // 使用滚动管理器恢复滚动
    scrollManager.enable();
    
    // 重置表单
    if (profileEditForm) {
        profileEditForm.reset();
    }
}

// 处理头像预览
function handleAvatarPreview(event) {
    const file = event.target.files[0];
    const avatarPreviewImg = document.getElementById('avatarPreviewImg');
    
    if (!file) {
        if (avatarPreviewImg) {
            // Reset to current user avatar or default
            if (currentUser && currentUser.avatar_url) {
                avatarPreviewImg.src = currentUser.avatar_url;
            } else {
                avatarPreviewImg.src = '/public/3d_avatar_12.png';
            }
            avatarPreviewImg.style.display = 'block';
        }
        return;
    }
    
    // 验证文件类型
    if (!file.type.startsWith('image/')) {
        showErrorMessage('Please select a valid image file');
        event.target.value = '';
        return;
    }
    
    // 验证文件大小 (5MB)
    if (file.size > 5 * 1024 * 1024) {
        showErrorMessage('Image file size must be less than 5MB');
        event.target.value = '';
        return;
    }
    
    // 显示预览
    const reader = new FileReader();
    reader.onload = function(e) {
        if (avatarPreviewImg) {
            avatarPreviewImg.src = e.target.result;
            avatarPreviewImg.style.display = 'block';
        }
    };
    reader.readAsDataURL(file);
    
    console.log('✅ 头像预览已更新');
}

// 处理用户资料更新
async function handleProfileUpdate(event) {
    event.preventDefault();
    
    console.log('💾 开始更新用户资料...');
    
    // 检查认证状态
    if (!auth.checkAuth()) {
        showErrorMessage('Please log in to update your profile');
        return;
    }
    
    const usernameInput = document.getElementById('profileUsername');
    const emailInput = document.getElementById('profileEmail');
    const passwordInput = document.getElementById('profilePassword');
    const confirmPasswordInput = document.getElementById('profileConfirmPassword');
    const saveBtn = document.getElementById('saveProfileEdit');
    const saveBtnText = document.getElementById('saveProfileBtnText');
    
    if (!usernameInput || !emailInput) {
        showErrorMessage('Username or email input not found');
        return;
    }
    
    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput ? passwordInput.value : '';
    const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : '';
    
    // Validate inputs
    if (!username || !email) {
        showErrorMessage('Username and email are required');
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showErrorMessage('Please enter a valid email address');
        return;
    }
    
    // Validate password match if password is provided
    if (password && password !== confirmPassword) {
        showErrorMessage('Passwords do not match');
        return;
    }

    
    // 显示加载状态
    if (saveBtn && saveBtnText) {
        saveBtn.disabled = true;
        saveBtnText.textContent = 'Saving...';
        saveBtn.classList.add('loading');
    }
    
    try {
        let avatarUrl = currentUser.avatar_url;
        
        // 处理头像上传
        const profileAvatarUpload = document.getElementById('profileAvatarUpload');
        const avatarFile = profileAvatarUpload?.files[0];
        if (avatarFile) {
            console.log('📸 上传新头像...');
            
            // 显示上传进度
            const saveBtn = document.getElementById('saveProfileEdit');
            const originalText = saveBtn?.innerHTML;
            if (saveBtn) {
                saveBtn.innerHTML = '📤 Uploading Avatar...';
                saveBtn.disabled = true;
            }
            
            try {
                avatarUrl = await uploadAvatar(avatarFile);
                console.log('✅ 头像上传成功:', avatarUrl);
                
                // 恢复按钮状态
                if (saveBtn) {
                    saveBtn.innerHTML = '💾 Saving Profile...';
                }
            } catch (error) {
                // 恢复按钮状态
                if (saveBtn && originalText) {
                    saveBtn.innerHTML = originalText;
                    saveBtn.disabled = false;
                }
                throw error; // 重新抛出错误
            }
        }
        
        // 更新用户资料
        const profileData = {
            nickname: username,
            email: email
        };
        
        // 只有当密码提供时才包含它
        if (password) {
            profileData.password = password;
        }
        
        // 只有当头像URL有变化时才包含它
        if (avatarUrl && avatarUrl !== currentUser.avatar_url) {
            profileData.avatar_url = avatarUrl;
        }
        
        const response = await api.updateUserProfile(profileData);
        
        if (response.success) {
            // 更新本地用户数据
            currentUser = { ...currentUser, ...profileData };
            
            // 更新本地存储
            if (auth.getCurrentUser()) {
                // Get existing session data to preserve token and timestamp
                const existingSession = localStorage.getItem('quest_user_session');
                if (existingSession) {
                    const sessionData = JSON.parse(existingSession);
                    // Update only the user data, preserve token and timestamp
                    sessionData.user = currentUser;
                    localStorage.setItem('quest_user_session', JSON.stringify(sessionData));
                } else {
                    console.warn('⚠️ 没有找到现有session数据');
                }
            }
            
            // 刷新UI显示
            updateUserProfileUI();
            
            // 关闭模态框
            closeProfileEditModal();
            
            // 显示成功消息
            showSuccessMessage('Profile updated successfully!');
        } else {
            throw new Error(response.message || 'Failed to update profile');
        }
        
    } catch (error) {
        console.error('❌ 用户资料更新失败:', error);
        
        // Try to update profile locally as fallback to prevent logout
        console.warn('⚠️ API update failed, attempting local update to prevent logout...');
        
        try {
            // 更新本地用户数据
            currentUser = { ...currentUser, nickname: username, email: email };
            
            // 更新本地存储
            if (auth.getCurrentUser()) {
                // Get existing session data to preserve token and timestamp
                const existingSession = localStorage.getItem('quest_user_session');
                if (existingSession) {
                    const sessionData = JSON.parse(existingSession);
                    // Update only the user data, preserve token and timestamp
                    sessionData.user = currentUser;
                    localStorage.setItem('quest_user_session', JSON.stringify(sessionData));
                    console.log('💾 已保存到localStorage (保持session结构)');
                } else {
                    console.warn('⚠️ 没有找到现有session数据');
                }
            }
            
            // 刷新UI显示
            updateUserProfileUI();
            
            // 关闭模态框
            closeProfileEditModal();
            
            // 显示警告消息
            showSuccessMessage('Profile updated locally (server may be temporarily unavailable)');
            
            console.log('✅ 用户资料本地更新成功');
            return; // Exit early since we handled it locally
        } catch (localError) {
            console.error('❌ 本地更新也失败:', localError);
        }
        
        let errorMessage = 'Failed to update profile. Please try again.';
        
        if (error.message.includes('401') || error.message.includes('unauthorized') || error.message.includes('认证已过期')) {
            // Only show login message, don't automatically log out
            errorMessage = 'Your session has expired. Please refresh the page and try again.';
            console.warn('⚠️ Authentication error during profile update, but not logging out automatically');
        } else if (error.message.includes('400') || error.message.includes('bad request')) {
            errorMessage = 'Invalid profile data. Please check your input.';
        } else if (error.message.includes('500') || error.message.includes('server error')) {
            errorMessage = 'Server error. Please try again later.';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        showErrorMessage(errorMessage);
        
    } finally {
        // 恢复按钮状态
        if (saveBtn && saveBtnText) {
            saveBtn.disabled = false;
            saveBtnText.textContent = 'Save Changes';
            saveBtn.classList.remove('loading');
        }
    }
}

// 上传头像
async function uploadAvatar(file) {
    console.log('📸 开始上传头像文件...');
    
    // 检查用户是否已登录
    if (!currentUser || !currentUser.id) {
        throw new Error('User not logged in');
    }
    
    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('user_id', currentUser.id);  // 添加必需的 user_id 参数
    
    console.log('📤 上传数据:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        userId: currentUser.id
    });
    
    try {
        const response = await api.request(API_CONFIG.USER.UPLOAD_AVATAR, {
            method: 'POST',
            body: formData
        });
        
        console.log('📡 服务器响应:', response);
        
        if (response.success && response.data && response.data.avatar_url) {
            console.log('✅ 头像上传成功:', response.data.avatar_url);
            return response.data.avatar_url;
        } else {
            throw new Error(response.message || 'Avatar upload failed: Invalid response format');
        }
        
    } catch (error) {
        console.error('❌ 头像上传失败:', error);
        
        // 提供更详细的错误信息
        let errorMessage = 'Failed to upload avatar';
        if (error.message) {
            if (error.message.includes('422')) {
                errorMessage = 'Invalid file format or missing required data';
            } else if (error.message.includes('413')) {
                errorMessage = 'File size too large (max 5MB)';
            } else if (error.message.includes('401') || error.message.includes('403')) {
                errorMessage = 'Authentication required. Please log in again.';
            } else {
                errorMessage = error.message;
            }
        }
        
        throw new Error(errorMessage);
    }
}

// updateUserProfileUI function is defined above, no duplicate needed

// 显示通知（成功/错误）
function showNotification(message, type = 'success') {
    // 移除现有通知
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icon = type === 'success' 
        ? '<svg class="notification-icon" viewBox="0 0 24 24" fill="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="22,4 12,14.01 9,11.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : '<svg class="notification-icon" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2"/><line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2"/></svg>';
    
    notification.innerHTML = `
        ${icon}
        <span class="notification-text">${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // 显示动画
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // 自动隐藏
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 3000);
}

// ===== CONTENT DETAIL MODAL FUNCTIONS =====

let currentDetailInsight = null;

// 使卡片可点击
function makeCardClickable(card, insight) {
    card.addEventListener('click', (e) => {
        // 防止点击操作按钮时打开模态框
        if (e.target.closest('.action-btn') || e.target.closest('.content-card-actions')) {
            return;
        }
        
        console.log('🖱️ 用户点击了内容卡片:', insight.title || insight.url);
        openContentDetailModal(insight);
    });
}

// 打开内容详情模态框
function openContentDetailModal(insight) {
    console.log('📖 打开内容详情模态框:', insight);
    
    currentDetailInsight = insight;
    const modal = document.getElementById('contentDetailModal');
    
    if (!modal) {
        console.error('❌ 找不到内容详情模态框元素');
        return;
    }
    
    // 填充模态框内容
    populateModalContent(insight);
    
    // 显示模态框
    modal.style.display = 'flex';
    // 强制重绘以确保动画效果
    modal.offsetHeight;
    modal.classList.add('show');
    
    // 防止页面滚动
    document.body.style.overflow = 'hidden';
    
    console.log('✅ 内容详情模态框已打开');
}

// 关闭内容详情模态框
function closeContentDetailModal() {
    console.log('❌ 关闭内容详情模态框');
    
    const modal = document.getElementById('contentDetailModal');
    if (!modal) return;
    
    modal.classList.remove('show');
    
    setTimeout(() => {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        currentDetailInsight = null;
    }, 300);
}

// 填充模态框内容
function populateModalContent(insight) {
    console.log('📝 填充模态框内容:', insight);
    
    // 标题
    const titleElement = document.getElementById('modalContentTitle');
    if (titleElement) {
        titleElement.textContent = insight.title || new URL(insight.url).hostname;
    }
    
    // 图片占位符
    const imageContainer = document.getElementById('modalImagePlaceholder');
    if (imageContainer) {
        imageContainer.innerHTML = '';
        
        if (insight.image_url) {
            const img = document.createElement('img');
            img.src = insight.image_url;
            img.alt = insight.title || 'Content image';
            img.onerror = function() {
                imageContainer.innerHTML = '<span>No image available</span>';
            };
            imageContainer.appendChild(img);
        } else {
            imageContainer.innerHTML = '<span>No image available</span>';
        }
    }
    
    // 用户评论
    const commentElement = document.getElementById('modalCommentText');
    if (commentElement) {
        commentElement.textContent = insight.thought || 'No comment added yet.';
    }
    
    // 填充评论编辑表单
    const commentTextarea = document.getElementById('commentEditTextarea');
    if (commentTextarea) {
        commentTextarea.value = insight.thought || '';
    }
    
    // 填充AI摘要日期
    const aiSummaryDate = document.querySelector('.ai-summary-date');
    if (aiSummaryDate) {
        const date = new Date(insight.created_at || Date.now()).toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric'
        }).replace(',', '');
        aiSummaryDate.textContent = date;
    }
    
    // 绑定编辑标签按钮事件
    const editTagsBtn = document.getElementById('modalEditTagsBtn');
    if (editTagsBtn) {
        // Remove any existing event listeners
        editTagsBtn.onclick = null;
        // Add new event listener
        editTagsBtn.onclick = () => {
            console.log('🏷️ Modal edit tags button clicked');
            closeContentDetailModal(); // Close current modal first
            openTagEditModal(insight);  // Open tag edit modal
        };
        console.log('✅ Modal edit tags button event bound');
    } else {
        console.error('❌ Modal edit tags button not found');
    }
    
    // 更新标签显示
    const projectTag = document.querySelector('.project-tag');
    if (projectTag && insight.tags && insight.tags.length > 0) {
        const firstTag = insight.tags[0];
        const tagName = typeof firstTag === 'string' ? firstTag : firstTag.name;
        projectTag.textContent = tagName;
        projectTag.style.backgroundColor = typeof firstTag === 'object' ? firstTag.color : '#8B5CF6';
    } else if (projectTag) {
        projectTag.textContent = 'Project';
        projectTag.style.backgroundColor = '#8B5CF6';
    }
    
    // 填充Quest建议
    populateQuestSuggestions();
    
    // 设置按钮事件
    setupModalActions(insight);
}

// 填充Quest建议
function populateQuestSuggestions() {
    const questGrid = document.getElementById('questSuggestionsGrid');
    if (!questGrid) return;
    
    // 清空现有内容
    questGrid.innerHTML = '';
    
    // 创建3个占位符卡片
    const placeholderCards = [
        {
            date: 'MMDD, YYYY',
            title: 'Title Placeholder',
            tags: ['functional', 'Spotify']
        },
        {
            date: 'MMDD, YYYY',
            title: 'Title Placeholder',
            tags: ['functional', 'Spotify']
        },
        {
            date: 'MMDD, YYYY',
            title: 'Title Placeholder',
            tags: ['functional', 'Spotify']
        }
    ];
    
    placeholderCards.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.className = 'quest-suggestion-card';
        
        cardElement.innerHTML = `
            <div class="quest-card-date">${card.date}</div>
            <div class="quest-card-title">${card.title}</div>
            <div class="quest-card-tags">
                ${card.tags.map(tag => `<span class="quest-card-tag ${tag.toLowerCase()}">${tag}</span>`).join('')}
            </div>
        `;
        
        questGrid.appendChild(cardElement);
    });
}

// 设置模态框操作按钮
function setupModalActions(insight) {
    // 设置评论编辑功能
    setupCommentEditing();
    
    // Note: Share button removed from user info section
    
    // 设置分享我的空间按钮
    const shareMySpaceBtn = document.querySelector('.share-my-space-btn');
    if (shareMySpaceBtn) {
        shareMySpaceBtn.onclick = () => {
            // TODO: Implement share my space functionality
            console.log('Share My Space clicked');
        };
    }
    
    // 设置编辑标签按钮
    const editTagsBtn = document.querySelector('.edit-tags-btn');
    if (editTagsBtn) {
        editTagsBtn.onclick = () => {
            // TODO: Implement edit tags functionality
            console.log('Edit Tags clicked');
        };
    }
}

// 设置评论编辑功能
function setupCommentEditing() {
    const editCommentBtn = document.getElementById('editCommentBtn');
    const commentContent = document.getElementById('modalCommentContent');
    const commentEditForm = document.getElementById('commentEditForm');
    const saveCommentBtn = document.getElementById('saveCommentBtn');
    const cancelCommentBtn = document.getElementById('cancelCommentBtn');
    const commentTextarea = document.getElementById('commentEditTextarea');
    
    if (!editCommentBtn || !commentContent || !commentEditForm) return;
    
    // 编辑按钮点击事件
    editCommentBtn.addEventListener('click', () => {
        commentContent.style.display = 'none';
        commentEditForm.style.display = 'block';
        commentTextarea.focus();
    });
    
    // 保存按钮点击事件
    saveCommentBtn.addEventListener('click', () => {
        const newComment = commentTextarea.value.trim();
        if (newComment) {
            // 更新显示的评论
            const commentText = document.getElementById('modalCommentText');
            if (commentText) {
                commentText.textContent = newComment;
            }
            
            // TODO: Save comment to backend
            console.log('Saving comment:', newComment);
        }
        
        // 切换回显示模式
        commentContent.style.display = 'flex';
        commentEditForm.style.display = 'none';
    });
    
    // 取消按钮点击事件
    cancelCommentBtn.addEventListener('click', () => {
        // 恢复原始内容
        const commentText = document.getElementById('modalCommentText');
        if (commentText) {
            commentTextarea.value = commentText.textContent;
        }
        
        // 切换回显示模式
        commentContent.style.display = 'flex';
        commentEditForm.style.display = 'none';
    });
}

// 绑定模态框事件监听器
function bindContentDetailModalEvents() {
    const modal = document.getElementById('contentDetailModal');
    const overlay = document.getElementById('contentDetailOverlay');
    const closeBtn = document.getElementById('contentDetailClose');
    
    // 点击遮罩层关闭
    if (overlay) {
        overlay.addEventListener('click', closeContentDetailModal);
    }
    
    // 点击关闭按钮
    if (closeBtn) {
        closeBtn.addEventListener('click', closeContentDetailModal);
    }
    
    // ESC键关闭
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && modal.classList.contains('show')) {
            closeContentDetailModal();
        }
    });
    
    console.log('✅ 内容详情模态框事件监听器已绑定');
}

// 暴露全局函数
window.openProfileEditModal = openProfileEditModal;
window.closeProfileEditModal = closeProfileEditModal;
window.handleProfileUpdate = handleProfileUpdate;
window.replaceAllTagsWithDefaults = replaceAllTagsWithDefaults;

// Edit Mode Functionality
function bindEditModeEvents() {
    const editModeBtn = document.getElementById('editModeBtn');
    if (editModeBtn) {
        editModeBtn.addEventListener('click', toggleEditMode);
        console.log('✅ Edit mode button event bound');
    }
}

function toggleEditMode() {
    isEditMode = !isEditMode;
    const editModeBtn = document.getElementById('editModeBtn');
    const editBtnText = editModeBtn.querySelector('.edit-btn-text');
    
    if (isEditMode) {
        // Enter edit mode
        editModeBtn.classList.add('active');
        editBtnText.textContent = 'Done';
        document.body.classList.add('edit-mode');
        
        // Add shaking animation to all content cards
        const contentCards = document.querySelectorAll('.content-card');
        contentCards.forEach(card => {
            card.classList.add('shake');
        });
        
        console.log('✅ Entered edit mode');
    } else {
        // Exit edit mode
        editModeBtn.classList.remove('active');
        editBtnText.textContent = 'Edit';
        document.body.classList.remove('edit-mode');
        
        // Remove shaking animation from all content cards
        const contentCards = document.querySelectorAll('.content-card');
        contentCards.forEach(card => {
            card.classList.remove('shake');
        });
        
        console.log('✅ Exited edit mode');
    }
}

// Function to get source name from URL
function getSourceName(url) {
    try {
        const hostname = new URL(url).hostname;
        // Map common domains to friendly names
        const sourceMap = {
            'open.spotify.com': 'Spotify',
            'www.youtube.com': 'YouTube',
            'youtube.com': 'YouTube',
            'www.wikipedia.org': 'Wikipedia',
            'en.wikipedia.org': 'Wikipedia',
            'www.medium.com': 'Medium',
            'medium.com': 'Medium',
            'www.github.com': 'GitHub',
            'github.com': 'GitHub',
            'www.twitter.com': 'Twitter',
            'twitter.com': 'Twitter',
            'www.linkedin.com': 'LinkedIn',
            'linkedin.com': 'LinkedIn'
        };
        
        return sourceMap[hostname] || hostname.replace('www.', '');
    } catch (error) {
        return 'Unknown Source';
    }
}

// Function to update edit mode state when content cards are re-rendered
function updateEditModeState() {
    if (isEditMode) {
        const contentCards = document.querySelectorAll('.content-card');
        contentCards.forEach(card => {
            card.classList.add('shake');
        });
    }
}

// Setup drag and drop functionality for a card
function setupCardDragAndDrop(card, insight) {
    // Only enable drag in edit mode
    card.addEventListener('mousedown', (e) => {
        if (!isEditMode || e.target.closest('.content-card-delete-btn')) {
            return;
        }
        
        e.preventDefault();
        startDrag(card, e);
    });
    
    // Touch events for mobile
    card.addEventListener('touchstart', (e) => {
        if (!isEditMode || e.target.closest('.content-card-delete-btn')) {
            return;
        }
        
        e.preventDefault();
        const touch = e.touches[0];
        startDrag(card, touch);
    });
}

// Start dragging a card
function startDrag(card, event) {
    draggedCard = card;
    const rect = card.getBoundingClientRect();
    
    dragOffset.x = event.clientX - rect.left;
    dragOffset.y = event.clientY - rect.top;
    
    // Add dragging class
    card.classList.add('dragging');
    card.classList.remove('shake'); // Stop shaking while dragging
    
    // Create ghost element
    const ghost = card.cloneNode(true);
    ghost.classList.add('drag-ghost');
    ghost.style.position = 'fixed';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '10000';
    ghost.style.width = rect.width + 'px';
    ghost.style.height = rect.height + 'px';
    ghost.style.transform = 'rotate(2deg) scale(1.05)';
    ghost.style.opacity = '0.95';
    ghost.style.transition = 'none';
    ghost.style.boxShadow = '0 15px 35px rgba(0, 0, 0, 0.3)';
    ghost.style.border = '2px solid var(--quest-purple)';
    document.body.appendChild(ghost);
    
    // Position ghost
    updateGhostPosition(ghost, event);
    
    // Add event listeners
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchmove', handleDragMove);
    document.addEventListener('touchend', handleDragEnd);
    
    console.log('🎯 Started dragging card:', card.dataset.insightId);
}

// Handle drag move
function handleDragMove(e) {
    if (!draggedCard) return;
    
    const event = e.touches ? e.touches[0] : e;
    const ghost = document.querySelector('.drag-ghost');
    
    if (ghost) {
        updateGhostPosition(ghost, event);
    }
    
    // Check for potential stack creation
    checkForStackHover(event);
}

// Update ghost position
function updateGhostPosition(ghost, event) {
    ghost.style.left = (event.clientX - dragOffset.x) + 'px';
    ghost.style.top = (event.clientY - dragOffset.y) + 'px';
}

// Check if dragging over another card for stack creation
function checkForStackHover(event) {
    // Temporarily hide the ghost to get element below
    const ghost = document.querySelector('.drag-ghost');
    let elementBelow;
    
    if (ghost) {
        ghost.style.display = 'none';
        elementBelow = document.elementFromPoint(event.clientX, event.clientY);
        ghost.style.display = 'block';
    } else {
        elementBelow = document.elementFromPoint(event.clientX, event.clientY);
    }
    
    const targetCard = elementBelow?.closest('.content-card:not(.dragging):not(.stack-card)');
    
    if (targetCard && targetCard !== draggedCard) {
        // Clear previous timeout
        if (stackHoverTimeout) {
            clearTimeout(stackHoverTimeout);
        }
        
        // Add hover effect
        targetCard.classList.add('stack-hover');
        
        // Set timeout for stack creation
        stackHoverTimeout = setTimeout(() => {
            createStack(draggedCard, targetCard);
        }, 1500); // 1.5 seconds hover time
        
        console.log('🎯 Hovering over card for stack creation:', targetCard.dataset.insightId);
        
    } else {
        // Clear hover effects
        document.querySelectorAll('.content-card.stack-hover').forEach(card => {
            card.classList.remove('stack-hover');
        });
        
        if (stackHoverTimeout) {
            clearTimeout(stackHoverTimeout);
            stackHoverTimeout = null;
        }
    }
}

// Handle drag end
function handleDragEnd(e) {
    if (!draggedCard) return;
    
    // Clean up
    const ghost = document.querySelector('.drag-ghost');
    if (ghost) {
        ghost.remove();
    }
    
    // Remove dragging class and restore shake if in edit mode
    draggedCard.classList.remove('dragging');
    if (isEditMode) {
        draggedCard.classList.add('shake');
    }
    
    // Clear hover effects
    document.querySelectorAll('.content-card.stack-hover').forEach(card => {
        card.classList.remove('stack-hover');
    });
    
    // Clear timeout
    if (stackHoverTimeout) {
        clearTimeout(stackHoverTimeout);
        stackHoverTimeout = null;
    }
    
    // Remove event listeners
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('touchmove', handleDragMove);
    document.removeEventListener('touchend', handleDragEnd);
    
    draggedCard = null;
    console.log('🎯 Ended dragging');
}

// Create a stack from two cards
async function createStack(card1, card2) {
    console.log('📚 Creating stack with cards:', card1.dataset.insightId, card2.dataset.insightId);
    
    // Get insight data for both cards (moved outside try block for scope)
    const insight1 = getInsightById(card1.dataset.insightId);
    const insight2 = getInsightById(card2.dataset.insightId);
    
    if (!insight1 || !insight2) {
        console.error('❌ Cannot find insight data for cards');
        return;
    }
    
    try {
        // Check if either insight is already in a stack (one-to-one constraint)
        const insight1InStack = Array.from(stacks.values()).some(stack => 
            stack.cards.some(card => card.id === insight1.id)
        );
        const insight2InStack = Array.from(stacks.values()).some(stack => 
            stack.cards.some(card => card.id === insight2.id)
        );
        
        if (insight1InStack || insight2InStack) {
            showErrorMessage('One or both cards are already in a stack. Each card can only be in one stack.');
            return;
        }
        
        // Generate a unique stack ID locally
        const stackId = `stack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Add insights to the stack via insights API (using stack_id field)
        const updatePromises = [
            api.addItemToStack(stackId, insight1.id),
            api.addItemToStack(stackId, insight2.id)
        ];
        
        const responses = await Promise.all(updatePromises);
        
        // Check if all updates were successful
        const allSuccessful = responses.every(response => response.success);
        
        if (allSuccessful) {
            // Create local stack data
            const localStackData = {
                id: stackId,
                name: 'Stack',
                cards: [insight1, insight2],
                createdAt: new Date().toISOString(),
                modifiedAt: new Date().toISOString(),
                isExpanded: false
            };
            
            // Add to local stacks collection
            stacks.set(stackId, localStackData);
            
            // Remove cards from currentInsights to avoid duplicates
            // (This is safe because of one-to-one constraint)
            currentInsights = currentInsights.filter(insight => 
                insight.id !== insight1.id && 
                insight.id !== insight2.id
            );
            
            // Update stackIdCounter
            stackIdCounter = Math.max(stackIdCounter, parseInt(stackId.split('_')[1]) + 1);
            
            // Save to localStorage for persistence
            saveStacksToLocalStorage();
            saveInsightsToLocalStorage();
            
            // Also try to create the stack in the backend database
            try {
                const stackCreateResponse = await api.createStack({
                    id: stackId,
                    name: 'Stack',
                    created_at: localStackData.createdAt,
                    modified_at: localStackData.modifiedAt
                });
            } catch (stackCreateError) {
                console.warn('⚠️ Failed to create stack in backend database (this is OK, stack_id approach still works):', stackCreateError);
            }
            
            // Re-render content
            renderInsights();
            
            showSuccessMessage('Stack created successfully!');
        } else {
            throw new Error('Failed to update insights with stack information');
        }
            } catch (error) {
            console.error('❌ Failed to create stack via API:', error);
            
            // Fallback to local storage if API doesn't support stack_id
            console.log('📝 Stack API not working, using local storage fallback');
            
            // Create stack locally
            const stackId = `stack_${stackIdCounter++}`;
            const localStackData = {
                id: stackId,
                name: 'Stack',
                cards: [insight1, insight2],
                createdAt: new Date().toISOString(),
                modifiedAt: new Date().toISOString(),
                isExpanded: false
            };
            
            // Add to local stacks collection
            stacks.set(stackId, localStackData);
            
            // Remove cards from currentInsights
            currentInsights = currentInsights.filter(insight => 
                insight.id !== insight1.id && 
                insight.id !== insight2.id
            );
            
            // Save to localStorage for persistence
            saveStacksToLocalStorage();
            
            // Re-render content
            renderInsights();
            
            showSuccessMessage('Stack created successfully! (Local storage)');
        }
    
    // Clear drag state
    if (stackHoverTimeout) {
        clearTimeout(stackHoverTimeout);
        stackHoverTimeout = null;
    }
}

// Get insight by ID
function getInsightById(id) {
    return currentInsights.find(insight => insight.id === id);
}

// Save stacks to localStorage (called periodically to prevent data loss)
function saveStacksToLocalStorage() {
    try {
        if (!hasLoadedStacksOnce) return;           // only after an initial load
        const stacksData = Array.from(stacks.entries());
        if (stacksData.length === 0) return;        // never overwrite with empty
        localStorage.setItem('quest_stacks', JSON.stringify(stacksData));
        console.log('💾 Saved stacks to localStorage:', stacksData.length, 'stacks');
    } catch (error) {
        console.error('❌ Failed to save stacks to localStorage:', error);
    }
}

// Save insights to localStorage backup
function saveInsightsToLocalStorage() {
    try {
        if (!hasLoadedInsightsOnce) return;          // only after an initial load
        if (!Array.isArray(currentInsights) || currentInsights.length === 0) return;
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
if (!window.__QUEST_AUTOSAVE_ID__) {
    window.__QUEST_AUTOSAVE_ID__ = setInterval(() => {
        saveStacksToLocalStorage();
        saveInsightsToLocalStorage();
    }, 30000);
}

// Get stack by insight ID (one-to-one relationship)
function getStackByInsightId(insightId) {
    return Array.from(stacks.values()).find(stack => 
        stack.cards.some(card => card.id === insightId)
    );
}

// Check if insight is in any stack
function isInsightInStack(insightId) {
    return getStackByInsightId(insightId) !== undefined;
}

// Create stack card element
function createStackCard(stackData) {
    const card = document.createElement('div');
    card.className = 'content-card stack-card';
    card.dataset.stackId = stackData.id;
    
    // Add delete button for edit mode
    const editDeleteBtn = document.createElement('button');
    editDeleteBtn.className = 'content-card-delete-btn';
    editDeleteBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12H19" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    editDeleteBtn.title = 'Delete Stack';
    editDeleteBtn.onclick = (e) => {
        e.stopPropagation();
        deleteStack(stackData.id);
    };
    card.appendChild(editDeleteBtn);
    
    // Stack visual indicator
    const stackIndicator = document.createElement('div');
    stackIndicator.className = 'stack-indicator';
    stackIndicator.innerHTML = `<span class="stack-count">${stackData.cards.length}</span>`;
    card.appendChild(stackIndicator);
    
    // Use first card's image as preview
    const firstCard = stackData.cards[0];
    if (firstCard && firstCard.image_url) {
        const imageContainer = document.createElement('div');
        imageContainer.className = 'content-card-image-container';
        
        const img = document.createElement('img');
        img.src = firstCard.image_url;
        img.alt = firstCard.title || 'Stack Preview';
        img.className = 'content-card-image';
        img.loading = 'lazy';
        
        imageContainer.appendChild(img);
        card.appendChild(imageContainer);
    } else {
        const placeholderContainer = document.createElement('div');
        placeholderContainer.className = 'content-card-image-container no-image';
        card.appendChild(placeholderContainer);
    }
    
    // Stack content
    const content = document.createElement('div');
    content.className = 'content-card-content';
    
    const header = document.createElement('div');
    header.className = 'content-card-header';
    
    const title = document.createElement('h3');
    title.className = 'content-card-title stack-title';
    title.textContent = stackData.name;
    header.appendChild(title);
    
    const description = document.createElement('p');
    description.className = 'content-card-description';
    description.textContent = `${stackData.cards.length} items • Created ${formatDate(stackData.createdAt)}`;
    
    content.appendChild(header);
    content.appendChild(description);
    
    // Footer with main tag
    const footer = document.createElement('div');
    footer.className = 'content-card-footer';
    
    const mainTag = document.createElement('span');
    mainTag.className = 'content-card-tag-main';
    mainTag.textContent = 'STACK';
    footer.appendChild(mainTag);
    
    content.appendChild(footer);
    card.appendChild(content);
    
    // Click handler to expand/collapse stack
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.content-card-delete-btn')) {
            if (stackData.isExpanded) {
                collapseStack(stackData.id);
            } else {
                expandStack(stackData);
            }
        }
    });
    
    return card;
}

// Remove an item from a stack
async function removeItemFromStack(stackId, insightId) {
    if (confirm('Are you sure you want to remove this item from the stack?')) {
        try {
            console.log('🗑️ Removing item from stack:', { stackId, insightId });
            
            // Remove stack_id from the insight via API
            const response = await api.removeItemFromStack(stackId, insightId);
            
            if (response.success) {
                // Get the stack data
                const stackData = stacks.get(stackId);
                if (stackData) {
                    // Find and remove the insight from the stack
                    const insightIndex = stackData.cards.findIndex(card => card.id === insightId);
                    if (insightIndex !== -1) {
                        const removedInsight = stackData.cards[insightIndex];
                        
                        // Remove from stack
                        stackData.cards.splice(insightIndex, 1);
                        
                        // Add back to currentInsights
                        currentInsights.push(removedInsight);
                        
                        // Update stack metadata
                        stackData.modifiedAt = new Date().toISOString();
                        
                        // Save to localStorage
                        saveInsightsToLocalStorage();
                        
                        // If stack has 1 or fewer items, dissolve it
                        if (stackData.cards.length <= 1) {
                            // Move the remaining item back to insights if there is one
                            if (stackData.cards.length === 1) {
                                currentInsights.push(stackData.cards[0]);
                            }
                            stacks.delete(stackId);
                            saveStacksToLocalStorage();
                            saveInsightsToLocalStorage();
                            showSuccessMessage('Item removed from stack. Stack dissolved (only 1 item remaining).');
                        } else {
                            // Update stack count in localStorage
                            saveStacksToLocalStorage();
                            showSuccessMessage('Item removed from stack.');
                        }
                        
                        // Re-render content
                        renderInsights();
                    } else {
                        console.warn('⚠️ Insight not found in stack');
                        showErrorMessage('Item not found in stack.');
                    }
                } else {
                    console.warn('⚠️ Stack not found');
                    showErrorMessage('Stack not found.');
                }
            } else {
                throw new Error(response.message || 'Failed to remove item from stack');
            }
        } catch (error) {
            console.error('❌ Failed to remove item from stack:', error);
            
            // Fallback to local storage if API is not implemented
            if (error.message.includes('404') || error.message.includes('Not Found')) {
                console.log('📝 Stack API not implemented, using local storage fallback');
                
                // Get the stack data
                const stackData = stacks.get(stackId);
                if (stackData) {
                    // Find and remove the insight from the stack
                    const insightIndex = stackData.cards.findIndex(card => card.id === insightId);
                    if (insightIndex !== -1) {
                        const removedInsight = stackData.cards[insightIndex];
                        
                        // Remove from stack
                        stackData.cards.splice(insightIndex, 1);
                        
                        // Add back to currentInsights
                        currentInsights.push(removedInsight);
                        
                        // Update stack metadata
                        stackData.modifiedAt = new Date().toISOString();
                        
                        // Save to localStorage
                        saveInsightsToLocalStorage();
                        
                        // If stack has 1 or fewer items, dissolve it
                        if (stackData.cards.length <= 1) {
                            // Move the remaining item back to insights if there is one
                            if (stackData.cards.length === 1) {
                                currentInsights.push(stackData.cards[0]);
                            }
                            stacks.delete(stackId);
                            saveStacksToLocalStorage();
                            saveInsightsToLocalStorage();
                            showSuccessMessage('Item removed from stack. Stack dissolved (only 1 item remaining). (Local storage)');
                        } else {
                            // Update stack count in localStorage
                            saveStacksToLocalStorage();
                            showSuccessMessage('Item removed from stack. (Local storage)');
                        }
                        
                        // Re-render content
                        renderInsights();
                    } else {
                        console.warn('⚠️ Insight not found in stack');
                        showErrorMessage('Item not found in stack.');
                    }
                } else {
                    console.warn('⚠️ Stack not found');
                    showErrorMessage('Stack not found.');
                }
            } else {
                showErrorMessage('Failed to remove item from stack. Please try again.');
            }
        }
    }
}

// Delete a stack
async function deleteStack(stackId) {
    if (confirm('Are you sure you want to delete this stack? All items will be moved back to your space.')) {
        try {
            // Ensure we have a valid session before proceeding
            if (!auth.checkAuth()) {
                const restored = auth.restoreSession();
                if (!restored) {
                    showErrorMessage('Please sign in to delete stacks.');
                    return;
                }
            }
            
            // Validate token before making API calls
            const tokenValid = await auth.validateToken();
            if (!tokenValid) {
                auth.clearSession();
                showErrorMessage('Your session has expired. Please sign in again.');
                return;
            }
            
            const stackData = stacks.get(stackId);
            if (stackData) {
                // Remove stack_id from all insights in the stack via insights API
                const removePromises = stackData.cards.map(card => 
                    api.removeItemFromStack(stackId, card.id)
                );
                
                const responses = await Promise.all(removePromises);
                
                // Check if all updates were successful
                const allSuccessful = responses.every(response => response.success);
                
                if (allSuccessful) {
                    // Don't add cards back to currentInsights - they'll be loaded from backend on next refresh
                    // This prevents duplication issues
                    console.log('✅ Stack deleted, cards will be available in main space on next refresh');
                    stacks.delete(stackId);
                    
                    // Update localStorage to remove the deleted stack
                    saveStacksToLocalStorage();
                    saveInsightsToLocalStorage();
                    
                    // Re-render content
                    renderInsights();
                    showSuccessMessage('Stack deleted and items restored.');
                } else {
                    throw new Error('Failed to remove stack_id from insights');
                }
            }
        } catch (error) {
            console.error('❌ Failed to delete stack via API:', error);
            
            // Fallback to local storage if API is not implemented
            if (error.message.includes('404') || error.message.includes('Not Found')) {
                console.log('📝 Stack API not implemented, using local storage fallback');
                
                // Don't add cards back to currentInsights - they'll be loaded from backend on next refresh
                // This prevents duplication issues
                console.log('✅ Stack deleted (local storage), cards will be available in main space on next refresh');
                stacks.delete(stackId);
                
                // Update localStorage to remove the deleted stack
                saveStacksToLocalStorage();
                
                // Re-render content
                renderInsights();
                showSuccessMessage('Stack deleted and items restored. (Local storage)');
            } else {
                showErrorMessage('Failed to delete stack. Please try again.');
            }
        }
    }
}

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
    });
}

// Expand stack horizontally in place
function expandStack(stackData) {
    console.log('📂 Expanding stack horizontally:', stackData.name);
    
    // Find the stack card element
    const stackCard = document.querySelector(`[data-stack-id="${stackData.id}"]`);
    if (!stackCard) return;
    
    // Mark this stack as expanded
    stackData.isExpanded = true;
    
    // Add expanded class to the card
    stackCard.classList.add('stack-expanded');
    
    // Replace the stack card content with expanded view
    stackCard.innerHTML = `
        <div class="stack-expanded-header">
            <div class="stack-info-horizontal">
                <h3 class="stack-name-horizontal">${stackData.name}</h3>
                <div class="stack-meta-horizontal">
                    <span class="stack-created">Created: ${formatDate(stackData.createdAt)}</span>
                    <span class="stack-modified">Last Modified: ${formatDate(stackData.modifiedAt)}</span>
                </div>
            </div>
            <div class="stack-actions-horizontal">
                <button class="stack-edit-name-btn-horizontal">Edit Name</button>
                <button class="stack-collapse-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M18 15l-6-6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
        </div>
        
        <div class="stack-cards-horizontal" id="stackCardsHorizontal-${stackData.id}">
            <!-- Cards will be populated here -->
        </div>
        
        <div class="stack-footer-horizontal">
            <button class="stack-edit-mode-btn-horizontal" data-stack-id="${stackData.id}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <span class="stack-edit-btn-text-horizontal">Edit</span>
            </button>
        </div>
    `;
    
    // Add event listeners
    const editNameBtn = stackCard.querySelector('.stack-edit-name-btn-horizontal');
    const collapseBtn = stackCard.querySelector('.stack-collapse-btn');
    const editModeBtn = stackCard.querySelector('.stack-edit-mode-btn-horizontal');
    
    editNameBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        editStackName(stackData.id);
    });
    
    collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        collapseStack(stackData.id);
    });
    
    editModeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleStackEditModeHorizontal(stackData.id);
    });
    
    // Populate cards horizontally
    const stackCardsContainer = document.getElementById(`stackCardsHorizontal-${stackData.id}`);
    stackData.cards.forEach(cardData => {
        const card = createStackHorizontalCard(cardData, stackData.id);
        stackCardsContainer.appendChild(card);
    });
}

// Create card for stack expansion view
function createStackExpandedCard(insight, stackId) {
    const card = document.createElement('div');
    card.className = 'stack-expanded-card';
    card.dataset.insightId = insight.id;
    card.dataset.stackId = stackId;
    
    // Card image
    if (insight.image_url) {
        const imageContainer = document.createElement('div');
        imageContainer.className = 'stack-card-image-container';
        
        const img = document.createElement('img');
        img.src = insight.image_url;
        img.alt = insight.title || 'Content Image';
        img.className = 'stack-card-image';
        img.loading = 'lazy';
        
        imageContainer.appendChild(img);
        card.appendChild(imageContainer);
    }
    
    // Card content
    const content = document.createElement('div');
    content.className = 'stack-card-content';
    
    const title = document.createElement('h4');
    title.className = 'stack-card-title';
    title.textContent = insight.title || 'Untitled';
    
    const description = document.createElement('p');
    description.className = 'stack-card-description';
    description.textContent = insight.summary || insight.description || 'No description available';
    
    content.appendChild(title);
    content.appendChild(description);
    card.appendChild(content);
    
    // Setup drag functionality for stack edit mode
    setupStackCardDrag(card, insight, stackId);
    
    // Click handler to view full content
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.stack-card-remove-btn')) {
            // Open content detail modal (reuse existing functionality)
            openContentDetailModal(insight);
        }
    });
    
    return card;
}

// Setup drag functionality for cards in stack expansion
function setupStackCardDrag(card, insight, stackId) {
    card.addEventListener('mousedown', (e) => {
        // Check for both modal and inline edit modes
        const stackModal = document.querySelector('.stack-expansion-modal');
        const stackView = document.querySelector('.stack-expansion-view');
        
        const isModalEditMode = stackModal?.classList.contains('stack-edit-mode');
        const isInlineEditMode = stackView?.classList.contains('stack-edit-mode-inline');
        
        if (!isModalEditMode && !isInlineEditMode) {
            return;
        }
        
        e.preventDefault();
        startStackCardDrag(card, e, insight, stackId);
    });
}

// Start dragging a card from stack
function startStackCardDrag(card, event, insight, stackId) {
    console.log('🎯 Starting stack card drag:', insight.id);
    
    draggedCard = card;
    const rect = card.getBoundingClientRect();
    
    dragOffset.x = event.clientX - rect.left;
    dragOffset.y = event.clientY - rect.top;
    
    // Add dragging class
    card.classList.add('dragging');
    
    // Create ghost element
    const ghost = card.cloneNode(true);
    ghost.classList.add('drag-ghost');
    ghost.style.position = 'fixed';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '10000';
    ghost.style.width = rect.width + 'px';
    ghost.style.height = rect.height + 'px';
    ghost.style.transform = 'rotate(2deg) scale(1.05)';
    ghost.style.opacity = '0.95';
    ghost.style.transition = 'none';
    ghost.style.boxShadow = '0 15px 35px rgba(0, 0, 0, 0.3)';
    ghost.style.border = '2px solid var(--quest-purple)';
    document.body.appendChild(ghost);
    
    // Position ghost
    updateGhostPosition(ghost, event);
    
    // Add event listeners
    document.addEventListener('mousemove', handleStackCardDragMove);
    document.addEventListener('mouseup', (e) => handleStackCardDragEnd(e, insight, stackId));
}

// Handle stack card drag move
function handleStackCardDragMove(e) {
    if (!draggedCard) return;
    
    const ghost = document.querySelector('.drag-ghost');
    if (ghost) {
        updateGhostPosition(ghost, e);
    }
    
    // Check if dragging outside stack container to remove from stack
    const stackModal = document.querySelector('.stack-expansion-modal');
    const stackView = document.querySelector('.stack-expansion-view');
    
    let containerRect;
    if (stackModal) {
        containerRect = stackModal.getBoundingClientRect();
    } else if (stackView) {
        containerRect = stackView.getBoundingClientRect();
    }
    
    if (containerRect && (e.clientX < containerRect.left || e.clientX > containerRect.right ||
        e.clientY < containerRect.top || e.clientY > containerRect.bottom)) {
        // Show indication that card will be removed from stack
        draggedCard.classList.add('removing-from-stack');
    } else {
        draggedCard.classList.remove('removing-from-stack');
    }
}

// Handle stack card drag end
function handleStackCardDragEnd(e, insight, stackId) {
    if (!draggedCard) return;
    
    // Clean up ghost
    const ghost = document.querySelector('.drag-ghost');
    if (ghost) {
        ghost.remove();
    }
    
    // Check if card was dragged outside stack modal
    const stackModal = document.querySelector('.stack-expansion-modal');
    const modalRect = stackModal.getBoundingClientRect();
    
    if (e.clientX < modalRect.left || e.clientX > modalRect.right ||
        e.clientY < modalRect.top || e.clientY > modalRect.bottom) {
        // Remove card from stack
        removeCardFromStack(insight, stackId);
    }
    
    // Clean up
    draggedCard.classList.remove('dragging', 'removing-from-stack');
    
    // Remove event listeners
    document.removeEventListener('mousemove', handleStackCardDragMove);
    
    draggedCard = null;
}

// Move card to another stack (one-to-one relationship)
async function moveCardToStack(insight, newStackId) {
    try {
        // Check if insight is already in a stack
        const currentStack = getStackByInsightId(insight.id);
        if (!currentStack) {
            showErrorMessage('Card is not in any stack');
            return;
        }
        
        // Check if target stack exists
        const targetStack = stacks.get(newStackId);
        if (!targetStack) {
            showErrorMessage('Target stack not found');
            return;
        }
        
        // Move card via API (updates insight's stack_id)
        const response = await api.moveItemToStack(newStackId, insight.id);
        
        if (response.success) {
            // Remove from current stack
            currentStack.cards = currentStack.cards.filter(card => card.id !== insight.id);
            
            // Add to target stack
            targetStack.cards.push(insight);
            targetStack.modifiedAt = response.data?.modified_at || new Date().toISOString();
            
            // If current stack is empty, delete it
            if (currentStack.cards.length === 0) {
                stacks.delete(currentStack.id);
                saveStacksToLocalStorage();
                showSuccessMessage('Card moved to new stack. Empty stack deleted.');
            } else {
                showSuccessMessage('Card moved to new stack successfully.');
            }
            
            // Re-render content
            renderInsights();
        } else {
            throw new Error(response.message || 'Failed to move card');
        }
            } catch (error) {
            console.error('❌ Failed to move card via API:', error);
            
            // Fallback to local storage if API is not implemented
            if (error.message.includes('404') || error.message.includes('Not Found')) {
                console.log('📝 Stack API not implemented, using local storage fallback');
                
                // Remove from current stack
                currentStack.cards = currentStack.cards.filter(card => card.id !== insight.id);
                
                // Add to target stack
                targetStack.cards.push(insight);
                targetStack.modifiedAt = new Date().toISOString();
                
                // If current stack is empty, delete it
                if (currentStack.cards.length === 0) {
                    stacks.delete(currentStack.id);
                    saveStacksToLocalStorage();
                    showSuccessMessage('Card moved to new stack. Empty stack deleted. (Local storage)');
                } else {
                    showSuccessMessage('Card moved to new stack successfully. (Local storage)');
                }
                
                // Re-render content
                renderInsights();
            } else {
                showErrorMessage('Failed to move card. Please try again.');
            }
        }
}

// Remove card from stack
async function removeCardFromStack(insight, stackId) {
    const stackData = stacks.get(stackId);
    if (!stackData) return;
    
    try {
        // Remove card from stack via API (sets stack_id to null)
        const response = await api.removeItemFromStack(stackId, insight.id);
        
        if (response.success) {
            // Remove card from local stack data
            stackData.cards = stackData.cards.filter(card => card.id !== insight.id);
            stackData.modifiedAt = response.data?.modified_at || new Date().toISOString();
            
            // Add card back to main insights (safe because of one-to-one constraint)
            currentInsights.push(insight);
            
            // Save to localStorage
            saveInsightsToLocalStorage();
            
            // If stack has only one card left, dissolve the stack
            if (stackData.cards.length <= 1) {
                if (stackData.cards.length === 1) {
                    // Remove the last card from stack
                    const lastCard = stackData.cards[0];
                    await api.removeItemFromStack(stackId, lastCard.id);
                    currentInsights.push(lastCard);
                }
                stacks.delete(stackId);
                saveStacksToLocalStorage();
                saveInsightsToLocalStorage();
                closeStackExpansion();
                showSuccessMessage('Stack dissolved - cards moved back to your space.');
            } else {
                // Update stack display
                const stackCardsGrid = document.getElementById('stackCardsGrid');
                const cardElement = stackCardsGrid.querySelector(`[data-insight-id="${insight.id}"]`);
                if (cardElement) {
                    cardElement.remove();
                }
                
                // Update stack info
                const stackCountEl = document.querySelector('.stack-count');
                if (stackCountEl) {
                    stackCountEl.textContent = `${stackData.cards.length} items`;
                }
                
                showSuccessMessage('Card removed from stack.');
            }
            
            // Re-render main view
            renderInsights();
        } else {
            throw new Error(response.message || 'Failed to remove card from stack');
        }
            } catch (error) {
            console.error('❌ Failed to remove card from stack via API:', error);
            
            // Fallback to local storage if API is not implemented
            if (error.message.includes('404') || error.message.includes('Not Found')) {
                console.log('📝 Stack API not implemented, using local storage fallback');
                
                // Remove card from local stack data
                stackData.cards = stackData.cards.filter(card => card.id !== insight.id);
                stackData.modifiedAt = new Date().toISOString();
                
                // Add card back to main insights (safe because of one-to-one constraint)
                currentInsights.push(insight);
                
                // If stack has only one card left, dissolve the stack
                if (stackData.cards.length <= 1) {
                    if (stackData.cards.length === 1) {
                        currentInsights.push(stackData.cards[0]);
                    }
                    stacks.delete(stackId);
                    saveStacksToLocalStorage();
                    saveInsightsToLocalStorage();
                    closeStackExpansion();
                    showSuccessMessage('Stack dissolved - cards moved back to your space. (Local storage)');
                } else {
                    // Update stack display
                    const stackCardsGrid = document.getElementById('stackCardsGrid');
                    const cardElement = stackCardsGrid.querySelector(`[data-insight-id="${insight.id}"]`);
                    if (cardElement) {
                        cardElement.remove();
                    }
                    
                    // Update stack info
                    const stackCountEl = document.querySelector('.stack-count');
                    if (stackCountEl) {
                        stackCountEl.textContent = `${stackData.cards.length} items`;
                    }
                    
                    showSuccessMessage('Card removed from stack. (Local storage)');
                }
                
                // Re-render main view
                renderInsights();
            } else {
                showErrorMessage('Failed to remove card from stack. Please try again.');
            }
        }
}

// Close stack expansion modal (legacy)
function closeStackExpansion() {
    const modal = document.querySelector('.stack-expansion-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

// Close inline stack expansion
function closeStackExpansionInline(stackId) {
    const stackData = stacks.get(stackId);
    if (stackData) {
        stackData.isExpanded = false;
    }
    
    // Remove back button
    const backBtn = document.querySelector('.stack-back-btn');
    if (backBtn) {
        backBtn.remove();
    }
    
    // Show filter buttons and add content button
    const filterButtons = document.getElementById('filterButtons');
    const addContentBtn = document.getElementById('addContentBtnLeft');
    const editModeMainBtn = document.getElementById('editModeBtn');
    
    if (filterButtons) filterButtons.style.display = 'flex';
    if (addContentBtn) addContentBtn.style.display = 'flex';
    if (editModeMainBtn) editModeMainBtn.style.display = 'flex';
    
    // Re-render main view
    renderInsights();
}

// Collapse stack back to normal card
function collapseStack(stackId) {
    const stackData = stacks.get(stackId);
    if (!stackData) return;
    
    stackData.isExpanded = false;
    
    // Re-render to show collapsed stack
    renderInsights();
}

// Edit stack name
async function editStackName(stackId) {
    const stackData = stacks.get(stackId);
    if (!stackData) return;
    
    const newName = prompt('Enter new stack name:', stackData.name);
    if (newName && newName.trim() && newName.trim() !== stackData.name) {
        try {
            // Update stack name via API
            const response = await api.updateStack(stackId, {
                name: newName.trim()
            });
            
            if (response.success) {
                // Update local data
                stackData.name = newName.trim();
                stackData.modifiedAt = response.data?.modified_at || new Date().toISOString();
                
                // Update UI
                const stackNameEl = document.querySelector('.stack-name');
                if (stackNameEl) {
                    stackNameEl.textContent = stackData.name;
                }
        
                // Update stack dates
                const stackDatesEl = document.querySelector('.stack-dates');
                if (stackDatesEl) {
                    stackDatesEl.innerHTML = `
                        Created: ${formatDate(stackData.createdAt)} • 
                        Modified: ${formatDate(stackData.modifiedAt)}
                    `;
                }
        
                // Re-render main view to update stack card
                renderInsights();
        
                showSuccessMessage('Stack name updated successfully!');
            } else {
                throw new Error(response.message || 'Failed to update stack name');
            }
        } catch (error) {
            console.error('❌ Failed to update stack name via API:', error);
            
            // Fallback to local storage if API is not implemented
            if (error.message.includes('404') || error.message.includes('Not Found')) {
                console.log('📝 Stack API not implemented, using local storage fallback');
                
                // Update local data
                stackData.name = newName.trim();
                stackData.modifiedAt = new Date().toISOString();
                
                // Update UI
                const stackNameEl = document.querySelector('.stack-name');
                if (stackNameEl) {
                    stackNameEl.textContent = stackData.name;
                }
        
                // Update stack dates
                const stackDatesEl = document.querySelector('.stack-dates');
                if (stackDatesEl) {
                    stackDatesEl.innerHTML = `
                        Created: ${formatDate(stackData.createdAt)} • 
                        Modified: ${formatDate(stackData.modifiedAt)}
                    `;
                }
        
                // Re-render main view to update stack card
                renderInsights();
        
                showSuccessMessage('Stack name updated successfully! (Local storage)');
            } else {
                showErrorMessage('Failed to update stack name. Please try again.');
            }
        }
    }
}

// Toggle stack edit mode (legacy modal)
function toggleStackEditMode(stackId) {
    const modal = document.querySelector('.stack-expansion-modal');
    const editBtn = document.querySelector('.stack-edit-mode-btn');
    const editBtnText = editBtn.querySelector('.stack-edit-btn-text');
    
    if (modal.classList.contains('stack-edit-mode')) {
        // Exit edit mode
        modal.classList.remove('stack-edit-mode');
        editBtn.classList.remove('active');
        editBtnText.textContent = 'Edit';
        
        // Remove shake from cards
        document.querySelectorAll('.stack-expanded-card').forEach(card => {
            card.classList.remove('shake');
        });
    } else {
        // Enter edit mode
        modal.classList.add('stack-edit-mode');
        editBtn.classList.add('active');
        editBtnText.textContent = 'Done';
        
        // Add shake to cards
        document.querySelectorAll('.stack-expanded-card').forEach(card => {
            card.classList.add('shake');
        });
    }
}

// Toggle stack edit mode inline
function toggleStackEditModeInline(stackId) {
    const stackView = document.querySelector('.stack-expansion-view');
    const editBtn = document.querySelector('.stack-edit-mode-btn-inline');
    const editBtnText = editBtn.querySelector('.stack-edit-btn-text-inline');
    
    if (stackView.classList.contains('stack-edit-mode-inline')) {
        // Exit edit mode
        stackView.classList.remove('stack-edit-mode-inline');
        editBtn.classList.remove('active');
        editBtnText.textContent = 'Edit';
        
        // Remove shake from cards
        document.querySelectorAll('.stack-expanded-card').forEach(card => {
            card.classList.remove('shake');
        });
    } else {
        // Enter edit mode
        stackView.classList.add('stack-edit-mode-inline');
        editBtn.classList.add('active');
        editBtnText.textContent = 'Done';
        
        // Add shake to cards
        document.querySelectorAll('.stack-expanded-card').forEach(card => {
            card.classList.add('shake');
        });
    }
}

// Toggle stack edit mode horizontal
function toggleStackEditModeHorizontal(stackId) {
    const stackCard = document.querySelector(`[data-stack-id="${stackId}"]`);
    const editBtn = stackCard.querySelector('.stack-edit-mode-btn-horizontal');
    const editBtnText = editBtn.querySelector('.stack-edit-btn-text-horizontal');
    
    if (stackCard.classList.contains('stack-edit-mode-horizontal')) {
        // Exit edit mode
        stackCard.classList.remove('stack-edit-mode-horizontal');
        editBtn.classList.remove('active');
        editBtnText.textContent = 'Edit';
        
        // Remove shake from cards and hide delete buttons
        stackCard.querySelectorAll('.stack-horizontal-card').forEach(card => {
            card.classList.remove('shake');
            const deleteBtn = card.querySelector('.content-card-delete-btn');
            if (deleteBtn) {
                deleteBtn.style.display = 'none';
            }
        });
    } else {
        // Enter edit mode
        stackCard.classList.add('stack-edit-mode-horizontal');
        editBtn.classList.add('active');
        editBtnText.textContent = 'Done';
        
        // Add shake to cards and show delete buttons
        stackCard.querySelectorAll('.stack-horizontal-card').forEach(card => {
            card.classList.add('shake');
            const deleteBtn = card.querySelector('.content-card-delete-btn');
            if (deleteBtn) {
                deleteBtn.style.display = 'block';
            }
        });
    }
}

// Create horizontal card for stack expansion
function createStackHorizontalCard(insight, stackId) {
    const card = document.createElement('div');
    card.className = 'stack-horizontal-card';
    card.dataset.insightId = insight.id;
    card.dataset.stackId = stackId;
    
    // Add delete button for edit mode (same as normal card)
    const editDeleteBtn = document.createElement('button');
    editDeleteBtn.className = 'content-card-delete-btn';
    editDeleteBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12H19" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    editDeleteBtn.title = 'Remove from Stack';
    editDeleteBtn.style.display = 'none'; // Hidden by default, shown in edit mode
    editDeleteBtn.onclick = (e) => {
        e.stopPropagation();
        removeItemFromStack(stackId, insight.id);
    };
    card.appendChild(editDeleteBtn);
    
    // 卡片图片区域 (same as normal card)
    if (insight.image_url) {
        const imageContainer = document.createElement('div');
        imageContainer.className = 'content-card-image-container';
        
        const image = document.createElement('img');
        image.className = 'content-card-image';
        image.src = insight.image_url;
        image.alt = insight.title || 'Content image';
        image.loading = 'lazy';
        
        // 图片加载错误处理
        image.onerror = function() {
            this.style.display = 'none';
            this.parentElement.classList.add('no-image');
        };
        
        imageContainer.appendChild(image);
        card.appendChild(imageContainer);
    }
    
    // 卡片内容区域 (same as normal card)
    const cardContent = document.createElement('div');
    cardContent.className = 'content-card-content';
    
    // 卡片头部 - Top row with date and source info (same as normal card)
    const cardHeader = document.createElement('div');
    cardHeader.className = 'content-card-header';
    
    // Top row: Date on left, source info on right
    const topRow = document.createElement('div');
    topRow.className = 'content-card-top-row';
    
    const headerDate = document.createElement('div');
    headerDate.className = 'content-card-date';
    headerDate.textContent = new Date(insight.created_at).toLocaleDateString('en-US');
    
    const sourceInfo = document.createElement('div');
    sourceInfo.className = 'content-card-source';
    
    const sourceLogo = document.createElement('div');
    sourceLogo.className = 'content-card-source-logo';
    // You can customize this based on the source
    sourceLogo.innerHTML = '🎵'; // Default music icon, can be replaced with actual logos
    
    const sourceName = document.createElement('span');
    sourceName.className = 'content-card-source-name';
    sourceName.textContent = getSourceName(insight.url);
    
    sourceInfo.appendChild(sourceLogo);
    sourceInfo.appendChild(sourceName);
    
    topRow.appendChild(headerDate);
    topRow.appendChild(sourceInfo);
    
    // Title below the top row (same as normal card)
    const title = document.createElement('div');
    title.className = 'content-card-title';
    
    // Extract clean title (remove source name if it's concatenated)
    let cleanTitle = insight.title || 'Untitled';
    const sourceNameForTitle = getSourceName(insight.url);
    
    // If title contains source name, try to clean it
    if (cleanTitle.includes(sourceNameForTitle)) {
        cleanTitle = cleanTitle.replace(sourceNameForTitle, '').trim();
    }
    
    // For Wikipedia URLs, extract just the article title
    if (insight.url && insight.url.includes('wikipedia.org')) {
        const urlPath = new URL(insight.url).pathname;
        const articleTitle = urlPath.split('/').pop().replace(/_/g, ' ');
        if (articleTitle && articleTitle !== cleanTitle) {
            cleanTitle = articleTitle;
        }
    }
    
    title.textContent = cleanTitle;
    
    cardHeader.appendChild(topRow);
    cardHeader.appendChild(title);
    
    // 卡片描述 (same as normal card)
    const description = document.createElement('div');
    description.className = 'content-card-description';
    description.textContent = insight.description || (insight.url ? `Content from ${new URL(insight.url).hostname}` : 'No description available');
    
    // 卡片底部 (same as normal card)
    const cardFooter = document.createElement('div');
    cardFooter.className = 'content-card-footer';
    
    // Tag based on actual insight tags or default to Project
    const tag = document.createElement('div');
    tag.className = 'content-card-tag-main';
    
    // Use the first tag from insight.tags, or default to "Project"
    let tagText = 'Project'; // Default
    let tagId = null;
    
    if (insight.tags && insight.tags.length > 0) {
        const firstTag = insight.tags[0];
        if (typeof firstTag === 'string') {
            tagText = firstTag;
        } else if (firstTag && typeof firstTag === 'object') {
            tagText = firstTag.name || 'Project';
            tagId = firstTag.id;
        }
    }
    
    tag.textContent = tagText;
    tag.dataset.tagId = tagId || '';
    tag.dataset.insightId = insight.id;
    
    // Make tag clickable to edit tags
    tag.style.cursor = 'pointer';
    tag.onclick = () => openTagEditModal(insight);
    
    cardFooter.appendChild(tag);
    
    // 组装卡片内容 (same as normal card)
    cardContent.appendChild(cardHeader);
    cardContent.appendChild(description);
    cardContent.appendChild(cardFooter);
    
    // 组装完整卡片 (same as normal card)
    card.appendChild(cardContent);
    
    // Setup drag functionality for horizontal cards
    setupStackHorizontalCardDrag(card, insight, stackId);
    
    // 使卡片可点击 (same as normal card)
    makeCardClickable(card, insight);
    
    return card;
}

// Setup drag functionality for horizontal stack cards
function setupStackHorizontalCardDrag(card, insight, stackId) {
    card.addEventListener('mousedown', (e) => {
        const stackCard = document.querySelector(`[data-stack-id="${stackId}"]`);
        
        if (!stackCard?.classList.contains('stack-edit-mode-horizontal')) {
            return;
        }
        
        e.preventDefault();
        startStackCardDrag(card, e, insight, stackId);
    });
}

// Function to open tag edit modal for an insight
async function openTagEditModal(insight) {
    try {
        console.log('🏷️ Opening tag edit modal for insight:', insight.id);
        
        // Get all available tags
        const response = await getCachedUserTags();
        const allTags = response.success ? response.data : [];
        
        // Get current tags for this insight
        const currentTags = insight.tags || [];
        
        console.log('🔍 Current insight tags:', currentTags);
        console.log('🔍 Available tags:', allTags);
        
        // Create modal HTML
        const modal = document.createElement('div');
        modal.className = 'tag-edit-modal';
        modal.innerHTML = `
            <div class="tag-edit-modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">Edit Tag</h2>
                    <button class="modal-close" id="closeTagEditModal">&times;</button>
                </div>
                <div class="modal-body">
                    <p class="modal-description">Select a tag for: <strong>${insight.title || 'Content'}</strong></p>
                    <div class="tag-options">
                        ${allTags.map(tag => {
                            // Check if this tag is currently selected for the insight
                            const isSelected = currentTags.some(ct => {
                                // Handle different tag data structures
                                const currentTagId = ct.id || ct;
                                const currentTagName = ct.name || ct;
                                const availableTagId = tag.id || tag.name;
                                const availableTagName = tag.name;
                                
                                const matches = currentTagId === availableTagId || currentTagName === availableTagName;
                                
                                if (matches) {
                                    console.log('✅ Tag match found:', {
                                        current: { id: currentTagId, name: currentTagName },
                                        available: { id: availableTagId, name: availableTagName }
                                    });
                                }
                                
                                return matches;
                            });
                            
                            console.log(`🏷️ Tag "${tag.name}" selected: ${isSelected}`);
                            
                            return `
                                <label class="tag-option">
                                    <input type="radio" name="selectedTag" value="${tag.id}" 
                                        ${isSelected ? 'checked' : ''}
                                        data-tag-name="${tag.name}">
                                    <span class="tag-option-label" style="background-color: ${tag.color || '#8B5CF6'}">${tag.name}</span>
                                </label>
                            `;
                        }).join('')}
                    </div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="modal-btn modal-btn-secondary" id="cancelTagEdit">Cancel</button>
                    <button type="button" class="modal-btn modal-btn-primary" id="saveTagEdit">Save Tag</button>
                </div>
            </div>
        `;
        
        // Add modal to page
        document.body.appendChild(modal);
        modal.style.display = 'flex';
        
        // Bind events
        document.getElementById('closeTagEditModal').onclick = () => closeTagEditModal(modal);
        document.getElementById('cancelTagEdit').onclick = () => closeTagEditModal(modal);
        document.getElementById('saveTagEdit').onclick = () => saveInsightTags(insight, modal);
        
        // Click outside to close
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeTagEditModal(modal);
            }
        };
        
    } catch (error) {
        console.error('❌ Failed to open tag edit modal:', error);
        showErrorMessage('Failed to load tags for editing');
    }
}

// Function to close tag edit modal
function closeTagEditModal(modal) {
    modal.remove();
}

// Function to save insight tags
async function saveInsightTags(insight, modal) {
    try {
        const radio = modal.querySelector('input[type="radio"]:checked');
        let selectedTags = [];
        
        if (radio) {
            selectedTags = [{
                id: radio.value,
                name: radio.dataset.tagName
            }];
        }
        
        console.log('💾 Saving tag for insight:', insight.id, selectedTags);
        console.log('💾 Current insight data:', insight);
        
        // Prepare the update data - backend expects tag_ids, not tags
        const updateData = {
            ...insight,
            tag_ids: selectedTags.map(tag => tag.id)
        };
        
        console.log('💾 Sending update data to API:', updateData);
        
        // Update insight with new tag (single selection)
        const response = await api.updateInsight(insight.id, updateData);
        
        if (response.success) {
            console.log('✅ Tag updated successfully');
            console.log('🔄 Clearing cache and reloading insights from backend...');
            
            // Clear cache for insights endpoint to ensure fresh data
            if (window.apiCache) {
                window.apiCache.clearPattern('/api/v1/insights');
                console.log('🗑️ Cleared insights cache');
            }
            
            // Reload insights from backend to ensure we have the latest data
            await loadUserInsights();
            
            // Also save to localStorage backup
            saveInsightsToLocalStorage();
            
            // Force re-render to show updated tags
            console.log('🔄 Force re-rendering insights to show updated tags...');
            renderInsights();
            
            closeTagEditModal(modal);
            showSuccessMessage('Tag updated successfully!');
        } else {
            throw new Error(response.message || 'Failed to update tag');
        }
        
    } catch (error) {
        console.error('❌ Failed to save tag:', error);
        
        // Handle specific backend service errors
        if (error.message.includes('update_insight') || error.message.includes('500')) {
            showErrorMessage('Tag update feature is temporarily unavailable. The backend service needs to be updated. Please try again later or contact support.');
        } else {
            showErrorMessage(`Failed to save tag: ${error.message}`);
        }
    }
}

// Function to replace all tags with the four specified ones
async function replaceAllTagsWithDefaults() {
    const defaultTags = [
        { name: 'Project', color: '#8B5CF6' },
        { name: 'Area', color: '#10B981' },
        { name: 'Resource', color: '#3B82F6' },
        { name: 'Archive', color: '#F59E0B' }
    ];

    try {
        console.log('🔄 Starting tag replacement process...');
        
        // First, get all existing tags
        const response = await getCachedUserTags();
        const existingTags = response.success ? response.data : [];
        
        console.log('📋 Found existing tags:', existingTags.length);
        
        // Delete all existing tags
        for (const tag of existingTags) {
            try {
                console.log('🗑️ Deleting tag:', tag.name || tag.id);
                await api.deleteUserTag(tag.id);
            } catch (error) {
                console.warn('⚠️ Failed to delete tag:', tag.name, error.message);
            }
        }
        
        // Create the four new default tags
        for (const tagData of defaultTags) {
            try {
                console.log('➕ Creating tag:', tagData.name);
                await api.createUserTag(tagData);
            } catch (error) {
                console.warn('⚠️ Failed to create tag:', tagData.name, error.message);
            }
        }
        
        // Reload tags and update UI
        console.log('🔄 Reloading tags and updating UI...');
        await loadUserTags();
        await initFilterButtons();
        
        // Verify the tags were created correctly
        const verifyResponse = await api.getUserTags();
        const finalTags = verifyResponse.success ? verifyResponse.data : [];
        console.log('✅ Final tags after replacement:', finalTags.map(t => t.name));
        
        console.log('✅ Tag replacement completed successfully');
        showSuccessMessage('Tags updated successfully! Now using: Project, Area, Resource, Archive');
        
    } catch (error) {
        console.error('❌ Tag replacement failed:', error);
        showErrorMessage(`Failed to replace tags: ${error.message}`);
    }
}


