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

// Stack view state management
let viewMode = 'home'; // 'home' | 'stack'
let activeStackId = null;
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

// Guard flags to prevent autosave from overwriting with empty data
let hasLoadedStacksOnce = false;
let hasLoadedInsightsOnce = false;

// Keep a reference if you're using autosave elsewhere
const saveOnUnload = () => {
  try {
    if (typeof saveStacksToLocalStorage === 'function') saveStacksToLocalStorage();
    if (typeof saveInsightsToLocalStorage === 'function') saveInsightsToLocalStorage();
  } catch (_) {}
};
window.addEventListener('beforeunload', saveOnUnload);

// 🔐 Global auth-expired handler: immediate logout + redirect
window.addEventListener('quest-auth-expired', async (e) => {
  console.warn('🔒 Auth expired; logging out...', e?.detail);
  try {
    // stop autosave if running
    if (window.__QUEST_AUTOSAVE_ID__) {
      clearInterval(window.__QUEST_AUTOSAVE_ID__);
      window.__QUEST_AUTOSAVE_ID__ = null;
    }
    window.removeEventListener('beforeunload', saveOnUnload);
    // clear local session via auth manager
    await auth.logout();
  } catch (_) {}
  // hard redirect to login
  navigateTo(PATHS.LOGIN);
});

// 翻页功能相关变量
let currentPage = 1;
let totalPages = 1;
let totalInsights = 0;
let insightsPerPage = 9; // 每页显示9个insights

// 页面缓存机制
let pageCache = new Map(); // 缓存每个页面的数据
let loadedPages = new Set(); // 记录已加载的页面

// 初始化翻页功能
function initPagination() {
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const paginationPages = document.getElementById('paginationPages');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => goToPage(currentPage - 1));
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => goToPage(currentPage + 1));
    }
    
    updatePaginationUI();
}

// Helper function to count total insights including those in stacks
function getTotalInsightsCount() {
    let insightsInStacks = 0;
    stacks.forEach(stackData => {
        insightsInStacks += stackData.cards.length;
    });
    return totalInsights + insightsInStacks;
}

// 更新翻页UI
function updatePaginationUI() {
    const currentPageEl = document.getElementById('currentPage');
    const totalPagesEl = document.getElementById('totalPages');
    const totalInsightsEl = document.getElementById('totalInsights');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const paginationPages = document.getElementById('paginationPages');
    
    if (currentPageEl) currentPageEl.textContent = currentPage;
    if (totalPagesEl) totalPagesEl.textContent = totalPages;
    if (totalInsightsEl) {
        const s = stacks.size;
        
        // Count insights that are within stacks (these should not be counted separately)
        let insightsInStacks = 0;
        stacks.forEach(stackData => {
            insightsInStacks += stackData.cards.length;
        });
        
        // Calculate actual insights that are not in stacks
        const standaloneInsights = Math.max(0, totalInsights - insightsInStacks);
        const totalCards = standaloneInsights + s; // Each stack counts as one card
        
        totalInsightsEl.textContent = s > 0
            ? `${totalCards} cards (${standaloneInsights} insights + ${s} stack${s > 1 ? 's' : ''})`
            : `${standaloneInsights} insights`;
    }
    
    // 更新按钮状态
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
    }
    
    // 生成页码按钮
    if (paginationPages) {
        paginationPages.innerHTML = '';
        generatePageNumbers(paginationPages);
    }
}

// 生成页码按钮
function generatePageNumbers(container) {
    const maxVisiblePages = 5; // 最多显示5个页码按钮
    
    if (totalPages <= maxVisiblePages) {
        // 如果总页数不多，显示所有页码
        for (let i = 1; i <= totalPages; i++) {
            createPageButton(container, i);
        }
    } else {
        // 如果总页数很多，显示智能分页
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        // 调整起始页，确保显示maxVisiblePages个按钮
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        // 第一页
        if (startPage > 1) {
            createPageButton(container, 1);
            if (startPage > 2) {
                createEllipsis(container);
            }
        }
        
        // 中间页码
        for (let i = startPage; i <= endPage; i++) {
            createPageButton(container, i);
        }
        
        // 最后一页
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                createEllipsis(container);
            }
            createPageButton(container, totalPages);
        }
    }
}

// 创建页码按钮
function createPageButton(container, pageNum) {
    const pageBtn = document.createElement('button');
    pageBtn.className = `pagination-page ${pageNum === currentPage ? 'active' : ''}`;
    pageBtn.textContent = pageNum;
    pageBtn.addEventListener('click', () => goToPage(pageNum));
    container.appendChild(pageBtn);
}

// 创建省略号
function createEllipsis(container) {
    const ellipsis = document.createElement('span');
    ellipsis.className = 'pagination-page ellipsis';
    ellipsis.textContent = '...';
    container.appendChild(ellipsis);
}

// 跳转到指定页面
async function goToPage(pageNum, { force = false } = {}) {
    if (!force && (pageNum < 1 || pageNum > totalPages || pageNum === currentPage)) {
        return;
    }
    
    try {
        currentPage = pageNum;
        insightsPage = pageNum; // 更新全局变量
        
        // 显示加载状态
        showLoadingState();
        
        // If force is true, skip cache and fetch fresh data
        if (force) {
            pageCache.delete(pageNum);
        }
        
        // 检查缓存中是否已有该页面数据
        if (!force && pageCache.has(pageNum)) {
            console.log(`📋 从缓存加载第${pageNum}页数据`);
            const cachedData = pageCache.get(pageNum);
            // Defensive normalization for nested array issue
            const maybeNested = cachedData.insights;
            currentInsights = Array.isArray(maybeNested?.[0]) ? maybeNested[0] : maybeNested;
            window.currentInsights = currentInsights;
            insightsHasMore = cachedData.hasMore;
            
            // 更新已渲染的ID
            renderedInsightIds.clear();
            currentInsights.forEach(i => renderedInsightIds.add(i.id));
        } else {
            // 缓存中没有，调用API加载
            console.log(`🔄 从API加载第${pageNum}页数据...`);
            
            // 使用分页API加载目标页面 (over-fetch on page 1 to account for stacked insights)
            const effectiveLimit = effectiveFetchLimitForPage(pageNum);
            const uid = (auth?.user?.id || currentUser?.id || undefined);
            const targetPageResponse = await api.getInsightsPaginated(pageNum, effectiveLimit, uid, '', true);
            if (targetPageResponse?.success) {
                const { items, hasMore } = normalizePaginatedInsightsResponse(targetPageResponse);
                const targetPageInsights = (items || []).filter(x => !x.stack_id);
                
                // De-dupe page 2+ against what page 1 actually rendered
                let adjusted = targetPageInsights;
                
                // Only de-dupe when not filtering by tag (stacks hidden under filters)
                const hasActiveTagFilter = currentFilters.tags && currentFilters.tags !== 'all';
                if (!hasActiveTagFilter && pageNum > 1) {
                    const prevVisible = getVisibleIdsForPage(pageNum - 1);
                    
                    if (prevVisible.size > 0) {
                        adjusted = adjusted.filter(i => !prevVisible.has(i.id));
                    } else if (pageNum === 2) {
                        // Fallback: if page 1 isn't cached yet, drop the items page 1 over-fetched
                        let stackedInsightsCount = 0;
                        stacks.forEach(s => { stackedInsightsCount += (s.cards?.length || 0); });
                        const borrowed = Math.max(0, stackedInsightsCount - stacks.size); // ht zow many extra we pulled on page 1
                        adjusted = adjusted.slice(borrowed);
                    }
                }
                
                // 更新当前页面数据
                currentInsights = adjusted;
                window.currentInsights = currentInsights;
                insightsHasMore = hasMore;
                
                // 更新已渲染的ID（基于 adjusted）
                renderedInsightIds.clear();
                adjusted.forEach(i => renderedInsightIds.add(i.id));
                
                // 缓存该页面数据（保存 adjusted，而不是原始）
                pageCache.set(pageNum, {
                    insights: adjusted,        // ❗ was [...adjusted]
                    hasMore,
                    timestamp: Date.now()
                });
                loadedPages.add(pageNum);
                
                console.log(`📄 第${pageNum}页加载完成并缓存: ${adjusted.length}个insights (原始: ${targetPageInsights.length})`);
            } else {
                throw new Error(`Failed to load page ${pageNum}`);
            }
        }
        
        // 重新渲染insights（只显示当前页面的数据）
        renderInsights();
        
        // 更新UI
        updatePaginationUI();
        
        // 滚动到顶部
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        console.error('❌ Failed to go to page:', error);
        showErrorMessage('Failed to load page. Please try again.');
    } finally {
        hideLoadingState();
    }
}

// 更新分页信息
function updatePaginationInfo(data) {
    const pagination = data.pagination || {};
    totalPages = pagination.total_pages || 1;
    totalInsights = pagination.total || 0;
    currentPage = pagination.page || 1;
}

// 显示加载状态
function showLoadingState() {
    const container = document.getElementById('contentCards');
    if (!container) return;
    // don't clear existing content; add an overlay instead
    let overlay = document.getElementById('loadingSkeleton');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loadingSkeleton';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="skeleton-grid">
                <div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>
                <div class="skeleton-card"></div><div class="skeleton-card"></div><div class="skeleton-card"></div>
            </div>`;
        container.appendChild(overlay);
    }
}

// 隐藏加载状态
function hideLoadingState() {
    const overlay = document.getElementById('loadingSkeleton');
    if (overlay) overlay.remove();
}

// 清除页面缓存
function clearPageCache() {
    pageCache.clear();
    loadedPages.clear();
    console.log('🗑️ 页面缓存已清除');
}

// 获取缓存状态信息
function getCacheStatus() {
    return {
        cachedPages: Array.from(loadedPages),
        cacheSize: pageCache.size,
        totalPages: totalPages
    };
}

// 修改loadUserInsights函数以支持翻页
async function loadUserInsightsWithPagination() {
    try {
        insightsLoading = true;
        showLoadingState();
        
        // 清除之前的缓存
        clearPageCache();
        
        // 第一步：快速加载第一页
        console.log('🚀 开始请求第一页数据...');
        const startTime = Date.now();
        const effectiveLimit = effectiveFetchLimitForPage(1);
        const uid = (auth?.user?.id || currentUser?.id || undefined);
        const firstPageResponse = await api.getInsightsPaginated(1, effectiveLimit, uid, '', true);
        const endTime = Date.now();
        console.log(`⏱️ 第一页API请求耗时: ${endTime - startTime}ms`);
        
        if (firstPageResponse?.success) {
            const { items, hasMore } = normalizePaginatedInsightsResponse(firstPageResponse);
            let firstPageInsights = (items || []).filter(x => !x.stack_id);
            
            // Retry once if page 1 returns 0 items and we now have a user ID
            if (firstPageInsights.length === 0 && uid) {
                console.log('🔄 Page 1 returned 0 items, retrying with user ID...');
                // Clear any stale cached responses before retrying
                if (window.apiCache) {
                    window.apiCache.clearPattern('/api/v1/insights');
                }
                
                const retryResponse = await api.getInsightsPaginated(1, effectiveLimit, uid, '', true);
                if (retryResponse?.success) {
                    const { items: retryItems, hasMore: retryHasMore } = normalizePaginatedInsightsResponse(retryResponse);
                    firstPageInsights = (retryItems || []).filter(x => !x.stack_id);
                    console.log(`🔄 Retry returned ${firstPageInsights.length} insights`);
                }
            }
            
            // 先设置第一页数据
            currentInsights = firstPageInsights;
            window.currentInsights = currentInsights;
            insightsPage = 1;
            insightsHasMore = hasMore;
            renderedInsightIds.clear();
            firstPageInsights.forEach(i => renderedInsightIds.add(i.id));
            if (currentInsights.length > 0) hasLoadedInsightsOnce = true;
            
            // 缓存第一页数据 (store only what we actually display)
            const displayedInsights = firstPageInsights.slice(0, effectiveLimitForPage(1));
            pageCache.set(1, {
                insights: displayedInsights,  // ✅ Store only what we display
                hasMore: hasMore,
                timestamp: Date.now()
            });
            loadedPages.add(1);
            
            // 从API响应中获取分页信息
            updatePaginationInfo(firstPageResponse.data);
            
            // 标准化标签结构
            currentInsights.forEach(insight => {
                if (insight.tags && insight.tags.length > 0) {
                    insight.tags = insight.tags.map(tag => ({
                        id: tag.tag_id || tag.id,
                        name: tag.name,
                        color: tag.color
                    }));
                }
            });
            
            // 立即渲染第一页（不等待标签加载）
            renderInsights();
            updatePaginationUI();
            
            // 异步加载标签，不阻塞渲染
            setTimeout(async () => {
                const insightsWithoutTags = currentInsights.filter(insight => !insight.tags || insight.tags.length === 0);
                if (insightsWithoutTags.length > 0) {
                    try {
                        await loadTagsForInsights(insightsWithoutTags);
                        // 标签加载完成后重新渲染
                        renderInsights();
                    } catch (error) {
                        console.warn('⚠️ 标签加载失败:', error);
                    }
                }
            }, 10);
            
            console.log(`✅ 第一页加载完成: ${firstPageInsights.length}个insights, 总页数: ${totalPages}`);
            console.log(`📋 缓存状态: 已缓存页面 ${Array.from(loadedPages).join(', ')}`);
        } else {
            // 尝试从localStorage加载备份
            loadFromBackup();
        }
    } catch (error) {
        console.error('❌ 加载用户insights失败:', error);
        loadFromBackup();
    } finally {
        insightsLoading = false;
        hideLoadingState();
    }
}

// loadAllInsightsInBackground function removed - using pagination only

// loadRemainingInsightsInBackground function removed - using pagination only

// 从备份加载数据
function loadFromBackup() {
    const backupInsights = localStorage.getItem('quest_insights_backup');
    let restoredFromBackup = false;
    
    if (backupInsights) {
        try {
            const backup = JSON.parse(backupInsights);
            if (Array.isArray(backup.data)) {
                currentInsights = backup.data;
                window.currentInsights = currentInsights;
                if (currentInsights.length > 0) {
                    hasLoadedInsightsOnce = true;
                    restoredFromBackup = true;
                    console.log('✅ Restored insights from backup:', currentInsights.length, 'insights');
                }
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
        console.log('⚠️ No backup insights found in localStorage');
    }
    
    // 设置默认分页信息 (insights only)
    totalPages = Math.max(1, Math.ceil(currentInsights.length / insightsPerPage));
    totalInsights = currentInsights.length;
    currentPage = 1;
    
    renderInsights();
    updatePaginationUI();
    
    // Notify user if data was restored from backup
    if (restoredFromBackup) {
        showSuccessMessage(`Restored ${currentInsights.length} insights from local backup. Your data is safe!`);
    }
}

// Check data recovery status on page load
function checkDataRecoveryStatus() {
    const hasBackupInsights = localStorage.getItem('quest_insights_backup');
    const hasBackupStacks = localStorage.getItem('quest_stacks');
    
    if (hasBackupInsights || hasBackupStacks) {
        console.log('📊 Data recovery status:');
        console.log('  - Insights backup:', hasBackupInsights ? 'Available' : 'Not found');
        console.log('  - Stacks backup:', hasBackupStacks ? 'Available' : 'Not found');
        
        // Show user that data recovery is available
        if (hasBackupInsights) {
            try {
                const backup = JSON.parse(hasBackupInsights);
                if (backup.data && backup.data.length > 0) {
                    console.log(`  - Backup contains ${backup.data.length} insights`);
                }
            } catch (e) {
                console.warn('  - Backup data corrupted');
            }
        }
    } else {
        console.log('📊 No backup data found - fresh start');
    }
}

// 在页面加载时立即开始API预热
(async function warmupAPI() {
    console.log('🔥 开始预热API服务器...');
    checkDataRecoveryStatus(); // Check data recovery status
    
    const warmupStart = Date.now();
    try {
        await fetch(`${API_CONFIG.API_BASE_URL}/health`, { 
            method: 'GET',
            mode: 'cors'
        });
        const warmupEnd = Date.now();
        console.log(`🔥 API服务器预热完成: ${warmupEnd - warmupStart}ms`);
    } catch (error) {
        console.log('⚠️ API服务器预热失败:', error.message);
    }
})();

// 在页面初始化时调用翻页初始化
document.addEventListener('DOMContentLoaded', function() {
    // 其他初始化代码...
    initPagination();
});

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
        
        // API服务器已在页面加载时预热
        
        // 优先加载核心数据，包括stacks
        const [profileResult, insightsResult, tagsResult, stacksResult] = await Promise.allSettled([
            loadUserProfile(),
            loadUserInsightsWithPagination(),
            loadUserTags(),
            loadUserStacks()
        ]);
        
        // 如果stacks加载失败，尝试从localStorage直接恢复
        if (stacksResult.status === 'rejected') {
            console.error('❌ 加载stacks失败:', stacksResult.reason);
            const savedStacks = localStorage.getItem('quest_stacks');
            if (savedStacks) {
                try {
                    const entries = JSON.parse(savedStacks);
                    console.log('🔄 从localStorage直接恢复stacks:', entries.length, 'entries');
                    entries.forEach(([id, data]) => {
                        const stringId = String(id);
                        data.id = stringId;
                        stacks.set(stringId, data);
                    });
                    if (stacks.size > 0) {
                        hasLoadedStacksOnce = true;
                        console.log('✅ 成功从localStorage恢复', stacks.size, '个stacks');
                    }
                } catch (e) {
                    console.error('❌ 解析localStorage stacks失败:', e);
                }
            }
        }
        
        // 检查每个加载结果并记录错误
        if (profileResult.status === 'rejected') {
            console.error('❌ 用户资料加载失败:', profileResult.reason);
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
        
        // Set up authentication listener to reload stacks when user logs in
        setupAuthListener();
        
        // Handle deep linking for stack views
        const { viewMode: initialViewMode, stackId } = parseRoute();
        if (initialViewMode === 'stack' && stackId) {
            // Navigate to stack view
            renderStackView(stackId);
        } else {
            // Final render after all data is loaded
            renderInsights();
        }
        
        // 分页模式：不需要无限滚动
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
            console.log('🔍 Loading stacks from localStorage (unauthenticated):', saved ? 'found' : 'not found');
            if (saved) {
                try {
                    const entries = JSON.parse(saved);
                    console.log('📦 Parsed stack entries:', entries.length);
                    // Don't clear stacks immediately - preserve existing data
                    // stacks.clear();
                    entries.forEach(([id, data]) => {
                        const stringId = String(id); // Ensure string format
                        data.id = stringId; // Ensure ID is string
                        stacks.set(stringId, data);
                    });
                    if (stacks.size > 0) hasLoadedStacksOnce = true;
                    console.log('✅ Loaded', stacks.size, 'stacks from localStorage');
                } catch (e) {
                    console.error('❌ 解析本地 stacks 失败:', e);
                }
            }
            
            // Mark stacks as loaded regardless of whether any were found
            hasLoadedStacksOnce = true;
            console.log('✅ Stacks loading process completed (unauthenticated). Found', stacks.size, 'stacks');
            
            // 在未认证时不要继续调用后端
            return;
        }
        
        // 只加载当前页面的数据来构建stacks，避免加载额外数据
        let allInsights = [];
        const effectiveLimit = effectiveFetchLimitForPage(1);
        const uid = (auth?.user?.id || currentUser?.id || undefined);
        
        // Load stacks directly from the stack API
        console.log('🔍 Loading stacks from API...');
        const stacksResponse = await api.getUserStacks(uid);
        console.log('📡 Stacks API response:', stacksResponse);
        
        // Process stacks from API response
        if (stacksResponse && stacksResponse.success && stacksResponse.data) {
            console.log('📦 Processing stacks from API:', stacksResponse.data.length, 'stacks');
            stacksResponse.data.forEach(stack => {
                const stackData = {
                    id: String(stack.id),
                    name: stack.name || 'Stack',
                    cards: [], // Will be populated from insights
                    createdAt: stack.created_at || new Date().toISOString(),
                    modifiedAt: stack.updated_at || new Date().toISOString(),
                    isExpanded: false
                };
                stacks.set(String(stack.id), stackData);
            });
            console.log('✅ Loaded', stacks.size, 'stacks from API');
        } else {
            console.log('⚠️ No stacks found in API response or API failed');
        }
        const response = await api.getInsightsPaginated(1, effectiveLimit, uid, '', true);
        
        if (response.success && response.data) {
            const { items } = normalizePaginatedInsightsResponse(response);
            if (items && items.length > 0) {
                allInsights = items;
            }
        }
                
                // Debug: Check insights for stack_id
                console.log('🔍 Debug: Checking insights for stack_id...');
                allInsights.forEach((insight, index) => {
                    console.log(`  Insight ${index}:`, {
                        id: insight.id,
                        stack_id: insight.stack_id,
                        hasStackId: !!insight.stack_id,
                        allKeys: Object.keys(insight),
                        fullInsight: insight
                    });
                });
                
                // Populate existing stacks with insights that have matching stack_id
                allInsights.forEach(insight => {
                    if (insight.stack_id) {
                        const stackId = String(insight.stack_id);
                        if (stacks.has(stackId)) {
                            const stack = stacks.get(stackId);
                            stack.cards.push(insight);
                            console.log(`📦 Added insight ${insight.id} to stack ${stackId}`);
                        } else {
                            console.warn(`⚠️ Insight ${insight.id} has stack_id ${stackId} but stack not found`);
                        }
                    }
                });
                
                console.log('🔍 Debug: Stacks populated with insights. Total stacks:', stacks.size);
                
                // Always try to load metadata from localStorage to preserve user preferences
                const savedStacks = localStorage.getItem('quest_stacks');
                console.log('🔍 Loading stacks from localStorage (authenticated):', savedStacks ? 'found' : 'not found');
                
                // Debug: Check all localStorage keys that might contain stack data
                console.log('🔍 Debug: All localStorage keys:', Object.keys(localStorage).filter(key => key.includes('stack') || key.includes('quest')));
                console.log('🔍 Debug: quest_stacks value:', localStorage.getItem('quest_stacks'));
                console.log('🔍 Debug: quest_insights_backup value length:', localStorage.getItem('quest_insights_backup')?.length || 0);
                
                // Debug: Check all localStorage keys to see if stacks are stored elsewhere
                console.log('🔍 Debug: All localStorage keys:', Object.keys(localStorage));
                Object.keys(localStorage).forEach(key => {
                    if (key.includes('stack') || key.includes('quest')) {
                        console.log(`🔍 Debug: ${key}:`, localStorage.getItem(key));
                    }
                });
                if (savedStacks) {
                    try {
                        const stackEntries = JSON.parse(savedStacks);
                        console.log('📦 Parsed stack entries from localStorage:', stackEntries.length);
                        console.log('🔍 Debug: Raw localStorage data:', savedStacks);
                        console.log('🔍 Debug: Parsed stack entries:', stackEntries);
                        stackEntries.forEach(([stackId, stackData]) => {
                            const stringStackId = String(stackId); // Ensure string format
                            if (stacks.has(stringStackId)) {
                                // Merge metadata from localStorage with database data
                                const existingStack = stacks.get(stringStackId);
                                if (existingStack && stackData.name) {
                                    existingStack.name = stackData.name;
                                    existingStack.isExpanded = stackData.isExpanded || false;
                                }
                            } else {
                                // Load stack from localStorage if not found in database
                                stackData.id = stringStackId; // Ensure ID is string
                                stacks.set(stringStackId, stackData);
                            }
                        });
                        
                        // If no stacks were loaded from database but we have localStorage data, use it
                        if (stacks.size === 0 && stackEntries.length > 0) {
                            console.log('🔄 No database stacks found, using localStorage stacks');
                        }
                    } catch (error) {
                        console.error('❌ Failed to parse saved stacks:', error);
                    }
                }
                
                // 更新stackIdCounter
                if (stacks.size > 0) {
                    const maxTimestamp = Math.max(...Array.from(stacks.keys()).map(id => {
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
        } catch (error) {
            console.error('❌ 加载用户stacks失败:', error);
            // 如果stacks端点不存在，继续使用本地存储
            if (error.message.includes('404') || error.message.includes('Not Found')) {
                console.log('⚠️ Stacks API端点尚未实现，使用本地存储模式');
            }
            
            // 如果认证失败，尝试从localStorage恢复stacks数据
            if (error.message.includes('401') || error.message.includes('403') || error.message.includes('认证')) {
                console.log('🔍 认证失败，尝试从localStorage恢复stacks数据...');
                const savedStacks = localStorage.getItem('quest_stacks');
                if (savedStacks) {
                    try {
                        const entries = JSON.parse(savedStacks);
                        console.log('📦 从localStorage恢复stacks:', entries.length, 'entries');
                        entries.forEach(([id, data]) => {
                            const stringId = String(id);
                            data.id = stringId;
                            stacks.set(stringId, data);
                        });
                        if (stacks.size > 0) hasLoadedStacksOnce = true;
                        console.log('✅ 成功从localStorage恢复', stacks.size, '个stacks');
                    } catch (e) {
                        console.error('❌ 解析localStorage stacks失败:', e);
                    }
                }
            }
            // 不抛出错误，允许页面继续加载
        }
        
        // Mark stacks as loaded regardless of whether any were found
        hasLoadedStacksOnce = true;
        console.log('✅ Stacks loading process completed. Found', stacks.size, 'stacks');
        
        // After stacks are known, refill page 1 with correct over-fetch
        if (stacks.size > 0) {
            await goToPage(1, { force: true });
        }
}

// Set up authentication listener to reload stacks when user logs in
function setupAuthListener() {
    // Listen for authentication state changes
    auth.addListener((authState) => {
        console.log('🔔 Auth state changed:', {
            isAuthenticated: authState.isAuthenticated,
            hasUser: !!authState.user
        });
        
        // If user just logged in, reload stacks
        if (authState.isAuthenticated && authState.user) {
            console.log('🔄 User logged in, reloading stacks...');
            loadUserStacks().catch(error => {
                console.error('❌ Failed to reload stacks after login:', error);
            });
        }
    });
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
        const effectiveLimit = effectiveFetchLimitForPage(1);
        const uid = (auth?.user?.id || currentUser?.id || undefined);
        const response = await api.getInsightsPaginated(1, effectiveLimit, uid, '', true);
        
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
            
            renderInsightsInitial();      // 只渲染当前页面的数据
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
    } finally {
        insightsLoading = false;
    }
}

// Helper to get visible IDs of a page (for de-duplication)
function getVisibleIdsForPage(pageNum) {
    const cached = pageCache.get(pageNum);
    if (!cached) return new Set();

    // defensive: normalize cache shape
    const raw = cached.insights;
    const arr = Array.isArray(raw?.[0]) ? raw[0] : raw;

    // Cache now stores exactly what was displayed, so no need to slice
    const visible = arr || [];
    return new Set(visible.map(i => i.id));
}

// Helper function to calculate effective limit for a page
function effectiveLimitForPage(pageNum) {
    // If we have an active tag filter, don't account for stacks since they're hidden
    const hasActiveTagFilter = currentFilters.tags && currentFilters.tags !== 'all';
    
    if (hasActiveTagFilter) {
        return insightsPerPage; // Full page for insights when filtering
    }
    
    // Each stack counts as one card, so we show fewer insights on page 1 to make room for stacks
    const s = stacks.size;
    return pageNum === 1 ? Math.max(0, insightsPerPage - s) : insightsPerPage;
}

// How many insights we FETCH from the API for a given page
// (Over-fetch on page 1 to refill after excluding stacked insights)
function effectiveFetchLimitForPage(pageNum) {
    const hasActiveTagFilter = currentFilters.tags && currentFilters.tags !== 'all';
    if (hasActiveTagFilter) return insightsPerPage;  // no stacks when filtering
    if (pageNum !== 1) return insightsPerPage;       // stacks shown only on page 1

    const stacksCount = stacks.size;
    // how many insights live inside stacks
    let stackedInsightsCount = 0;
    stacks.forEach(s => { stackedInsightsCount += (s.cards?.length || 0); });

    // we need to SHOW (insightsPerPage - stacksCount) non-stacked insights,
    // but API results may include stacked ones (we remove them with !x.stack_id),
    // so over-fetch by stackedInsightsCount.
    const targetInsightsTiles = Math.max(0, insightsPerPage - stacksCount);
    return targetInsightsTiles + stackedInsightsCount;
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
    const existingCards = contentCards.querySelectorAll('.content-card:not(.template-card), .empty-state');
    existingCards.forEach(card => card.remove());
    
    // Get filtered insights for rendering
    const filteredInsights = getFilteredInsights();
    console.log('🎯 Rendering with filtered insights:', filteredInsights.length);
    console.log('🎯 Stacks count:', stacks.size);
    console.log('🎯 Effective limit for page', currentPage, ':', effectiveLimitForPage(currentPage));
    
    // Check if we have any content to render (insights OR stacks)
    const hasInsights = filteredInsights.length > 0;
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
    
    const fragment = document.createDocumentFragment();
    
    // Page 1: render stacks first (each stack is ONE tile)
    // Only show stacks if no specific tag filter is active
    const hasActiveTagFilter = currentFilters.tags && currentFilters.tags !== 'all';
    if (currentPage === 1 && hasStacks && !hasActiveTagFilter) {
        for (const [, stackData] of stacks) {
            fragment.appendChild(createStackCard(stackData));
        }
    }
    
    // Then render insights (using filtered insights)
    if (hasInsights) {
        if (hasActiveTagFilter) {
            // When filtering, paginate through filtered results
            const startIndex = (currentPage - 1) * insightsPerPage;
            const endIndex = startIndex + insightsPerPage;
            const list = filteredInsights.slice(startIndex, endIndex);
            for (const insight of list) {
                fragment.appendChild(createInsightCard(insight));
            }
        } else {
            // When not filtering, use normal pagination with stack accounting
            const limit = effectiveLimitForPage(currentPage);
            // Only slice for page 1 (to account for stacks), other pages use full array
            const list = currentPage === 1 ? filteredInsights.slice(0, limit) : filteredInsights;
            for (const insight of list) {
                fragment.appendChild(createInsightCard(insight));
            }
        }
    }
    
    contentCards.appendChild(fragment);
    
    // Re-setup event delegation for the newly rendered cards
    setupCardEventDelegation();
    
    const insightsCount = hasActiveTagFilter ? 
        Math.min(insightsPerPage, Math.max(0, filteredInsights.length - (currentPage - 1) * insightsPerPage)) :
        Math.min(filteredInsights.length, effectiveLimitForPage(currentPage));
    const stacksCount = currentPage === 1 && !hasActiveTagFilter ? stacks.size : 0;
    const totalCards = insightsCount + stacksCount;
    console.log(`📊 渲染第${currentPage}页: ${insightsCount}个insights + ${stacksCount}个stacks = ${totalCards}个卡片总计`);
    
    // Update edit mode state after rendering cards
    updateEditModeState();
}

// Create insight card element (using original structure)
function createInsightCardEl(insight) {
    // Use the original createInsightCard function
    return createInsightCard(insight);
}

function renderInsightsInitial() {
    // Use the main renderInsights function to avoid duplication
    renderInsights();
}

// appendInsightsBatch function removed - using pagination only

// ensureInsightsSentinel function removed - using pagination only

// elementScrolls function removed - using pagination only

// setupInsightsInfiniteScroll function removed - using pagination only

// maybePrefetchIfShort function removed - using pagination only

// loadMoreInsights function removed - using pagination only

function resetInsightsPaginationAndRerender() {
    console.log('🔄 resetInsightsPaginationAndRerender called');
    
    // Clear page cache when filtering to avoid stale data
    clearPageCache();
    
    // Get filtered insights
    const filteredInsights = getFilteredInsights();
    console.log('📊 Filtered insights for rendering:', filteredInsights.length);
    
    // Update pagination with filtered insights count (insights only)
    totalInsights = filteredInsights.length;
    totalPages = Math.max(1, Math.ceil(totalInsights / insightsPerPage));
    currentPage = 1; // Reset to first page when filtering
    
    // DON'T overwrite currentInsights - keep original data for future filtering
    // The renderInsights function will call getFilteredInsights() to get the right data
    
    // Clear rendered IDs and update with filtered insights
    renderedInsightIds.clear();
    filteredInsights.forEach(i => renderedInsightIds.add(i.id));
    
    // Re-render with proper pagination
    renderInsightsInitial();
    
    // Update pagination UI
    updatePaginationUI();
}

// forceLoadMore function removed - using pagination only





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
    console.log('🔨 Creating insight card for:', insight.title, 'ID:', insight.id);
    
    const card = document.createElement('div');
    card.className = 'content-card';
    card.dataset.insightId = insight.id;
    
    console.log('🔨 Card element created with classes:', card.className, 'and dataset:', card.dataset);
    
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
    
    // Extract clean title
    let cleanTitle = insight.title || 'Untitled';
    
    // For Wikipedia URLs, extract just the article title from URL
    if (insight.url.includes('wikipedia.org')) {
        try {
            const urlPath = new URL(insight.url).pathname;
            const articleTitle = urlPath.split('/').pop().replace(/_/g, ' ');
            if (articleTitle && articleTitle !== 'Main_Page') {
                cleanTitle = articleTitle;
            }
        } catch (e) {
            // If URL parsing fails, keep original title
        }
    } else {
        // For other sources, remove source name if it's at the beginning
        const sourceNameForTitle = getSourceName(insight.url);
        if (cleanTitle.startsWith(sourceNameForTitle)) {
            cleanTitle = cleanTitle.substring(sourceNameForTitle.length).trim();
            // Remove leading comma and space if present
            if (cleanTitle.startsWith(',')) {
                cleanTitle = cleanTitle.substring(1).trim();
            }
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
    
    // Use the first tag from insight.tags, or default to "Archive"
    let tagText = 'Archive'; // Default
    let tagId = null;
    
    if (insight.tags && insight.tags.length > 0) {
        const firstTag = insight.tags[0];
        if (typeof firstTag === 'string') {
            tagText = firstTag;
        } else if (firstTag && typeof firstTag === 'object') {
            tagText = firstTag.name || 'Archive';
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
    
    console.log('✅ Insight card created successfully:', {
        title: insight.title,
        id: insight.id,
        classes: card.className,
        dataset: card.dataset
    });
    
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
    if (!filterButtons) {
        console.error('❌ Filter buttons container not found');
        return;
    }
    
    try {
        console.log('🔧 Initializing filter buttons...');
        
        // 获取用户标签
        const response = await getCachedUserTags();
        const userTags = response.success ? response.data : [];
        
        console.log('📋 User tags loaded:', userTags);
        
        // 清空现有按钮
        filterButtons.innerHTML = '';
        
        // 创建两个主要筛选按钮
        const mainFilterButtons = [
            {
                key: 'latest',
                label: 'Last Added',
                type: 'dropdown',
                options: [
                    { key: 'latest', label: 'Latest' },
                    { key: 'oldest', label: 'Oldest' },
                    { key: 'alphabetical', label: 'Alphabetical' }
                ]
            },
            {
                key: 'tags',
                label: 'Tags',
                type: 'dropdown',
                options: [
                    { key: 'all', label: 'All Tags' },
                    { key: 'project', label: 'Project', category: 'P' },
                    { key: 'area', label: 'Area', category: 'A' },
                    { key: 'resource', label: 'Resource', category: 'R' },
                    { key: 'archive', label: 'Archive', category: 'Archive' }
                ]
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
        console.log('🎯 Creating filter buttons:', mainFilterButtons);
        
        mainFilterButtons.forEach(filterConfig => {
            console.log('🔧 Creating filter button for:', filterConfig.key);
            
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
                
                // 如果是标签按钮，创建PARA系统选项
                if (filterConfig.key === 'tags') {
                    console.log('🏷️ Creating PARA tag options:', filterConfig.options);
                    
                    dropdownOptions.innerHTML = filterConfig.options.map(option => {
                        if (option.key === 'all') {
                            return `<div class="filter-option" data-filter="${option.key}">
                                <span class="filter-option-label">${option.label}</span>
                            </div>`;
                        } else {
                            // PARA categories with info icon
                            return `<div class="filter-option" data-filter="${option.key}">
                                <span class="filter-option-label">${option.label}</span>
                                <span class="filter-option-info" data-category="${option.category}" title="Click for more info">ⓘ</span>
                            </div>`;
                        }
                    }).join('');
                    
                    console.log('✅ PARA tag options created');
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
                    console.log('🖱️ Filter option clicked:', e.target);
                    
                    const option = e.target.closest('.filter-option');
                    if (option) {
                        const filterKey = option.dataset.filter;
                        const filterType = filterConfig.key; // latest, tags
                        const optionLabel = option.querySelector('.filter-option-label').textContent;
                        
                        console.log('🎯 Setting filter:', { filterType, filterKey, optionLabel });
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
                
                // 添加PARA工具提示功能
                if (filterConfig.key === 'tags') {
                    console.log('💡 Setting up PARA tooltips');
                    setupPARATooltips(dropdownOptions);
                }
                
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
        
        console.log('✅ Filter buttons created successfully');
        console.log('🎯 Total filter button containers:', filterButtons.children.length);
        
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

// Fetch all insights for filtering (when tag filter is active)
async function fetchAllInsightsForFiltering() {
    try {
        console.log('🔄 Fetching all insights for tag filtering...');
        
        // Fetch all insights with tags included
        const response = await api.getInsightsPaginated(1, 1000, null, '', true); // Large limit to get all
        
        if (response?.success) {
            const { items } = normalizePaginatedInsightsResponse(response);
            let allInsights = (items || []).filter(x => !x.stack_id); // Exclude stacked items
            
            // Ensure tags are normalized for all insights
            const insightsWithoutTags = allInsights.filter(insight => !insight.tags || insight.tags.length === 0);
            if (insightsWithoutTags.length > 0) {
                console.log('🔄 Loading tags for insights without them...');
                await loadTagsForInsights(insightsWithoutTags);
            }
            
            // Store globally for filtering
            window.allInsightsForFiltering = allInsights;
            console.log('✅ Fetched all insights for filtering:', allInsights.length);
            
            return allInsights;
        }
        
        return [];
    } catch (error) {
        console.error('❌ Failed to fetch all insights for filtering:', error);
        return [];
    }
}

// 设置筛选条件
async function setFilter(filterType, filterValue, optionLabel = null) {
    console.log('🔧 setFilter called:', { filterType, filterValue, optionLabel });
    
    // 更新对应的筛选条件
    currentFilters[filterType] = filterValue;
    console.log('📊 Current filters updated:', currentFilters);
    
    // Handle tag filter changes
    if (filterType === 'tags') {
        if (filterValue !== 'all') {
            // Clear any existing global insights to ensure fresh data
            window.allInsightsForFiltering = null;
            // Fetch all insights for the new filter
            await fetchAllInsightsForFiltering();
        } else {
            // Clear the global insights when showing all
            window.allInsightsForFiltering = null;
            // Reload the original page data for normal pagination
            await loadUserInsightsWithPagination();
        }
    }
    
    // 更新按钮显示文本
    updateFilterButtonDisplay(filterType, filterValue, optionLabel);
    
    // 更新按钮状态
    updateFilterButtonStates();
    
    // 显示筛选状态
    showFilterStatus();
    
    // 重新渲染
    console.log('🔄 Re-rendering insights with new filter...');
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
    } else if (filterType === 'tags' && ['project', 'area', 'resource', 'archive'].includes(filterValue)) {
        // PARA categories
        const paraCategoryNames = {
            'project': 'Project',
            'area': 'Area',
            'resource': 'Resource', 
            'archive': 'Archive'
        };
        button.textContent = paraCategoryNames[filterValue];
    } else if (filterType === 'tags' && filterValue === 'all') {
        button.textContent = 'Tags';
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
        } else if (['project', 'area', 'resource', 'archive'].includes(currentFilters.tags)) {
            // Handle PARA categories
            const paraCategoryNames = {
                'project': 'Project',
                'area': 'Area', 
                'resource': 'Resource',
                'archive': 'Archive'
            };
            statusParts.push(`标签: ${paraCategoryNames[currentFilters.tags]}`);
        }
    } else if (currentFilters.tags === 'all') {
        statusParts.push('所有标签');
    }
    

    
    const statusText = statusParts.length > 0 ? statusParts.join(' | ') : '显示所有内容';
    
    // 可以在这里添加UI显示筛选状态
    // 比如在页面顶部显示一个小提示
}

// 获取当前筛选的文章
function getFilteredInsights() {
    console.log('🔍 getFilteredInsights called with filters:', currentFilters);
    console.log('📊 Total insights:', currentInsights.length);
    
    // Debug: Log first few insights to see their tag structure
    if (currentInsights.length > 0) {
        console.log('🔍 Sample insight tags:', currentInsights.slice(0, 2).map(insight => ({
            id: insight.id,
            title: insight.title,
            tags: insight.tags
        })));
    }
    
    // If we have an active tag filter, we need to work with all insights, not just current page
    const hasActiveTagFilter = currentFilters.tags && currentFilters.tags !== 'all';
    let insightsToFilter = currentInsights;
    
    if (hasActiveTagFilter && window.allInsightsForFiltering) {
        // Use all insights for filtering when tag filter is active
        insightsToFilter = window.allInsightsForFiltering;
        console.log('🔍 Using all insights for tag filtering:', insightsToFilter.length);
    }
    
    let filteredInsights = [...insightsToFilter];
    
    // Filter out cards that are already in stacks
    const cardsInStacks = new Set();
    stacks.forEach(stackData => {
        stackData.cards.forEach(card => {
            cardsInStacks.add(card.id);
        });
    });
    
    filteredInsights = filteredInsights.filter(insight => !cardsInStacks.has(insight.id));
    console.log('📋 Insights after removing stacked cards:', filteredInsights.length);
    
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
        console.log('🏷️ Applying tag filter:', currentFilters.tags);
        
        if (currentFilters.tags.startsWith('tag_')) {
            // Handle custom user tags
            const tagId = currentFilters.tags.replace('tag_', '');
            console.log('🔍 Filtering by custom tag ID:', tagId);
            
            filteredInsights = filteredInsights.filter(insight => {
                if (insight.tags && insight.tags.length > 0) {
                    const hasTag = insight.tags.some(tag => {
                        let tagIdToCheck = null;
                        
                        if (typeof tag === 'string') {
                            tagIdToCheck = tag;
                        } else if (tag && typeof tag === 'object') {
                            tagIdToCheck = tag.id || tag.tag_id || tag.user_tag_id;
                        }
                        
                        return String(tagIdToCheck) === String(tagId);
                    });
                    return hasTag;
                }
                return false;
            });
        } else if (['project', 'area', 'resource', 'archive'].includes(currentFilters.tags)) {
            // Handle PARA categories
            const paraCategory = currentFilters.tags;
            console.log('🔍 Filtering by PARA category:', paraCategory);
            
            filteredInsights = filteredInsights.filter(insight => {
                console.log('🔍 Filtering insight:', insight.id, 'with tags:', insight.tags);
                
                if (insight.tags && insight.tags.length > 0) {
                    const hasMatchingTag = insight.tags.some(tag => {
                        let tagName = '';
                        
                        if (typeof tag === 'string') {
                            tagName = tag.toLowerCase();
                        } else if (tag && typeof tag === 'object') {
                            tagName = (tag.name || '').toLowerCase();
                        }
                        
                        console.log('🔍 Checking tag:', tagName, 'against category:', paraCategory);
                        const matches = tagName === paraCategory;
                        console.log('🔍 Tag match result:', matches);
                        return matches;
                    });
                    
                    console.log('🔍 Insight has matching tag:', hasMatchingTag);
                    return hasMatchingTag;
                }
                
                // Special case: Archive filter should include items with no tags
                if (paraCategory === 'archive') {
                    console.log('🔍 Insight has no tags, including in Archive filter');
                    return true;
                }
                
                console.log('🔍 Insight has no tags, excluding');
                return false;
            });
        }
        
        console.log('📋 Insights after tag filtering:', filteredInsights.length);
    }
    
    console.log('✅ Final filtered insights count:', filteredInsights.length);
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
        }
        
        clearPageCache(); // 清除缓存，因为数据已变化
        await loadUserInsightsWithPagination();
        
        // Also save to localStorage backup
        saveInsightsToLocalStorage({ force: true });
        
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
            // 直接清除本地状态
            auth.clearSession();
            
            // 立即跳转到首页
            window.location.href = PATHS.HOME;
        });
    }
    
    // Header edit profile button
    if (headerEditProfile) {
        headerEditProfile.addEventListener('click', () => {
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
                } else {
                    // If no tags selected, assign default "Archive" tag
                    // First, try to find the Archive tag ID from available tags
                    const archiveTag = await findOrCreateArchiveTag();
                    if (archiveTag) {
                        insightData.tag_ids = [archiveTag.id];
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
                        
                        clearPageCache(); // 清除缓存，因为数据已变化
                        await loadUserInsightsWithPagination();
                        
                        // Also save to localStorage backup
                        saveInsightsToLocalStorage({ force: true });
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
        
        // 绑定标题编辑事件
        bindTitleEditEvents();
        
        // 绑定堆叠视图事件
        bindStackViewEvents();
}

// Event delegation for card interactions (performance optimization)
function setupCardEventDelegation() {
    if (!contentCards) {
        console.error('❌ setupCardEventDelegation: contentCards element not found!');
        return;
    }
    
    console.log('🔧 Setting up card event delegation on:', contentCards);
    console.log('🔧 Current cards in DOM:', contentCards.querySelectorAll('.content-card').length);
    
    // Remove any existing event listeners to avoid duplicates
    contentCards.removeEventListener('click', handleCardClick);
    
    // Single event listener for all card interactions
    contentCards.addEventListener('click', handleCardClick);
    
    console.log('✅ Card event delegation set up successfully');
}

// Separate function for card click handling to allow removal
function handleCardClick(e) {
    console.log('🖱️ Card click detected:', e.target);
    console.log('🖱️ Clicked element classes:', e.target.className);
    console.log('🖱️ Event target:', e.target);
    
    // Handle delete button clicks
    if (e.target.matches('.content-card-delete-btn') || e.target.closest('.content-card-delete-btn')) {
        console.log('🗑️ Delete button clicked');
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
    console.log('🖱️ Closest card element:', card);
    
    if (card && !e.target.matches('.content-card-delete-btn') && !e.target.closest('.content-card-delete-btn')) {
        const insightId = card.dataset.insightId;
        console.log('🖱️ Card clicked with insight ID:', insightId);
        
        if (insightId) {
            // Find the insight data - check both currentInsights and active stack
            let insight = window.currentInsights?.find(i => i.id === insightId);
            console.log('🖱️ Found insight in currentInsights:', insight);
            
            // If not found in currentInsights and we're in stack view, check the active stack
            if (!insight && viewMode === 'stack' && activeStackId) {
                const activeStack = stacks.get(activeStackId);
                if (activeStack && activeStack.cards) {
                    insight = activeStack.cards.find(card => card.id === insightId);
                    console.log('🖱️ Found insight in active stack:', insight);
                }
            }
            
            if (insight) {
                console.log('✅ Opening content detail modal for insight:', insight.title);
                openContentDetailModal(insight);
            } else {
                console.error('❌ Insight not found for ID:', insightId);
                console.log('❌ Available insights in currentInsights:', window.currentInsights);
                console.log('❌ Active stack ID:', activeStackId);
                console.log('❌ Active stack cards:', activeStackId ? stacks.get(activeStackId)?.cards : 'No active stack');
            }
        } else {
            console.error('❌ No insight ID found on card');
        }
    } else {
        console.log('🖱️ Click not on a card or on delete button');
    }
}

// Test function to debug card clickability issues
function testCardClickability() {
    console.log('🧪 Testing card clickability...');
    
    // Check if contentCards exists
    if (!contentCards) {
        console.error('❌ contentCards element not found');
        return;
    }
    
    // Check how many cards are in the DOM
    const cards = contentCards.querySelectorAll('.content-card');
    console.log(`📊 Found ${cards.length} cards in DOM`);
    
    // Check if event listener is attached
    const hasEventListener = contentCards.onclick !== null || 
                           contentCards.addEventListener !== undefined;
    console.log(`🔧 Event listener attached:`, hasEventListener);
    
    // Check each card's structure
    cards.forEach((card, index) => {
        const insightId = card.dataset.insightId;
        const classes = card.className;
        console.log(`📄 Card ${index + 1}:`, {
            insightId,
            classes,
            hasClickHandler: card.onclick !== null
        });
    });
    
    // Test clicking on the first card programmatically
    if (cards.length > 0) {
        console.log('🖱️ Testing programmatic click on first card...');
        const firstCard = cards[0];
        const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        firstCard.dispatchEvent(clickEvent);
    }
    
    // Check window.currentInsights
    console.log('📋 window.currentInsights:', window.currentInsights);
    
    // Check current view mode and active stack
    console.log('📋 Current view mode:', viewMode);
    console.log('📋 Active stack ID:', activeStackId);
    
    if (viewMode === 'stack' && activeStackId) {
        const activeStack = stacks.get(activeStackId);
        console.log('📋 Active stack data:', activeStack);
        console.log('📋 Active stack cards:', activeStack?.cards);
    }
    
    return {
        cardCount: cards.length,
        hasEventListener,
        viewMode,
        activeStackId,
        cards: Array.from(cards).map(card => ({
            insightId: card.dataset.insightId,
            classes: card.className
        }))
    };
}

// Make test function available globally
window.testCardClickability = testCardClickability;

// Cached version of getUserTags to reduce API calls
async function getCachedUserTags() {
    const now = Date.now();
    
    // Return cached data if it's still fresh
    if (cachedUserTags && (now - userTagsCacheTime) < USER_TAGS_CACHE_DURATION) {
        return { success: true, data: cachedUserTags };
    }
    
    // Fetch fresh data
    const response = await api.getUserTags();
    
    if (response.success && response.data) {
        cachedUserTags = response.data;
        userTagsCacheTime = now;
    }
    
    return response;
}

// Clear user tags cache (call this when tags are updated)
function clearUserTagsCache() {
    cachedUserTags = null;
    userTagsCacheTime = 0;
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
        // 使用缓存的API方法获取标签
        const response = await getCachedUserTags();
        
        if (response.success && response.data) {
            const tags = response.data;
            
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
        selectedTagsDisplay.innerHTML = '<span class="no-selected-tags">Archive (default)</span>';
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
        const response = await api.deleteUserTag(userTagId);
        
        if (response.success) {
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

// ===== STACK VIEW FUNCTIONALITY =====

// Toggle stack view class on root element
function setStackViewEnabled(enabled) {
    const root = document.querySelector('.MySpace');
    if (!root) return;
    root.classList.toggle('stack-view', !!enabled);
}

// Parse route and determine view mode
function parseRoute() {
    const path = window.location.pathname;
    const stackMatch = path.match(/^\/stacks\/(\d+)$/);
    
    if (stackMatch) {
        const stackId = stackMatch[1];
        viewMode = 'stack';
        activeStackId = stackId;
        return { viewMode, stackId };
    }
    
    viewMode = 'home';
    activeStackId = null;
    return { viewMode, stackId: null };
}

// Navigate to stack view
function navigateToStack(stackId) {
    const url = `/stacks/${stackId}`;
    navigateTo(url);
    viewMode = 'stack';
    activeStackId = stackId;
    renderStackView(stackId);
}

// Navigate back to home view
function navigateToHome() {
    navigateTo(PATHS.MY_SPACE);
    // The renderHomeView() will be called by the popstate event listener
    // or we can call it directly for immediate UI update
    viewMode = 'home';
    activeStackId = null;
    renderHomeView();
}

// Render stack view
async function renderStackView(stackId) {
    console.log(`🎯 Rendering stack view for stack ${stackId}`);
    
    // Enable stack view mode (hides profile/controls sections)
    setStackViewEnabled(true);
    
    // Show stack context bar
    const stackContextBar = getCachedElementById('stackContextBar');
    if (stackContextBar) {
        stackContextBar.style.display = 'block';
    }
    
    // Hide filters in stack view
    if (filterButtons) {
        filterButtons.style.display = 'none';
    }
    
    // Get stack data
    let stack = stacks.get(stackId);
    if (!stack) {
        // Try to fetch from API if not in memory
        try {
            const response = await api.getUserStacksWithInsights(currentUser?.id);
            if (response.success && response.data) {
                // Process and cache the stacks
                response.data.forEach(stackData => {
                    const stackId = String(stackData.id);
                    const stackInsights = stackData.insights || [];
                    stacks.set(stackId, {
                        id: stackId,
                        name: stackData.name,
                        description: stackData.description,
                        cards: stackInsights,
                        createdAt: stackData.created_at,
                        updatedAt: stackData.updated_at,
                        modifiedAt: new Date().toISOString()
                    });
                });
                stack = stacks.get(stackId);
            }
        } catch (error) {
            console.error('❌ Failed to fetch stack data:', error);
            showErrorMessage('Failed to load stack data');
            return;
        }
    }
    
    if (!stack) {
        console.error('❌ Stack not found:', stackId);
        showErrorMessage('Stack not found');
        navigateToHome();
        return;
    }
    
    // Update context bar
    updateStackContextBar(stack);
    
    // Enhance stack actions
    enhanceStackActions();
    bindEnhancedStackActions();
    
    // Render stack insights
    renderStackInsights(stack);
    
    // Hide pagination
    hidePagination();
}

// Update stack context bar with stack data
function updateStackContextBar(stack) {
    const stackBreadcrumbName = getCachedElementById('stackBreadcrumbName');
    const stackCount = getCachedElementById('stackCount');
    const stackDates = getCachedElementById('stackDates');
    
    if (stackBreadcrumbName) {
        stackBreadcrumbName.textContent = stack.name || 'Untitled';
    }
    
    if (stackCount) {
        const n = Array.isArray(stack.cards) ? stack.cards.length : 0;
        stackCount.textContent = `${n} insight${n === 1 ? '' : 's'}`;
    }
    
    if (stackDates) {
        const created = stack.createdAt ? new Date(stack.createdAt) : null;
        // prefer updatedAt; if missing, fall back to modifiedAt you stamp locally
        const updated = stack.updatedAt ? new Date(stack.updatedAt)
                      : (stack.modifiedAt ? new Date(stack.modifiedAt) : null);

        const parts = [];
        if (created && !isNaN(created)) {
            const createdFormatted = created.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            });
            parts.push(`Created ${createdFormatted}`);
        }
        if (updated && !isNaN(updated)) {
            const updatedFormatted = updated.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            });
            parts.push(`Modified ${updatedFormatted}`);
        }

        stackDates.textContent = parts.join(' • ');
    }
}

// Render insights for stack view
function renderStackInsights(stack) {
    console.log('🎯 renderStackInsights called with stack:', stack);
    
    // Guard clause: only render stack insights when in stack view mode
    if (viewMode !== 'stack') {
        console.log('⚠️ renderStackInsights called but not in stack view mode, ignoring');
        return;
    }
    
    if (!contentCards) {
        console.error('❌ contentCards element not found in renderStackInsights');
        return;
    }
    
    // Clear existing content
    console.log('🧹 Clearing existing content');
    contentCards.innerHTML = '';
    
    if (!stack.cards || stack.cards.length === 0) {
        console.log('📭 No cards in stack, rendering empty state');
        renderEmptyStackState(stack);
        return;
    }
    
    console.log(`📋 Rendering ${stack.cards.length} insights for stack ${stack.id}`);
    
    // Render stack insights using existing card creation logic
    stack.cards.forEach((insight, index) => {
        console.log(`📄 Creating card ${index + 1} for insight:`, insight.title);
        const card = createInsightCard(insight);
        if (card) {
            console.log(`✅ Card created successfully, appending to DOM`);
            contentCards.appendChild(card);
        } else {
            console.error(`❌ Failed to create card for insight:`, insight.title);
        }
    });
    
    console.log(`📊 Total cards in DOM after rendering:`, contentCards.querySelectorAll('.content-card').length);
    
    // Re-setup event delegation for the newly rendered cards
    console.log('🔧 Re-setting up event delegation');
    setupCardEventDelegation();
    
    console.log(`✅ Rendered ${stack.cards.length} insights for stack ${stack.id}`);
}

// Render empty stack state
function renderEmptyStackState(stack) {
    // Guard clause: only render empty stack state when in stack view mode
    if (viewMode !== 'stack') {
        console.log('⚠️ renderEmptyStackState called but not in stack view mode, ignoring');
        return;
    }
    
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-stack-state';
    emptyState.innerHTML = `
        <div class="empty-stack-content">
            <div class="empty-stack-icon">📚</div>
            <h3>No insights yet</h3>
            <p>This stack is empty. Add some insights to get started!</p>
            <div class="empty-stack-actions">
                <button class="btn-primary" onclick="openAddContentModal()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Add Insight
                </button>
                <button class="btn-secondary" onclick="navigateToHome()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Back to My Space
                </button>
            </div>
        </div>
    `;
    
    contentCards.appendChild(emptyState);
}

// Render home view (existing functionality)
function renderHomeView() {
    console.log('🏠 Rendering home view');
    
    // Ensure we're in home view mode
    viewMode = 'home';
    activeStackId = null;
    
    // Disable stack view mode (shows profile/controls sections)
    setStackViewEnabled(false);
    
    // Hide stack context bar
    const stackContextBar = getCachedElementById('stackContextBar');
    if (stackContextBar) {
        stackContextBar.style.display = 'none';
    }
    
    // Show filters
    if (filterButtons) {
        filterButtons.style.display = 'flex';
    }
    
    // Show pagination
    showPagination();
    
    // Clear any existing empty stack states
    if (contentCards) {
        const existingEmptyStackStates = contentCards.querySelectorAll('.empty-stack-state');
        existingEmptyStackStates.forEach(state => state.remove());
    }
    
    // Render normal insights
    renderInsights();
}

// Hide pagination controls
function hidePagination() {
    const paginationContainer = getCachedElementById('paginationContainer');
    if (paginationContainer) {
        paginationContainer.style.display = 'none';
    }
}

// Show pagination controls
function showPagination() {
    const paginationContainer = getCachedElementById('paginationContainer');
    if (paginationContainer) {
        paginationContainer.style.display = 'flex';
    }
}

// Handle browser back/forward navigation
window.addEventListener('popstate', function(event) {
    const { viewMode: newViewMode, stackId } = parseRoute();
    
    if (newViewMode === 'stack' && stackId) {
        renderStackView(stackId);
    } else {
        // Navigate to home view
        viewMode = 'home';
        activeStackId = null;
        renderHomeView();
    }
});

// Enhance stack actions with Edit, Add, and proper Exit button
function enhanceStackActions() {
    const actions = document.querySelector('.stack-actions');
    if (!actions) return;

    actions.innerHTML = `
        <button class="stack-action-btn primary" id="stackEditModeBtn" aria-label="Toggle edit mode">Edit</button>
    `;
}

// Bind enhanced stack actions
function bindEnhancedStackActions() {
    const editBtn = document.getElementById('stackEditModeBtn');
    if (editBtn) {
        editBtn.onclick = () => {
            if (typeof toggleEditMode === 'function') {
                toggleEditMode();
            }
        };
    }


    // Back button
    const backBtn = document.getElementById('backToMySpaceBtn');
    if (backBtn) {
        backBtn.addEventListener('click', function() {
            navigateToHome();
        });
    }
    
    // Make stack name clickable for inline editing
    const stackName = document.getElementById('stackBreadcrumbName');
    if (stackName) {
        stackName.addEventListener('click', function() {
            startStackNameEdit(stackName);
        });
    }
    
    // Make edit icon clickable too
    const editIcon = document.querySelector('.edit-hint-icon');
    if (editIcon) {
        editIcon.addEventListener('click', function(e) {
            e.stopPropagation();
            const stackName = document.getElementById('stackBreadcrumbName');
            if (stackName) {
                startStackNameEdit(stackName);
            }
        });
    }
}

// Start inline editing of stack name
function startStackNameEdit(stackNameElement) {
    if (!stackNameElement || stackNameElement.classList.contains('editing')) return;
    
    const currentName = stackNameElement.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'stack-name-input';
    
    // Replace text with input
    stackNameElement.textContent = '';
    stackNameElement.appendChild(input);
    stackNameElement.classList.add('editing');
    
    // Focus and select text
    input.focus();
    input.select();
    
    // Handle save on Enter or blur
    const saveEdit = () => {
        const newName = input.value.trim();
        if (newName && newName !== currentName) {
            updateStackName(activeStackId, newName);
            // Mark as edited to hide the hint icon
            const container = stackNameElement.closest('.stack-name-container');
            if (container) {
                container.classList.add('edited');
            }
        }
        stackNameElement.textContent = newName || currentName;
        stackNameElement.classList.remove('editing');
    };
    
    const cancelEdit = () => {
        stackNameElement.textContent = currentName;
        stackNameElement.classList.remove('editing');
    };
    
    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    });
}


// Bind stack view events
function bindStackViewEvents() {
    // This function is kept for compatibility but enhanced actions are handled above
    bindEnhancedStackActions();
}

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
        // 使用新的API方法删除标签
        const response = await api.deleteUserTag(userTagId);
        
        if (response.success) {
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
window.createNewTag = createNewTag;












// ===== PROFILE EDIT FUNCTIONALITY =====

// Profile Edit DOM Elements (will be retrieved fresh in bindProfileEditEvents)

// 绑定用户资料编辑事件
function bindProfileEditEvents() {
    // 重新获取DOM元素（确保元素存在）
    const profileContainer = document.getElementById('profileContainer');
    const profileEditModal = document.getElementById('profileEditModal');
    const profileEditForm = document.getElementById('profileEditForm');
    const closeProfileModal = document.getElementById('closeProfileModal');
    const cancelProfileEdit = document.getElementById('cancelProfileEdit');
    const profileAvatarUpload = document.getElementById('profileAvatarUpload');
    const avatarEditBtn = document.getElementById('avatarEditBtn');
    
    // 点击头像区域打开编辑模态框
    if (profileContainer) {
        profileContainer.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            openProfileEditModal();
        }, true); // 使用捕获阶段
    }
    
    // 关闭编辑模态框
    if (closeProfileModal) {
        closeProfileModal.addEventListener('click', function() {
            closeProfileEditModal();
        });
    }
    
    if (cancelProfileEdit) {
        cancelProfileEdit.addEventListener('click', function() {
            closeProfileEditModal();
        });
    }
    
    // 点击模态框外部关闭
    if (profileEditModal) {
        profileEditModal.addEventListener('click', function(e) {
            if (e.target === profileEditModal) {
                closeProfileEditModal();
            }
        });
    }
    
    // 表单提交
    if (profileEditForm) {
        profileEditForm.addEventListener('submit', handleProfileUpdate);
    }
    
    // 头像预览
    if (profileAvatarUpload) {
        profileAvatarUpload.addEventListener('change', handleAvatarPreview);
    }
    
    // 头像编辑按钮
    if (avatarEditBtn) {
        avatarEditBtn.addEventListener('click', () => {
            if (profileAvatarUpload) {
                profileAvatarUpload.click();
            }
        });
    }
}

// 打开用户资料编辑模态框
function openProfileEditModal() {
    const profileEditModal = document.getElementById('profileEditModal');
    const profileAvatarUpload = document.getElementById('profileAvatarUpload');
    const avatarPreviewImg = document.getElementById('avatarPreviewImg');
    
    if (!profileEditModal) {
        return;
    }
    
    // 预填充当前用户信息
        const usernameInput = document.getElementById('profileUsername');
        
        if (usernameInput && currentUser) {
        const usernameValue = currentUser.nickname || currentUser.email || '';
        usernameInput.value = usernameValue;
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
}

// 处理用户资料更新
async function handleProfileUpdate(event) {
    event.preventDefault();
    
    // 检查认证状态
    if (!auth.checkAuth()) {
        showErrorMessage('Please log in to update your profile');
        return;
    }
    
    const usernameInput = document.getElementById('profileUsername');
    const saveBtn = document.getElementById('saveProfileEdit');
    const saveBtnText = document.getElementById('saveProfileBtnText');
    
    if (!usernameInput) {
        showErrorMessage('Username input not found');
        return;
    }
    
    const username = usernameInput.value.trim();
    
    // Validate inputs
    if (!username) {
        showErrorMessage('Username is required');
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
            // 显示上传进度
            const saveBtn = document.getElementById('saveProfileEdit');
            const originalText = saveBtn?.innerHTML;
            if (saveBtn) {
                saveBtn.innerHTML = '📤 Uploading Avatar...';
                saveBtn.disabled = true;
            }
            
            try {
                avatarUrl = await uploadAvatar(avatarFile);
                
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
            nickname: username
        };
        
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
    // 检查用户是否已登录
    if (!currentUser || !currentUser.id) {
        throw new Error('User not logged in');
    }
    
    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('user_id', currentUser.id);  // 添加必需的 user_id 参数
    
    try {
        const response = await api.request(API_CONFIG.USER.UPLOAD_AVATAR, {
            method: 'POST',
            body: formData
        });
        
        if (response.success && response.data && response.data.avatar_url) {
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



// 打开内容详情模态框
function openContentDetailModal(insight) {
    currentDetailInsight = insight;
    const modal = document.getElementById('contentDetailModal');
    
    if (!modal) {
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
}

// 关闭内容详情模态框
function closeContentDetailModal() {
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
                closeContentDetailModal(); // Close current modal first
                openTagEditModal(insight);  // Open tag edit modal
            };
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
    
    // Setup comment UX with elegant clamping
    setupCommentUX({ maxLines: 4 });
}

// 绑定标题编辑事件
function bindTitleEditEvents() {
    // 标题点击编辑
    const titleElement = document.getElementById('modalContentTitle');
    const editTitleBtn = document.getElementById('modalEditTitleBtn');
    
    if (titleElement) {
        titleElement.addEventListener('click', startTitleEdit);
    }
    
    if (editTitleBtn) {
        editTitleBtn.addEventListener('click', startTitleEdit);
    }
}

// 开始标题编辑
function startTitleEdit() {
    if (!currentDetailInsight) return;
    
    const titleContainer = document.querySelector('.title-container');
    const titleElement = document.getElementById('modalContentTitle');
    
    if (!titleContainer || !titleElement) return;
    
    // 进入编辑模式
    titleContainer.classList.add('title-edit-mode');
    
    // 创建输入框
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'title-edit-input';
    input.value = titleElement.textContent;
    input.placeholder = 'Enter title...';
    
    // 创建操作按钮
    const actions = document.createElement('div');
    actions.className = 'title-edit-actions';
    
    const saveBtn = document.createElement('button');
    saveBtn.className = 'title-edit-save';
    saveBtn.innerHTML = '✓';
    saveBtn.title = 'Save';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'title-edit-cancel';
    cancelBtn.innerHTML = '✕';
    cancelBtn.title = 'Cancel';
    
    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);
    
    // 添加到容器
    titleContainer.appendChild(input);
    titleContainer.appendChild(actions);
    
    // 聚焦并选中文本
    input.focus();
    input.select();
    
    // 绑定事件
    const saveTitle = () => {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== titleElement.textContent) {
            updateInsightTitle(currentDetailInsight.id, newTitle);
        }
        cancelTitleEdit();
    };
    
    const cancelTitle = () => {
        cancelTitleEdit();
    };
    
    saveBtn.addEventListener('click', saveTitle);
    cancelBtn.addEventListener('click', cancelTitle);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveTitle();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelTitle();
        }
    });
    
    // 点击外部取消编辑
    const handleOutsideClick = (e) => {
        if (!titleContainer.contains(e.target)) {
            cancelTitle();
            document.removeEventListener('click', handleOutsideClick);
        }
    };
    
    setTimeout(() => {
        document.addEventListener('click', handleOutsideClick);
    }, 100);
}

// 取消标题编辑
function cancelTitleEdit() {
    const titleContainer = document.querySelector('.title-container');
    if (!titleContainer) return;
    
    // 移除编辑模式
    titleContainer.classList.remove('title-edit-mode');
    
    // 移除输入框和按钮
    const input = titleContainer.querySelector('.title-edit-input');
    const actions = titleContainer.querySelector('.title-edit-actions');
    
    if (input) input.remove();
    if (actions) actions.remove();
}

// 更新洞察标题
async function updateInsightTitle(insightId, newTitle) {
    try {
        // 检查认证状态
        if (!auth.checkAuth()) {
            showErrorMessage('Please log in to update content');
            return;
        }
        
        // 调用API更新标题
        const response = await api.updateInsight(insightId, { title: newTitle });
        
        if (response.success) {
            // 更新本地数据
            if (currentDetailInsight && currentDetailInsight.id === insightId) {
                currentDetailInsight.title = newTitle;
            }
            
            // 更新当前页面数据
            if (window.currentInsights) {
                const insight = window.currentInsights.find(i => i.id === insightId);
                if (insight) {
                    insight.title = newTitle;
                }
            }
            
            // 更新显示
            const titleElement = document.getElementById('modalContentTitle');
            if (titleElement) {
                titleElement.textContent = newTitle;
            }
            
            // 重新渲染页面以更新卡片标题
            renderInsights();
            
            showSuccessMessage('Title updated successfully!');
        } else {
            throw new Error(response.message || 'Failed to update title');
        }
    } catch (error) {
        console.error('❌ Failed to update title:', error);
        showErrorMessage('Failed to update title. Please try again.');
    }
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

// Best-UX clamping for the comment text inside the modal
function setupCommentUX({
  textSelector = '#modalCommentText',
  afterElSelector = '#editCommentBtn',  // place the toggle near your Edit button
  maxLines = 4
} = {}) {
  const textEl = document.querySelector(textSelector);
  if (!textEl) return;

  // Ensure clamping class reflects the configured line count
  textEl.classList.add('clamped');
  textEl.style.setProperty('-webkit-line-clamp', String(maxLines));

  // Create or reuse the toggle button
  let toggle = document.querySelector('.comment-toggle');
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'comment-toggle';
    toggle.id = 'commentToggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.style.display = 'none'; // shown only when needed

    // Insert after the chosen element (Edit button), or after the text if not found
    const anchor = document.querySelector(afterElSelector) || textEl;
    anchor.parentElement.insertBefore(toggle, anchor.nextSibling);
  }

  const updateToggleVisibility = () => {
    // Temporarily remove clamp to measure real height
    const wasClamped = textEl.classList.contains('clamped');
    if (wasClamped) textEl.classList.remove('clamped');

    // Force wrap for long tokens
    textEl.style.whiteSpace = 'pre-wrap';

    const overflowing = textEl.scrollHeight > textEl.clientHeight + 1;

    // Restore clamp if it was on
    if (wasClamped) textEl.classList.add('clamped');

    if (overflowing) {
      toggle.style.display = 'inline-flex';
      toggle.textContent = wasClamped ? 'Show more' : 'Show less';
      toggle.setAttribute('aria-expanded', String(!wasClamped));
    } else {
      toggle.style.display = 'none';
    }
  };

  // Initial check (after current frame so layout is correct)
  requestAnimationFrame(updateToggleVisibility);

  // Toggle behavior
  toggle.onclick = () => {
    const clamped = textEl.classList.toggle('clamped'); // toggle
    toggle.textContent = clamped ? 'Show more' : 'Show less';
    toggle.setAttribute('aria-expanded', String(!clamped));
  };

  // Re-evaluate on window resize (layout changes)
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(updateToggleVisibility, 100);
  });

  // Keep in sync with your existing edit/save flow if present
  const editBtn = document.querySelector('#editCommentBtn');
  const saveBtn = document.querySelector('#saveCommentBtn');
  const cancelBtn = document.querySelector('#cancelCommentBtn');

  // Hide toggle while editing
  if (editBtn) editBtn.addEventListener('click', () => {
    toggle.style.display = 'none';
  });

  // After save/cancel, clamp again and recompute
  const postEdit = () => {
    textEl.classList.add('clamped');
    requestAnimationFrame(updateToggleVisibility);
  };
  if (saveBtn) saveBtn.addEventListener('click', postEdit);
  if (cancelBtn) cancelBtn.addEventListener('click', postEdit);

  // Optional: normalize pasted monster strings before saving
  window.normalizeComment = (s) =>
    s.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
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

// 更新页面缓存中的洞察数据
function updatePageCacheWithInsight(insightId, updateData) {
    // 更新所有页面缓存中的该洞察
    for (const [pageNum, cacheData] of pageCache.entries()) {
        if (cacheData && cacheData.insights) {
            const insightIndex = cacheData.insights.findIndex(i => i.id === insightId);
            if (insightIndex !== -1) {
                // 更新缓存中的洞察数据
                Object.assign(cacheData.insights[insightIndex], updateData);
                // 更新缓存时间戳
                cacheData.timestamp = Date.now();
                pageCache.set(pageNum, cacheData);
            }
        }
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
    saveCommentBtn.addEventListener('click', async () => {
        const newComment = commentTextarea.value.trim();
        
        try {
            // 检查认证状态
            if (!auth.checkAuth()) {
                showErrorMessage('Please log in to save comments');
                return;
            }
            
            // 获取当前洞察的ID
            const currentInsight = currentDetailInsight;
            if (!currentInsight || !currentInsight.id) {
                showErrorMessage('Unable to identify content to update');
                return;
            }
            
            // 调用API更新评论
            const response = await api.updateInsight(currentInsight.id, { 
                thought: newComment 
            });
            
            if (response.success) {
                // 更新显示的评论
                const commentText = document.getElementById('modalCommentText');
                if (commentText) {
                    commentText.textContent = newComment || 'No comment added yet.';
                }
                
                // 更新本地数据
                if (currentInsight) {
                    currentInsight.thought = newComment;
                }
                
                // 更新全局insights数组
                if (window.currentInsights) {
                    const insightIndex = window.currentInsights.findIndex(i => i.id === currentInsight.id);
                    if (insightIndex !== -1) {
                        window.currentInsights[insightIndex].thought = newComment;
                    }
                }
                
                // 更新页面缓存
                updatePageCacheWithInsight(currentInsight.id, { thought: newComment });
                
                showSuccessMessage('Comment saved successfully!');
            } else {
                showErrorMessage(response.message || 'Failed to save comment');
            }
        } catch (error) {
            console.error('Error saving comment:', error);
            showErrorMessage('Failed to save comment. Please try again.');
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
        
        // Add template card at the front
        addTemplateCard();
        
        // Add shaking animation to all content cards (excluding template)
        const contentCards = document.querySelectorAll('.content-card:not(.template-card)');
        contentCards.forEach(card => {
            card.classList.add('shake');
        });
    } else {
        // Exit edit mode
        editModeBtn.classList.remove('active');
        editBtnText.textContent = 'Edit';
        document.body.classList.remove('edit-mode');
        
        // Remove template card
        removeTemplateCard();
        
        // Remove shaking animation from all content cards
        const contentCards = document.querySelectorAll('.content-card');
        contentCards.forEach(card => {
            card.classList.remove('shake');
        });
    }
}

// Add template card for adding new content in edit mode
function addTemplateCard() {
    const contentCards = document.getElementById('contentCards');
    if (!contentCards) return;
    
    // Check if template card already exists
    if (contentCards.querySelector('.template-card')) return;
    
    // Create template card
    const templateCard = document.createElement('div');
    templateCard.className = 'content-card template-card';
    templateCard.innerHTML = `
        <div class="template-card-content">
            <div class="template-card-icon">
                <svg width="72" height="72" viewBox="0 0 24 24" fill="none">
                    <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
            <div class="template-card-text">
                <h3>Add New Content</h3>
                <p>Click to add a new content card</p>
            </div>
        </div>
    `;
    
    // Insert at the beginning
    contentCards.insertBefore(templateCard, contentCards.firstChild);
    
    // Add click event to show creation options
    templateCard.addEventListener('click', () => {
        showCreationOptionsModal();
    });
}

// Remove template card when exiting edit mode
function removeTemplateCard() {
    const templateCard = document.querySelector('.template-card');
    if (templateCard) {
        templateCard.remove();
    }
}

// Show modal with options to create card or stack
function showCreationOptionsModal() {
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay creation-options-modal';
    modalOverlay.innerHTML = `
        <div class="modal-content creation-options-content">
            <div class="modal-header">
                <h2>Create New</h2>
                <button class="modal-close-btn" id="closeCreationOptionsModal">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
            <div class="modal-body">
                <div class="creation-options">
                    <div class="creation-option" id="createCardOption">
                        <div class="creation-option-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <polyline points="10,9 9,9 8,9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <div class="creation-option-content">
                            <h3>Content Card</h3>
                            <p>Create a single content card with a link, title, and description</p>
                        </div>
                    </div>
                    
                    <div class="creation-option" id="createStackOption">
                        <div class="creation-option-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" stroke-width="2"/>
                                <rect x="7" y="7" width="10" height="10" rx="1" ry="1" stroke="currentColor" stroke-width="2"/>
                                <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="1" opacity="0.5"/>
                            </svg>
                        </div>
                        <div class="creation-option-content">
                            <h3>Stack</h3>
                            <p>Create an empty stack to organize multiple content cards</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modalOverlay);
    
    // Add event listeners
    const closeBtn = document.getElementById('closeCreationOptionsModal');
    const createCardOption = document.getElementById('createCardOption');
    const createStackOption = document.getElementById('createStackOption');
    
    closeBtn.addEventListener('click', hideCreationOptionsModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            hideCreationOptionsModal();
        }
    });
    
    createCardOption.addEventListener('click', () => {
        hideCreationOptionsModal();
        showAddContentModal();
    });
    
    createStackOption.addEventListener('click', () => {
        hideCreationOptionsModal();
        createEmptyStack();
    });
}

// Hide creation options modal
function hideCreationOptionsModal() {
    const modal = document.querySelector('.creation-options-modal');
    if (modal) {
        modal.remove();
    }
}

// Create an empty stack
async function createEmptyStack() {
    try {
        const stackData = {
            name: 'New Stack',
            description: 'A new stack for organizing content',
            items: []
        };
        
        console.log('Creating empty stack with data:', stackData);
        const response = await api.createStack(stackData);
        console.log('Stack creation response:', response);
        
        if (response && response.success) {
            // Register the new stack in the stacks Map
            const stackId = response.data.id;
            const newStackData = {
                id: stackId,
                name: response.data.name,
                description: response.data.description,
                cards: [], // Use 'cards' for consistency
                createdAt: response.data.created_at,
                modifiedAt: response.data.updated_at,
                isExpanded: false // Initialize expansion state
            };
            
            stacks.set(String(stackId), newStackData);
            
            // Save to localStorage immediately
            saveStacksToLocalStorage();
            
            // Re-render the insights
            renderInsights();
            
            // Show success message
            showNotification('Empty stack created successfully!', 'success');
        } else {
            // Fallback: Create a local stack if API fails
            console.warn('API createStack failed, creating local stack:', response);
            const stackId = 'local-stack-' + Date.now();
            const localStackData = {
                id: stackId,
                name: stackData.name,
                description: stackData.description,
                cards: [], // Use 'cards' for consistency
                createdAt: new Date().toISOString(),
                modifiedAt: new Date().toISOString(),
                isLocal: true, // Mark as local for debugging
                isExpanded: false // Initialize expansion state
            };
            
            stacks.set(String(stackId), localStackData);
            
            // Save to localStorage immediately
            saveStacksToLocalStorage();
            
            renderInsights();
            
            showNotification('Stack created locally (API endpoint not available)', 'warning');
        }
    } catch (error) {
        console.error('Error creating empty stack:', error);
        
        // Fallback: Create a local stack if API completely fails
        console.warn('API completely failed, creating local stack');
        const stackId = 'local-stack-' + Date.now();
        const localStackData = {
            id: stackId,
            name: 'New Stack',
            description: 'A new stack for organizing content',
            cards: [], // Use 'cards' for consistency
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            isLocal: true // Mark as local for debugging
        };
        
        stacks.set(String(stackId), localStackData);
        
        // Save to localStorage immediately
        saveStacksToLocalStorage();
        
        renderInsights();
        
        showNotification('Stack created locally (API unavailable)', 'warning');
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
        // Add template card if it doesn't exist
        const existingTemplateCard = document.querySelector('.template-card');
        if (!existingTemplateCard) {
            addTemplateCard();
        }
        
        // Add shake animation to all content cards (excluding template)
        const contentCards = document.querySelectorAll('.content-card:not(.template-card)');
        contentCards.forEach(card => {
            card.classList.add('shake');
        });
    } else {
        // Remove template card when not in edit mode
        const templateCard = document.querySelector('.template-card');
        if (templateCard) {
            templateCard.remove();
        }
    }
}

// Setup drag and drop functionality for a card
function setupCardDragAndDrop(card, insight) {
    // Only enable drag in edit mode and only for individual insight cards (not stack cards)
    card.addEventListener('mousedown', (e) => {
        if (!isEditMode || e.target.closest('.content-card-delete-btn') || card.classList.contains('stack-card')) {
            return;
        }
        
        // Check if this insight is already in a stack
        const insightInStack = Array.from(stacks.values()).some(stack => 
            stack.cards.some(card => card.id === insight.id)
        );
        
        if (insightInStack) {
            return; // Don't allow dragging cards that are already in stacks
        }
        
        e.preventDefault();
        startDrag(card, e);
    });
    
    // Touch events for mobile
    card.addEventListener('touchstart', (e) => {
        if (!isEditMode || e.target.closest('.content-card-delete-btn') || card.classList.contains('stack-card')) {
            return;
        }
        
        // Check if this insight is already in a stack
        const insightInStack = Array.from(stacks.values()).some(stack => 
            stack.cards.some(card => card.id === insight.id)
        );
        
        if (insightInStack) {
            return; // Don't allow dragging cards that are already in stacks
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
    ghost.classList.remove('dragging'); // Remove dragging class from ghost
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
    const left = (event.clientX - dragOffset.x) + 'px';
    const top = (event.clientY - dragOffset.y) + 'px';
    ghost.style.left = left;
    ghost.style.top = top;
}

// Check if dragging over a stack for joining
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
    
    // Only allow dropping on existing stacks (not individual cards)
    const targetStack = elementBelow?.closest('.content-card.stack-card:not(.dragging)');
    
    if (targetStack && targetStack !== draggedCard) {
        // Clear previous timeout
        if (stackHoverTimeout) {
            clearTimeout(stackHoverTimeout);
        }
        
        // Add hover effect
        targetStack.classList.add('stack-hover');
        
        // Set timeout for joining stack
        stackHoverTimeout = setTimeout(() => {
            joinStack(draggedCard, targetStack);
        }, 1000); // 1 second hover time
        
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
}

// Join an insight to an existing stack
async function joinStack(card, targetStack) {
    // Get insight data for the card being dragged
    const insight = getInsightById(card.dataset.insightId);
    const stackId = targetStack.dataset.stackId;
    
    if (!insight) {
        console.error('❌ Cannot find insight data for card');
        return;
    }
    
    if (!stackId) {
        console.error('❌ Cannot find stack ID for target stack');
        return;
    }
    
    try {
        // Check if insight is already in a stack
        const insightInStack = Array.from(stacks.values()).some(stack => 
            stack.cards.some(card => card.id === insight.id)
        );

        if (insightInStack) {
            showErrorMessage('This card is already in a stack. Each card can only be in one stack.');
            return;
        }
        
        // Get the target stack data (stackId is already a string from dataset)
        const targetStackData = stacks.get(stackId);
        if (!targetStackData) {
            console.error('❌ Cannot find target stack data for stackId:', stackId);
            console.error('Available stack IDs:', Array.from(stacks.keys()));
            return;
        }
        
        // Add insight to the stack via API
        // Convert stackId to integer since database expects integer type
        const response = await api.addItemToStack(parseInt(stackId), insight.id);
        
        if (response.success) {
            // Update local stack data
            targetStackData.cards.push(insight);
            targetStackData.modifiedAt = new Date().toISOString();
            
            // Update the stacks Map
            stacks.set(String(stackId), targetStackData);
            
            // Remove card from currentInsights to avoid duplicates
            currentInsights = currentInsights.filter(currentInsight => 
                currentInsight.id !== insight.id
            );
            
            // Immediately remove the original card from the DOM
            card.remove();
            
            // Save to localStorage for persistence
            saveStacksToLocalStorage();
            saveInsightsToLocalStorage({ force: true });
            
            // Invalidate ALL page caches since pagination has changed
            pageCache.clear();
            loadedPages.clear();
            
            // Clear GET cache to prevent stale data
            if (window.apiCache) {
                window.apiCache.clearPattern('/api/v1/insights');
                window.apiCache.clearPattern('/api/v1/stacks');
            }
            
            // Update pagination counts
            updatePaginationCounts();
            
            // Re-render to show the updated stack
            renderInsights();
            
            // Show success message
            showSuccessMessage('Card added to stack successfully!');
            
        } else {
            console.error('❌ Failed to add insight to stack');
            showErrorMessage('Failed to add card to stack. Please try again.');
        }
        
    } catch (error) {
        console.error('❌ Error joining stack:', error);
        showErrorMessage('Error adding card to stack: ' + error.message);
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

// Update pagination when stacks or insights change
function updatePaginationCounts() {
    // DO NOT overwrite totalInsights here; it already comes from backend pagination.total
    const stacksCount = stacks.size;
    
    // Count insights that are within stacks (these should not be counted separately)
    let insightsInStacks = 0;
    stacks.forEach(stackData => {
        insightsInStacks += stackData.cards.length;
    });
    
    // Calculate actual insights that are not in stacks
    const standaloneInsights = Math.max(0, totalInsights - insightsInStacks);

    const page1SlotsForInsights = Math.max(0, insightsPerPage - stacksCount);
    const remainingInsights = Math.max(0, standaloneInsights - page1SlotsForInsights);

    // 0 insights → still show 1 page (empty state)
    totalPages = standaloneInsights === 0 && stacksCount === 0 ? 1 : (1 + (remainingInsights > 0 ? Math.ceil(remainingInsights / insightsPerPage) : 0));

    if (currentPage > totalPages) currentPage = totalPages;
    updatePaginationUI();
}

// Save stacks to localStorage (called periodically to prevent data loss)
function saveStacksToLocalStorage() {
    try {
        // Always save stacks to prevent data loss - removed conditional check
        const stacksData = Array.from(stacks.entries());
        // Always save stacks data, even if empty (to properly handle deletions)
        localStorage.setItem('quest_stacks', JSON.stringify(stacksData));
        console.log('💾 Saved stacks to localStorage:', stacksData.length, 'stacks');
        
        // Debug: Log stack details if there are any
        if (stacksData.length > 0) {
            console.log('🔍 Debug: Stack details being saved:', stacksData.map(([id, data]) => ({
                id,
                name: data.name,
                cardCount: data.cards?.length || 0
            })));
        }
    } catch (error) {
        console.error('❌ Failed to save stacks to localStorage:', error);
        // Show user notification about storage issue
        showErrorMessage('Warning: Unable to save stacks locally. Your data may be lost if you refresh the page.');
    }
}

// Clear all stacks from localStorage (used when deleting all stacks)
function clearStacksFromLocalStorage() {
    try {
        localStorage.removeItem('quest_stacks');
        console.log('🗑️ Cleared stacks from localStorage');
    } catch (error) {
        console.error('❌ Failed to clear stacks from localStorage:', error);
    }
}

// Save insights to localStorage backup (safe version that prevents data loss)
function saveInsightsToLocalStorage({ force = false } = {}) {
    try {
        const cur = Array.isArray(currentInsights) ? currentInsights : [];
        const curLen = cur.length;

        if (!force) {
            // Don't auto-save before we've actually loaded anything
            if (!hasLoadedInsightsOnce || curLen === 0) {
                console.log('↩︎ skip auto-save: no insights yet');
                return;
            }
            // Don't shrink a non-empty backup unintentionally
            const prevRaw = localStorage.getItem('quest_insights_backup');
            const prevLen = (() => {
                try { 
                    const prev = prevRaw ? JSON.parse(prevRaw) : null; 
                    return Array.isArray(prev?.data) ? prev.data.length : 0; 
                } catch { return 0; }
            })();
            if (prevLen && curLen < prevLen) {
                console.log(`↩︎ skip auto-save: would shrink backup ${prevLen}→${curLen}`);
                return;
            }
        }

        const backup = { data: [...cur], timestamp: Date.now(), version: '1.0' };
        localStorage.setItem('quest_insights_backup', JSON.stringify(backup));
        console.log('💾 Saved insights backup:', curLen);
    } catch (e) {
        console.error('❌ Failed to save insights to localStorage:', e);
        showErrorMessage('Warning: Unable to save data locally.');
    }
}

// Check localStorage health and available space
function checkLocalStorageHealth() {
    try {
        const testKey = 'quest_storage_test';
        const testData = 'x'.repeat(1024); // 1KB test
        localStorage.setItem(testKey, testData);
        localStorage.removeItem(testKey);
        return true;
    } catch (error) {
        console.error('❌ localStorage health check failed:', error);
        showErrorMessage('Warning: Browser storage is full or unavailable. Your data may not be saved.');
        return false;
    }
}

// Auto-save stacks and insights more frequently to prevent data loss
if (!window.__QUEST_AUTOSAVE_ID__) {
    window.__QUEST_AUTOSAVE_ID__ = setInterval(() => {
        if (checkLocalStorageHealth()) {
            // Only save stacks if they've been loaded at least once
            if (hasLoadedStacksOnce) {
                saveStacksToLocalStorage();
            }
            // Only save insights if they've been loaded at least once
            if (hasLoadedInsightsOnce) {
                saveInsightsToLocalStorage();
            }
        }
    }, 15000); // Reduced from 30s to 15s for more frequent saves
}

// Note: beforeunload handler moved to top of file for better organization

// Find or create the Archive tag for default assignment
async function findOrCreateArchiveTag() {
    try {
        // First, try to get existing tags
        const response = await api.getUserTags();
        if (response.success && response.data) {
            const archiveTag = response.data.find(tag => tag.name === 'Archive');
            if (archiveTag) {
                return archiveTag;
            }
        }
        
        // If Archive tag doesn't exist, create it
        console.log('📁 Creating default Archive tag...');
        const createResponse = await api.createUserTag({
            name: 'Archive',
            color: '#F59E0B'
        });
        
        if (createResponse.success && createResponse.data) {
            console.log('✅ Archive tag created successfully');
            return createResponse.data;
        }
        
        return null;
    } catch (error) {
        console.error('❌ Failed to find or create Archive tag:', error);
        return null;
    }
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
    
    // Card header - Top row with date and source info (matching insight card structure)
    const cardHeader = document.createElement('div');
    cardHeader.className = 'content-card-header';
    
    // Top row: Date on left, item count on right (where source info would be)
    const topRow = document.createElement('div');
    topRow.className = 'content-card-top-row';
    
    const headerDate = document.createElement('div');
    headerDate.className = 'content-card-date';
    headerDate.textContent = new Date(stackData.createdAt).toLocaleDateString('en-US');
    
    const itemCountInfo = document.createElement('div');
    itemCountInfo.className = 'content-card-source';
    
    const itemCountLogo = document.createElement('div');
    itemCountLogo.className = 'content-card-source-logo';
    itemCountLogo.innerHTML = '📚'; // Stack icon
    
    const itemCountName = document.createElement('span');
    itemCountName.className = 'content-card-source-name';
    itemCountName.textContent = `${stackData.cards.length} items`;
    
    itemCountInfo.appendChild(itemCountLogo);
    itemCountInfo.appendChild(itemCountName);
    
    topRow.appendChild(headerDate);
    topRow.appendChild(itemCountInfo);
    
    // Title below the top row
    const title = document.createElement('div');
    title.className = 'content-card-title';
    title.textContent = stackData.name;
    
    cardHeader.appendChild(topRow);
    cardHeader.appendChild(title);
    
    // Description
    const description = document.createElement('div');
    description.className = 'content-card-description';
    description.textContent = stackData.description || 'A collection of related content';
    
    // Footer with main tag
    const footer = document.createElement('div');
    footer.className = 'content-card-footer';
    
    const mainTag = document.createElement('div');
    mainTag.className = 'content-card-tag-main';
    mainTag.textContent = 'STACK';
    
    footer.appendChild(mainTag);
    
    // Assemble card content
    content.appendChild(cardHeader);
    content.appendChild(description);
    content.appendChild(footer);
    card.appendChild(content);
    
    // Click handler to navigate to stack view
    card.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Don't navigate if clicking on delete button or in edit mode
        if (e.target.closest('.content-card-delete-btn') || isEditMode) {
            return;
        }
        
        // Ensure stackData is properly initialized
        if (!stackData || !stackData.id) {
            console.error('❌ Invalid stack data:', stackData);
            return;
        }
        
        console.log('🖱️ Stack card clicked, navigating to stack view:', stackData.name);
        
        // Navigate to stack view
        navigateToStack(stackData.id);
    });
    
    return card;
}

// Start inline editing of stack name
function startInlineNameEdit(stackId, nameElement) {
    const currentName = nameElement.textContent;
    
    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'stack-name-edit-input';
    input.style.cssText = `
        background: transparent;
        border: 2px solid var(--quest-purple);
        border-radius: 4px;
        padding: 4px 8px;
        font-size: inherit;
        font-weight: inherit;
        color: inherit;
        width: 100%;
        outline: none;
    `;
    
    // Replace the name element with input
    const container = nameElement.parentElement;
    const editIcon = container.querySelector('.edit-icon');
    
    // Remove both name element and edit icon
    if (container.contains(nameElement)) {
        container.removeChild(nameElement);
    }
    if (editIcon && container.contains(editIcon)) {
        container.removeChild(editIcon);
    }
    
    container.appendChild(input);
    
    // Focus and select text
    input.focus();
    input.select();
    
    // Handle save on Enter or blur
    const saveEdit = async () => {
        const newName = input.value.trim();
        const wasEdited = newName && newName !== currentName;
        
        if (wasEdited) {
            try {
                await updateStackName(stackId, newName);
                // Update the stack data
                const stackData = stacks.get(stackId);
                if (stackData) {
                    stackData.name = newName;
                    stacks.set(String(stackId), stackData);
                    
                    // Save to localStorage immediately
                    saveStacksToLocalStorage();
                }
            } catch (error) {
                console.error('Failed to update stack name:', error);
                showNotification('Failed to update stack name', 'error');
            }
        }
        
        // Restore the name element
        const newNameElement = document.createElement('h3');
        newNameElement.className = 'stack-name-horizontal editable-name';
        newNameElement.setAttribute('data-stack-id', stackId);
        newNameElement.textContent = newName || currentName;
        
        // Add edit icon
        const editIcon = document.createElement('svg');
        editIcon.className = 'edit-icon';
        editIcon.setAttribute('width', '16');
        editIcon.setAttribute('height', '16');
        editIcon.setAttribute('viewBox', '0 0 24 24');
        editIcon.setAttribute('fill', 'none');
        editIcon.innerHTML = '<path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />';
        
        // Clear container and add new elements
        container.innerHTML = '';
        container.appendChild(newNameElement);
        container.appendChild(editIcon);
        
        // Add "edited" class if this was the first edit
        if (wasEdited) {
            container.classList.add('edited');
        }
        
        // Re-attach event listener
        newNameElement.addEventListener('click', (e) => {
            e.stopPropagation();
            startInlineNameEdit(stackId, newNameElement);
        });
    };
    
    // Handle cancel on Escape
    const cancelEdit = () => {
        const newNameElement = document.createElement('h3');
        newNameElement.className = 'stack-name-horizontal editable-name';
        newNameElement.setAttribute('data-stack-id', stackId);
        newNameElement.textContent = currentName;
        
        // Add edit icon
        const editIcon = document.createElement('svg');
        editIcon.className = 'edit-icon';
        editIcon.setAttribute('width', '16');
        editIcon.setAttribute('height', '16');
        editIcon.setAttribute('viewBox', '0 0 24 24');
        editIcon.setAttribute('fill', 'none');
        editIcon.innerHTML = '<path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />';
        
        // Clear container and add new elements
        container.innerHTML = '';
        container.appendChild(newNameElement);
        container.appendChild(editIcon);
        
        // Preserve the "edited" class if it was already there
        // (don't add it since we're canceling the edit)
        
        // Re-attach event listener
        newNameElement.addEventListener('click', (e) => {
            e.stopPropagation();
            startInlineNameEdit(stackId, newNameElement);
        });
    };
    
    input.addEventListener('blur', saveEdit);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    });
}

// Update stack name via API
async function updateStackName(stackId, newName) {
    try {
        const response = await api.updateStack(parseInt(stackId), { name: newName });
        if (response && response.success) {
            showNotification('Stack name updated successfully', 'success');
            return response;
        } else {
            throw new Error('Failed to update stack name');
        }
    } catch (error) {
        console.error('Error updating stack name:', error);
        throw error;
    }
}

// Remove an item from a stack
async function removeItemFromStack(stackId, insightId) {
    if (confirm('Are you sure you want to remove this item from the stack?')) {
        try {
            // Remove stack_id from the insight via API
            const response = await api.removeItemFromStack(parseInt(stackId), insightId);
            
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
                        saveInsightsToLocalStorage({ force: true });
                        
                        // If stack has 1 or fewer items, dissolve it
                        if (stackData.cards.length <= 1) {
                            // Move the remaining item back to insights if there is one
                            if (stackData.cards.length === 1) {
                                currentInsights.push(stackData.cards[0]);
                            }
                            stacks.delete(stackId);
                            saveStacksToLocalStorage();
                            saveInsightsToLocalStorage();
                            updatePaginationCounts();
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
                        saveInsightsToLocalStorage({ force: true });
                        
                        // If stack has 1 or fewer items, dissolve it
                        if (stackData.cards.length <= 1) {
                            // Move the remaining item back to insights if there is one
                            if (stackData.cards.length === 1) {
                                currentInsights.push(stackData.cards[0]);
                            }
                            stacks.delete(stackId);
                            saveStacksToLocalStorage();
                            saveInsightsToLocalStorage();
                            updatePaginationCounts();
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
                    api.removeItemFromStack(parseInt(stackId), card.id)
                );
                
                const responses = await Promise.all(removePromises);
                
                // Check if all updates were successful
                const allSuccessful = responses.every(response => response.success);
                
                if (allSuccessful) {
                    // Don't add cards back to currentInsights - they'll be loaded from backend on next refresh
                    // This prevents duplication issues
                    stacks.delete(stackId);
                    
                    // Update localStorage to remove the deleted stack
                    saveStacksToLocalStorage();
                    saveInsightsToLocalStorage({ force: true });
                    
                    // Invalidate ALL page caches since pagination has changed
                    pageCache.clear();
                    loadedPages.clear();
                    
                    // Clear GET cache to prevent stale data
                    if (window.apiCache) {
                        window.apiCache.clearPattern('/api/v1/insights');
                        window.apiCache.clearPattern('/api/v1/stacks');
                    }
                    
                    // Update pagination counts
                    updatePaginationCounts();
                    
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
                // Don't add cards back to currentInsights - they'll be loaded from backend on next refresh
                // This prevents duplication issues
                stacks.delete(stackId);
                
                // Update localStorage to remove the deleted stack
                saveStacksToLocalStorage();
                
                // Invalidate ALL page caches since pagination has changed
                pageCache.clear();
                loadedPages.clear();
                
                // Clear GET cache to prevent stale data
                if (window.apiCache) {
                    window.apiCache.clearPattern('/api/v1/insights');
                    window.apiCache.clearPattern('/api/v1/stacks');
                }
                
                // Update pagination counts
                updatePaginationCounts();
                
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
                <div class="stack-name-container">
                    <h3 class="stack-name-horizontal editable-name" data-stack-id="${stackData.id}">${stackData.name}</h3>
                    <svg class="edit-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
                            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                </div>
                <div class="stack-meta-horizontal">
                    <span class="stack-created">Created: ${formatDate(stackData.createdAt)}</span>
                    <span class="stack-modified">Last Modified: ${formatDate(stackData.modifiedAt)}</span>
                </div>
            </div>
            <div class="stack-actions-horizontal">
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
    const collapseBtn = stackCard.querySelector('.stack-collapse-btn');
    const editModeBtn = stackCard.querySelector('.stack-edit-mode-btn-horizontal');
    const editableName = stackCard.querySelector('.editable-name');
    
    collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        collapseStack(stackData.id);
    });
    
    editModeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleStackEditModeHorizontal(stackData.id);
    });
    
    // Set up inline name editing
    if (editableName) {
        editableName.addEventListener('click', (e) => {
            e.stopPropagation();
            startInlineNameEdit(stackData.id, editableName);
        });
    }
    
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
    
    // Extract clean title
    let cleanTitle = insight.title || 'Untitled';
    
    // For Wikipedia URLs, extract just the article title from URL
    if (insight.url && insight.url.includes('wikipedia.org')) {
        try {
            const urlPath = new URL(insight.url).pathname;
            const articleTitle = urlPath.split('/').pop().replace(/_/g, ' ');
            if (articleTitle && articleTitle !== 'Main_Page') {
                cleanTitle = articleTitle;
            }
        } catch (e) {
            // If URL parsing fails, keep original title
        }
    } else {
        // For other sources, remove source name if it's at the beginning
        const sourceNameForTitle = getSourceName(insight.url);
        if (cleanTitle.startsWith(sourceNameForTitle)) {
            cleanTitle = cleanTitle.substring(sourceNameForTitle.length).trim();
            // Remove leading comma and space if present
            if (cleanTitle.startsWith(',')) {
                cleanTitle = cleanTitle.substring(1).trim();
            }
        }
    }
    
    title.textContent = cleanTitle;
    
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
        // Convert newStackId to integer since database expects integer type
        const response = await api.moveItemToStack(parseInt(newStackId), insight.id);
        
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
            
            // Invalidate page caches and update pagination
            pageCache.clear();
            loadedPages.clear();
            
            // Clear GET cache to prevent stale data
            if (window.apiCache) {
                window.apiCache.clearPattern('/api/v1/insights');
                window.apiCache.clearPattern('/api/v1/stacks');
            }
            
            updatePaginationCounts();
            
            // Re-render content
            renderInsights();
        } else {
            throw new Error(response.message || 'Failed to move card');
        }
            } catch (error) {
            console.error('❌ Failed to move card via API:', error);
            
            // Fallback to local storage if API is not implemented
            if (error.message.includes('404') || error.message.includes('Not Found')) {
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
                
                // Invalidate page caches and update pagination
                pageCache.clear();
                loadedPages.clear();
                
                // Clear GET cache to prevent stale data
                if (window.apiCache) {
                    window.apiCache.clearPattern('/api/v1/insights');
                    window.apiCache.clearPattern('/api/v1/stacks');
                }
                
                updatePaginationCounts();
                
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
        const response = await api.removeItemFromStack(parseInt(stackId), insight.id);
        
        if (response.success) {
            // Remove card from local stack data
            stackData.cards = stackData.cards.filter(card => card.id !== insight.id);
            stackData.modifiedAt = response.data?.modified_at || new Date().toISOString();
            
            // Add card back to main insights (safe because of one-to-one constraint)
            currentInsights.push(insight);
            
            // Save to localStorage
            saveInsightsToLocalStorage({ force: true });
            
            // If stack has only one card left, dissolve the stack
            if (stackData.cards.length <= 1) {
                if (stackData.cards.length === 1) {
                    // Remove the last card from stack
                    const lastCard = stackData.cards[0];
                    await api.removeItemFromStack(parseInt(stackId), lastCard.id);
                    currentInsights.push(lastCard);
                }
                stacks.delete(stackId);
                saveStacksToLocalStorage();
                saveInsightsToLocalStorage({ force: true });
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
            
            // Invalidate page caches and update pagination
            pageCache.clear();
            loadedPages.clear();
            
            // Clear GET cache to prevent stale data
            if (window.apiCache) {
                window.apiCache.clearPattern('/api/v1/insights');
                window.apiCache.clearPattern('/api/v1/stacks');
            }
            
            updatePaginationCounts();
            
            // Re-render main view
            renderInsights();
        } else {
            throw new Error(response.message || 'Failed to remove card from stack');
        }
            } catch (error) {
            console.error('❌ Failed to remove card from stack via API:', error);
            
            // Fallback to local storage if API is not implemented
            if (error.message.includes('404') || error.message.includes('Not Found')) {
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
                    saveInsightsToLocalStorage({ force: true });
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
                
                // Invalidate page caches and update pagination
                pageCache.clear();
                loadedPages.clear();
                
                // Clear GET cache to prevent stale data
                if (window.apiCache) {
                    window.apiCache.clearPattern('/api/v1/insights');
                    window.apiCache.clearPattern('/api/v1/stacks');
                }
                
                updatePaginationCounts();
                
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
    
    // Show filter buttons and edit mode button
    const filterButtons = document.getElementById('filterButtons');
    const editModeMainBtn = document.getElementById('editModeBtn');
    
    if (filterButtons) filterButtons.style.display = 'flex';
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
            const response = await api.updateStack(parseInt(stackId), {
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
    
    // Extract clean title
    let cleanTitle = insight.title || 'Untitled';
    
    // For Wikipedia URLs, extract just the article title from URL
    if (insight.url && insight.url.includes('wikipedia.org')) {
        try {
            const urlPath = new URL(insight.url).pathname;
            const articleTitle = urlPath.split('/').pop().replace(/_/g, ' ');
            if (articleTitle && articleTitle !== 'Main_Page') {
                cleanTitle = articleTitle;
            }
        } catch (e) {
            // If URL parsing fails, keep original title
        }
    } else {
        // For other sources, remove source name if it's at the beginning
        const sourceNameForTitle = getSourceName(insight.url);
        if (cleanTitle.startsWith(sourceNameForTitle)) {
            cleanTitle = cleanTitle.substring(sourceNameForTitle.length).trim();
            // Remove leading comma and space if present
            if (cleanTitle.startsWith(',')) {
                cleanTitle = cleanTitle.substring(1).trim();
            }
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
    
    // Use the first tag from insight.tags, or default to "Archive"
    let tagText = 'Archive'; // Default
    let tagId = null;
    
    if (insight.tags && insight.tags.length > 0) {
        const firstTag = insight.tags[0];
        if (typeof firstTag === 'string') {
            tagText = firstTag;
        } else if (firstTag && typeof firstTag === 'object') {
            tagText = firstTag.name || 'Archive';
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
    
    // Click handler to view full content
    card.addEventListener('click', (e) => {
        if (!e.target.closest('.content-card-delete-btn')) {
            // Open content detail modal (reuse existing functionality)
            openContentDetailModal(insight);
        }
    });
    
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
        // Get all available tags
        const response = await getCachedUserTags();
        const allTags = response.success ? response.data : [];
        
        // Get current tags for this insight
        const currentTags = insight.tags || [];
        
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
                                
                                return matches;
                            });
                            
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
        
        // Prepare the update data - backend expects tag_ids, not tags
        const updateData = {
            ...insight,
            tag_ids: selectedTags.map(tag => tag.id)
        };
        
        // Update insight with new tag (single selection)
        const response = await api.updateInsight(insight.id, updateData);
        
        if (response.success) {
            // Clear cache for insights endpoint to ensure fresh data
            if (window.apiCache) {
                window.apiCache.clearPattern('/api/v1/insights');
            }
            
            clearPageCache(); // 清除缓存，因为数据已变化
            // Reload insights from backend to ensure we have the latest data
            await loadUserInsightsWithPagination();
            
            // Also save to localStorage backup
            saveInsightsToLocalStorage({ force: true });
            
            // Force re-render to show updated tags
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
        // First, get all existing tags
        const response = await getCachedUserTags();
        const existingTags = response.success ? response.data : [];
        
        // Delete all existing tags
        for (const tag of existingTags) {
            try {
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
        await loadUserTags();
        await initFilterButtons();
        
        // Verify the tags were created correctly
        const verifyResponse = await api.getUserTags();
        const finalTags = verifyResponse.success ? verifyResponse.data : [];
        
        showSuccessMessage('Tags updated successfully! Now using: Project, Area, Resource, Archive');
        
    } catch (error) {
        console.error('❌ Tag replacement failed:', error);
        showErrorMessage(`Failed to replace tags: ${error.message}`);
    }
}

// Setup PARA tooltips for filter options
function setupPARATooltips(dropdownOptions) {
    const paraExplanations = {
        'P': {
            title: 'Projects',
            description: 'A series of tasks linked to a specific goal, with a deadline. Once the goal is accomplished, the project moves to the archive.',
            examples: 'Examples: Planning a vacation, publishing a blog post, or preparing a presentation.'
        },
        'A': {
            title: 'Areas',
            description: 'A sphere of ongoing activity that requires a certain standard to be maintained over time, but has no specific deadline.',
            examples: 'Examples: Health, finances, personal development, or professional duties.'
        },
        'R': {
            title: 'Resources',
            description: 'A topic of ongoing interest that may be useful in the future. It is not tied to a specific project or area of responsibility.',
            examples: 'Examples: Notes on a book, an idea for a future project, or a collection of articles about a hobby.'
        },
        'Archive': {
            title: 'Archive',
            description: 'Completed projects and inactive items that are no longer actively being worked on but may be referenced in the future.',
            examples: 'Examples: Finished presentations, completed reports, or old project files that are kept for reference.'
        }
    };

    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'para-tooltip';
    tooltip.style.cssText = `
        position: absolute;
        background: #1f2937;
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        max-width: 300px;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.2s ease, visibility 0.2s ease;
        pointer-events: none;
    `;
    document.body.appendChild(tooltip);

    // Add event listeners to info icons
    dropdownOptions.addEventListener('mouseenter', (e) => {
        const infoIcon = e.target.closest('.filter-option-info');
        if (infoIcon) {
            const category = infoIcon.dataset.category;
            const explanation = paraExplanations[category];
            
            if (explanation) {
                tooltip.innerHTML = `
                    <div style="font-weight: 600; margin-bottom: 8px; color: #f3f4f6;">${explanation.title}</div>
                    <div style="margin-bottom: 8px; line-height: 1.4;">${explanation.description}</div>
                    <div style="font-size: 12px; color: #9ca3af; font-style: italic;">${explanation.examples}</div>
                `;
                
                // Position tooltip
                const rect = infoIcon.getBoundingClientRect();
                tooltip.style.left = `${rect.right + 8}px`;
                tooltip.style.top = `${rect.bottom + 200}px`;
                
                tooltip.style.opacity = '1';
                tooltip.style.visibility = 'visible';
            }
        }
    }, true);

    dropdownOptions.addEventListener('mouseleave', (e) => {
        const infoIcon = e.target.closest('.filter-option-info');
        if (infoIcon) {
            tooltip.style.opacity = '0';
            tooltip.style.visibility = 'hidden';
        }
    }, true);
}

// Test function to verify filter functionality
function testFilterFunctionality() {
    console.log('🧪 Testing filter functionality...');
    
    // Test 1: Check if filter buttons exist
    const filterButtons = document.getElementById('filterButtons');
    if (!filterButtons) {
        console.error('❌ Filter buttons container not found');
        return false;
    }
    
    // Test 2: Check if filter button containers exist
    const filterContainers = filterButtons.querySelectorAll('.filter-button-container');
    console.log('🔍 Found filter containers:', filterContainers.length);
    
    // Test 3: Check if PARA options exist
    const tagFilterContainer = filterButtons.querySelector('[data-filter="tags"]')?.closest('.filter-button-container');
    if (tagFilterContainer) {
        const paraOptions = tagFilterContainer.querySelectorAll('.filter-option[data-filter="project"], .filter-option[data-filter="area"], .filter-option[data-filter="resource"], .filter-option[data-filter="archive"]');
        console.log('🔍 Found PARA options:', paraOptions.length);
        
        // Test 4: Check if info icons exist
        const infoIcons = tagFilterContainer.querySelectorAll('.filter-option-info');
        console.log('🔍 Found info icons:', infoIcons.length);
    }
    
    // Test 5: Check current filters
    console.log('🔍 Current filters:', currentFilters);
    
    // Test 6: Check if insights exist
    console.log('🔍 Current insights count:', currentInsights.length);
    
    console.log('✅ Filter functionality test completed');
    return true;
}

// Make test function globally available
window.testFilterFunctionality = testFilterFunctionality;

// Test function to manually test filtering with current data
function testFiltering() {
    console.log('🧪 Testing filtering with current data...');
    
    // Test with 'area' filter
    console.log('🔍 Testing area filter...');
    const testFilter = { latest: 'latest', tags: 'area' };
    const originalFilters = { ...currentFilters };
    
    // Temporarily set the filter
    currentFilters.tags = 'area';
    
    // Get filtered insights
    const filtered = getFilteredInsights();
    console.log('📊 Filtered insights for area:', filtered.length);
    
    // Restore original filters
    currentFilters.tags = originalFilters.tags;
    
    return filtered;
}

// Make test function globally available
window.testFiltering = testFiltering;

// Function to clear all filters and show all insights
function clearAllFilters() {
    console.log('🧹 Clearing all filters...');
    
    currentFilters = {
        latest: 'latest',
        tags: 'all'  // Set to 'all' instead of null for consistency
    };
    
    // Clear the global insights for filtering
    window.allInsightsForFiltering = null;
    
    // Update filter button displays
    updateFilterButtonDisplay('latest', 'latest');
    updateFilterButtonDisplay('tags', 'all');
    
    // Update button states
    updateFilterButtonStates();
    
    // Show filter status
    showFilterStatus();
    
    // Re-render with all insights
    resetInsightsPaginationAndRerender();
    
    console.log('✅ All filters cleared');
}

// Make clear filters function globally available
window.clearAllFilters = clearAllFilters;


