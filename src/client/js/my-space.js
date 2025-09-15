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

// DOM Elements - Using cached access for better performance
const profileAvatar = getCachedElementById('profileAvatar');
const usernamePlaceholder = getCachedElementById('usernamePlaceholder');
const contentCards = getCachedElementById('contentCards');
const headerLogout = getCachedElementById('headerLogout');
const headerEditProfile = getCachedElementById('headerEditProfile');
const headerEmailPreferences = getCachedElementById('headerEmailPreferences');
const headerAvatar = getCachedElementById('headerAvatar');
const addContentForm = getCachedElementById('addContentForm');
const addContentModal = getCachedElementById('addContentModal');
const closeAddModal = getCachedElementById('closeAddModal');
const cancelAddBtn = getCachedElementById('cancelAddBtn');

const filterButtons = getCachedElementById('filterButtons');

// Page state
let currentUser = null;
let currentInsights = [];
// Make currentInsights globally accessible for event handlers
window.currentInsights = currentInsights;
// Cache for user tags to reduce API calls
let cachedUserTags = null;
let userTagsCacheTime = 0;
const USER_TAGS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let currentFilters = {
    latest: 'latest',  // Time sorting
    tags: null,        // Tag filtering
    search: ''         // Search filtering
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

// Flag to prevent auto-save during comment editing
let isCommentEditing = false;

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

// Pagination related variables
let currentPage = 1;
let totalPages = 1;
let totalInsights = 0;
let insightsPerPage = 9; // Display 9 insights per page

// 页面缓存机制
let pageCache = new Map(); // Cache data for each page
let loadedPages = new Set(); // Track loaded pages

// Initialize pagination functionality
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

// Update pagination UI
function updatePaginationUI() {
    console.log(`🔍 DEBUG: updatePaginationUI called - currentPage=${currentPage}, totalPages=${totalPages}`);
    
    const currentPageEl = document.getElementById('currentPage');
    const totalPagesEl = document.getElementById('totalPages');
    const totalInsightsEl = document.getElementById('totalInsights');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const paginationPages = document.getElementById('paginationPages');
    
    if (currentPageEl) {
        currentPageEl.textContent = currentPage;
        console.log(`🔍 DEBUG: Set currentPageEl to ${currentPage}`);
    }
    if (totalPagesEl) {
        totalPagesEl.textContent = totalPages;
        console.log(`🔍 DEBUG: Set totalPagesEl to ${totalPages}`);
    }
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
    
    // Update button state
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
    }
    
    // Generate page number buttons
    if (paginationPages) {
        paginationPages.innerHTML = '';
        generatePageNumbers(paginationPages);
    }
}

// Generate page number buttons
function generatePageNumbers(container) {
    const maxVisiblePages = 5; // Maximum 5 page number buttons
    
    if (totalPages <= maxVisiblePages) {
        // If total pages are few, show all page numbers
        for (let i = 1; i <= totalPages; i++) {
            createPageButton(container, i);
        }
    } else {
        // If total pages are many, show smart pagination
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        // Adjust start page to ensure maxVisiblePages buttons are shown
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        // First page
        if (startPage > 1) {
            createPageButton(container, 1);
            if (startPage > 2) {
                createEllipsis(container);
            }
        }
        
        // Middle page numbers
        for (let i = startPage; i <= endPage; i++) {
            createPageButton(container, i);
        }
        
        // Last page
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                createEllipsis(container);
            }
            createPageButton(container, totalPages);
        }
    }
}

// Create page number button
function createPageButton(container, pageNum) {
    const pageBtn = document.createElement('button');
    pageBtn.className = `pagination-page ${pageNum === currentPage ? 'active' : ''}`;
    pageBtn.textContent = pageNum;
    pageBtn.addEventListener('click', () => goToPage(pageNum));
    container.appendChild(pageBtn);
}

// Create ellipsis
function createEllipsis(container) {
    const ellipsis = document.createElement('span');
    ellipsis.className = 'pagination-page ellipsis';
    ellipsis.textContent = '...';
    container.appendChild(ellipsis);
}

// Navigate to specified page
async function goToPage(pageNum, { force = false } = {}) {
    console.log(`🔍 DEBUG: goToPage called with pageNum=${pageNum}, force=${force}`);
    console.log(`🔍 DEBUG: Current state - currentPage=${currentPage}, totalPages=${totalPages}, totalInsights=${totalInsights}`);
    
    if (!force && (pageNum < 1 || pageNum > totalPages || pageNum === currentPage)) {
        console.log(`🔍 DEBUG: Skipping page navigation - pageNum=${pageNum}, totalPages=${totalPages}, currentPage=${currentPage}`);
        return;
    }
    
    try {
        console.log(`🔍 DEBUG: Before setting - currentPage=${currentPage}, pageNum=${pageNum}`);
        currentPage = pageNum;
        insightsPage = pageNum; // Update global variable
        
        console.log(`🔍 DEBUG: After setting - currentPage=${currentPage}, insightsPage=${insightsPage}`);
        
        // Show loading state
        showLoadingState();
        
        // If force is true, skip cache and fetch fresh data
        if (force) {
            pageCache.delete(pageNum);
            console.log(`🔍 DEBUG: Force mode - cleared cache for page ${pageNum}`);
        }
        
        // Check if page data is already cached
        if (!force && pageCache.has(pageNum)) {
            console.log(`📋 Loading page ${pageNum} data from cache`);
            const cachedData = pageCache.get(pageNum);
            console.log(`🔍 DEBUG: Cached data for page ${pageNum}:`, cachedData);
            // Defensive normalization for nested array issue
            const maybeNested = cachedData.insights;
            currentInsights = Array.isArray(maybeNested?.[0]) ? maybeNested[0] : maybeNested;
            window.currentInsights = currentInsights;
            insightsHasMore = cachedData.hasMore;
            
            console.log(`🔍 DEBUG: Loaded from cache - currentInsights.length=${currentInsights.length}`);
            console.log(`🔍 DEBUG: Cached insights:`, currentInsights.map(i => ({ id: i.id, title: i.title })));
            
            // Update rendered IDs
            renderedInsightIds.clear();
            currentInsights.forEach(i => renderedInsightIds.add(i.id));
        } else {
            // Not in cache, call API to load
            console.log(`🔄 Loading page ${pageNum} data from API...`);
            
            // Use pagination API to load target page (over-fetch on page 1 to account for stacked insights)
            const effectiveLimit = effectiveFetchLimitForPage(pageNum);
            const uid = (auth?.user?.id || currentUser?.id || undefined);
            
            console.log(`🔍 DEBUG: API call parameters - pageNum=${pageNum}, effectiveLimit=${effectiveLimit}, uid=${uid}`);
            
            // For page 2+, we need to get insights that weren't shown on page 1
            // Since the API doesn't know about stacks, we need to calculate the offset
            let apiPage = pageNum;
            let apiLimit = effectiveLimit;
            
            if (pageNum > 1) {
                // Calculate how many insights were actually shown on page 1
                const stacksCount = stacks.size;
                const page1SlotsForInsights = Math.max(0, insightsPerPage - stacksCount);
                
                // For page 2, we want to get insights starting from after page 1's insights
                // But since the API doesn't know about stacks, we need to get all insights and slice them
                apiPage = 1; // Always get page 1 from API
                apiLimit = 100; // Get a large number to get all insights
                console.log(`🔍 DEBUG: Page ${pageNum} - using API page 1 with limit ${apiLimit} to get all insights`);
            }
            
            const targetPageResponse = await api.getInsightsPaginated(apiPage, apiLimit, uid, '', true);
            console.log(`🔍 DEBUG: API response for page ${pageNum}:`, targetPageResponse);
            
            if (targetPageResponse?.success) {
                const { items, hasMore } = normalizePaginatedInsightsResponse(targetPageResponse);
                console.log(`🔍 DEBUG: Normalized response - items.length=${items?.length}, hasMore=${hasMore}`);
                console.log(`🔍 DEBUG: Raw items:`, items?.map(i => ({ id: i.id, title: i.title, stack_id: i.stack_id })));
                
                let targetPageInsights = (items || []).filter(x => !x.stack_id);
                console.log(`🔍 DEBUG: Filtered insights (no stack_id): ${targetPageInsights.length}`);
                console.log(`🔍 DEBUG: Filtered insights:`, targetPageInsights.map(i => ({ id: i.id, title: i.title })));
                
                // For page 2+, slice the insights to get the correct subset
                if (pageNum > 1) {
                    const stacksCount = stacks.size;
                    const page1SlotsForInsights = Math.max(0, insightsPerPage - stacksCount);
                    const startIndex = page1SlotsForInsights;
                    const endIndex = startIndex + insightsPerPage;
                    
                    targetPageInsights = targetPageInsights.slice(startIndex, endIndex);
                    console.log(`🔍 DEBUG: Page ${pageNum} slicing - startIndex=${startIndex}, endIndex=${endIndex}, sliced insights=${targetPageInsights.length}`);
                    console.log(`🔍 DEBUG: Sliced insights:`, targetPageInsights.map(i => ({ id: i.id, title: i.title })));
                }
                
                // Update pagination info from API response
                updatePaginationInfo(targetPageResponse.data);
                console.log(`🔍 DEBUG: Updated pagination - totalPages=${totalPages}, totalInsights=${totalInsights}`);
                
                // Fix pagination calculation for stacks
                // The API doesn't know about stacks, so we need to recalculate totalPages
                // based on how many insights can actually fit on each page
                const stacksCount = stacks.size;
                const page1SlotsForInsights = Math.max(0, insightsPerPage - stacksCount);
                const remainingInsights = Math.max(0, totalInsights - page1SlotsForInsights);
                
                // Recalculate totalPages based on actual page capacity
                totalPages = remainingInsights > 0 ? 2 : 1;
                console.log(`🔍 DEBUG: Recalculated pagination - stacksCount=${stacksCount}, page1SlotsForInsights=${page1SlotsForInsights}, remainingInsights=${remainingInsights}, totalPages=${totalPages}`);
                
                // De-dupe page 2+ against what page 1 actually rendered
                let adjusted = targetPageInsights;
                
                // Only de-dupe when not filtering by tag (stacks hidden under filters)
                const hasActiveTagFilter = currentFilters.tags && currentFilters.tags !== 'all';
                console.log(`🔍 DEBUG: De-duplication check - hasActiveTagFilter=${hasActiveTagFilter}, pageNum=${pageNum}`);
                
                if (!hasActiveTagFilter && pageNum > 1) {
                    const prevVisible = getVisibleIdsForPage(pageNum - 1);
                    console.log(`🔍 DEBUG: Previous page visible IDs:`, Array.from(prevVisible));
                    
                    if (prevVisible.size > 0) {
                        // De-duplicate against what was actually visible on the previous page
                        const beforeCount = adjusted.length;
                        adjusted = adjusted.filter(i => !prevVisible.has(i.id));
                        console.log(`🔄 Page ${pageNum} de-duplicated: ${beforeCount} -> ${adjusted.length} insights`);
                        console.log(`🔍 DEBUG: After de-duplication:`, adjusted.map(i => ({ id: i.id, title: i.title })));
                    } else {
                        // If previous page isn't cached, don't do any de-duplication
                        // This prevents incorrectly removing insights from page 2
                        console.log(`⚠️ Page ${pageNum}: Previous page not cached, skipping de-duplication`);
                    }
                } else {
                    console.log(`🔍 DEBUG: Skipping de-duplication - hasActiveTagFilter=${hasActiveTagFilter}, pageNum=${pageNum}`);
                }
                
                // Update current page data
                currentInsights = adjusted;
                window.currentInsights = currentInsights;
                insightsHasMore = hasMore;
                
                console.log(`🔍 DEBUG: Final currentInsights for page ${pageNum}:`, currentInsights.length, 'insights');
                console.log(`🔍 DEBUG: Final insights:`, currentInsights.map(i => ({ id: i.id, title: i.title })));
                
                // Update rendered IDs（基于 adjusted）
                renderedInsightIds.clear();
                adjusted.forEach(i => renderedInsightIds.add(i.id));
                
                // Cache this page data (save adjusted, not original)
                pageCache.set(pageNum, {
                    insights: adjusted,        // ❗ was [...adjusted]
                    hasMore,
                    timestamp: Date.now()
                });
                loadedPages.add(pageNum);
                
                console.log(`📄 Page ${pageNum} loaded and cached: ${adjusted.length} insights (original: ${targetPageInsights.length})`);
            } else {
                throw new Error(`Failed to load page ${pageNum}`);
            }
        }
        
        // Re-render insights (only show current page data)
        renderInsights();
        
        // Update UI
        updatePaginationUI();
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        console.log(`🔍 DEBUG: After goToPage - currentPage=${currentPage}, totalPages=${totalPages}`);
    } catch (error) {
        console.error('❌ Failed to go to page:', error);
        showErrorMessage('Failed to load page. Please try again.');
    } finally {
        hideLoadingState();
    }
}

// Update pagination info
function updatePaginationInfo(data) {
    const pagination = data.pagination || {};
    totalPages = pagination.total_pages || 1;
    totalInsights = pagination.total || 0;
    // Don't update currentPage from API response as it might reset our navigation
    // currentPage = pagination.page || 1;
    console.log(`🔍 DEBUG: updatePaginationInfo - totalPages=${totalPages}, totalInsights=${totalInsights}, currentPage=${currentPage} (not updated from API)`);
}

// Show loading state
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

// Hide loading state
function hideLoadingState() {
    const overlay = document.getElementById('loadingSkeleton');
    if (overlay) overlay.remove();
}

// Clear page cache
function clearPageCache() {
    pageCache.clear();
    loadedPages.clear();
    console.log('🗑️ Page cache cleared');
}

// Get cache status info
function getCacheStatus() {
    return {
        cachedPages: Array.from(loadedPages),
        cacheSize: pageCache.size,
        totalPages: totalPages
    };
}

// Modify loadUserInsights function to support pagination
async function loadUserInsightsWithPagination() {
    try {
        insightsLoading = true;
        showLoadingState();
        
        // Clear previous cache
        clearPageCache();
        
        // Step 1: Quickly load first page
        console.log('🚀 Starting first page data request...');
        const startTime = Date.now();
        const effectiveLimit = effectiveFetchLimitForPage(1);
        const uid = (auth?.user?.id || currentUser?.id || undefined);
        
        console.log('🔍 API Request Details:', {
            page: 1,
            limit: effectiveLimit,
            userId: uid,
            search: '',
            includeTags: true
        });
        
        // Debug: Check what's in localStorage backup
        const backupInsights = localStorage.getItem('quest_insights_backup');
        if (backupInsights) {
            try {
                const backup = JSON.parse(backupInsights);
                console.log('📦 localStorage backup insights:', backup.data?.length || 0, 'insights');
                console.log('📦 Sample backup insights:', backup.data?.slice(0, 2));
                if (backup.data?.length > 0) {
                    console.log('📦 Backup insight properties:', Object.keys(backup.data[0]));
                    console.log('📦 Backup insight stack_id values:', backup.data.map(i => ({ id: i.id, stack_id: i.stack_id })));
                }
            } catch (e) {
                console.error('❌ Failed to parse backup for debugging:', e);
            }
        }
        
        let firstPageResponse;
        try {
            firstPageResponse = await api.getInsightsPaginated(1, effectiveLimit, uid, '', true);
            const endTime = Date.now();
            console.log(`⏱️ First page API request time: ${endTime - startTime}ms`);
            console.log('📡 First page API response:', firstPageResponse);
        } catch (apiError) {
            console.warn('⚠️ API request failed, trying to load from local backup:', apiError.message);
            // If API request fails (possibly authentication issue), try loading from local backup
            const backupInsights = localStorage.getItem('quest_insights_backup');
            if (backupInsights) {
                try {
                    const backup = JSON.parse(backupInsights);
                    if (backup.data && backup.data.length > 0) {
                        console.log('📦 Loading insights from local backup:', backup.data.length, 'items');
                        firstPageResponse = {
                            success: true,
                            data: {
                                items: backup.data,
                                pagination: {
                                    page: 1,
                                    total_pages: 1,
                                    total: backup.data.length,
                                    has_more: false
                                }
                            }
                        };
                    } else {
                        throw new Error('Local backup is empty');
                    }
                } catch (backupError) {
                    console.error('❌ Failed to parse local backup:', backupError);
                    throw apiError; // 重新抛出原始API错误
                }
            } else {
                throw apiError; // 重新抛出原始API错误
            }
        }
        
        if (firstPageResponse?.success) {
            const { items, hasMore } = normalizePaginatedInsightsResponse(firstPageResponse);
            console.log('📦 Raw API items before filtering:', items?.length || 0, 'items');
            console.log('📦 Sample raw items:', items?.slice(0, 2));
            
            let firstPageInsights = (items || []).filter(x => !x.stack_id);
            console.log('📦 Filtered insights (no stack_id):', firstPageInsights.length, 'insights');
            console.log('📦 Sample filtered insights:', firstPageInsights.slice(0, 2));
            
            // Retry once if page 1 returns 0 items and we now have a user ID
            if (firstPageInsights.length === 0 && uid) {
                console.log('🔄 Page 1 returned 0 items, retrying with user ID...');
                // Clear any stale cached responses before retrying
                if (window.apiCache) {
                    window.apiCache.clearPattern('/api/v1/insights');
                }
                
                const retryResponse = await api.getInsightsPaginated(1, effectiveLimit, uid, '', true);
                console.log('📡 Retry API response:', retryResponse);
                if (retryResponse?.success) {
                    const { items: retryItems, hasMore: retryHasMore } = normalizePaginatedInsightsResponse(retryResponse);
                    console.log('📦 Retry raw items:', retryItems?.length || 0, 'items');
                    firstPageInsights = (retryItems || []).filter(x => !x.stack_id);
                    console.log(`🔄 Retry returned ${firstPageInsights.length} insights`);
                    console.log('📦 Retry filtered insights:', firstPageInsights.slice(0, 2));
                }
            }
            
            // First set first page data
            currentInsights = firstPageInsights;
            window.currentInsights = currentInsights;
            insightsPage = 1;
            insightsHasMore = hasMore;
            renderedInsightIds.clear();
            firstPageInsights.forEach(i => renderedInsightIds.add(i.id));
            if (currentInsights.length > 0) hasLoadedInsightsOnce = true;
            
            // Cache first page data (store only what we actually display)
            const displayedInsights = firstPageInsights.slice(0, effectiveLimitForPage(1));
            pageCache.set(1, {
                insights: displayedInsights,  // ✅ Store only what we display
                hasMore: hasMore,
                timestamp: Date.now()
            });
            loadedPages.add(1);
            
            // Get pagination info from API response
            updatePaginationInfo(firstPageResponse.data);
            
            // Normalize tag structure
            currentInsights.forEach(insight => {
                if (insight.tags && insight.tags.length > 0) {
                    insight.tags = insight.tags.map(tag => ({
                        id: tag.tag_id || tag.id,
                        name: tag.name,
                        color: tag.color
                    }));
                }
            });
            
            // Immediately render first page (don't wait for tag loading)
            renderInsights();
            updatePaginationUI();
            
            // Asynchronously load tags, don't block rendering
            setTimeout(async () => {
                const insightsWithoutTags = currentInsights.filter(insight => !insight.tags || insight.tags.length === 0);
                if (insightsWithoutTags.length > 0) {
                    try {
                        await loadTagsForInsights(insightsWithoutTags);
                        // Re-render after tag loading is complete
                        renderInsights();
                    } catch (error) {
                        console.warn('⚠️ Tag loading failed:', error);
                    }
                }
            }, 10);
            
            console.log(`✅ First page loaded: ${firstPageInsights.length} insights, total pages: ${totalPages}`);
            console.log(`📋 Cache status: cached pages ${Array.from(loadedPages).join(', ')}`);
            
            // If API returned 0 insights, try loading from backup
            if (firstPageInsights.length === 0) {
                console.log('🔄 API returned 0 insights, trying to load from backup...');
                loadFromBackup();
            }
        } else {
            // Try to load backup from localStorage
            loadFromBackup();
        }
    } catch (error) {
        console.error('❌ Failed to load user insights:', error);
        loadFromBackup();
    } finally {
        insightsLoading = false;
        hideLoadingState();
    }
}

// loadAllInsightsInBackground function removed - using pagination only

// loadRemainingInsightsInBackground function removed - using pagination only

// Load data from backup
function loadFromBackup() {
    console.log('🔄 Loading from backup...');
    const backupInsights = localStorage.getItem('quest_insights_backup');
    let restoredFromBackup = false;
    
    console.log('📦 Backup insights found:', !!backupInsights);
    
    if (backupInsights) {
        try {
            const backup = JSON.parse(backupInsights);
            console.log('📦 Parsed backup data:', backup);
            if (Array.isArray(backup.data)) {
                currentInsights = backup.data;
                window.currentInsights = currentInsights;
                console.log('📦 Set currentInsights to:', currentInsights.length, 'insights');
                if (currentInsights.length > 0) {
                    hasLoadedInsightsOnce = true;
                    restoredFromBackup = true;
                    console.log('✅ Restored insights from backup:', currentInsights.length, 'insights');
                }
            } else {
                console.log('⚠️ Backup data is not an array:', backup);
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
    
    // Set default pagination info (insights only)
    totalPages = Math.max(1, Math.ceil(currentInsights.length / insightsPerPage));
    totalInsights = currentInsights.length;
    currentPage = 1;
    
    console.log('📊 Backup loading stats:', { 
        totalInsights, 
        totalPages, 
        currentPage, 
        restoredFromBackup 
    });
    
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

// Start API warming immediately on page load
(async function warmupAPI() {
    console.log('🔥 Starting API server warming...');
    checkDataRecoveryStatus(); // Check data recovery status
    
    const warmupStart = Date.now();
    try {
        await fetch(`${API_CONFIG.API_BASE_URL}/health`, { 
            method: 'GET',
            mode: 'cors'
        });
        const warmupEnd = Date.now();
        console.log(`🔥 API server warming completed: ${warmupEnd - warmupStart}ms`);
    } catch (error) {
        console.log('⚠️ API server warming failed:', error.message);
    }
})();

// Page initialization
async function initPage() {
    try {
        console.log('🚀 Starting My Space page initialization...');
        console.log('🔍 Current page path:', window.location.pathname);
        console.log('🔍 DOM loading state:', document.readyState);
        console.log('🔍 Page title:', document.title);
        
        // Restore session state
        const restored = auth.restoreSession();
        console.log('🔍 Session restore result:', restored);
        
        // Check authentication status
        const isAuthenticated = auth.checkAuth();
        console.log('🔍 Authentication status:', isAuthenticated);
        
        if (!isAuthenticated) {
            console.log('⚠️ User not authenticated, showing error message and loading local backup');
            showErrorMessage('Please sign in. Showing last local backup.');
            
            // Even if not authenticated, bind basic UI events (like user profile editing)
            bindProfileEditEvents();
            
            // Don't return, allow loading local backup data
        } else {
            console.log('✅ User authenticated, continuing to load data');
        }
        
        // Check if token is expired (relaxed: allow continuing to load basic UI even if not expired)
        const tokenOk = await auth.checkAndHandleTokenExpiration();
        if (!tokenOk) {
            // Token validation failed, continue to load My Space UI in degraded mode
        }
        
        // API server has been warmed up on page load
        
        // Prioritize loading core data, including stacks
        const [profileResult, insightsResult, tagsResult, stacksResult] = await Promise.allSettled([
            loadUserProfile(),
            loadUserInsightsWithPagination(),
            loadUserTags(),
            loadUserStacks()
        ]);
        
        // If stacks loading fails, try to restore directly from localStorage
        if (stacksResult.status === 'rejected') {
            console.error('❌ Failed to load stacks:', stacksResult.reason);
            const savedStacks = localStorage.getItem('quest_stacks');
            if (savedStacks) {
                try {
                    const entries = JSON.parse(savedStacks);
                    console.log('🔄 Restoring stacks directly from localStorage:', entries.length, 'entries');
                    entries.forEach(([id, data]) => {
                        const stringId = String(id);
                        data.id = stringId;
                        stacks.set(stringId, data);
                    });
                    if (stacks.size > 0) {
                        hasLoadedStacksOnce = true;
                        console.log('✅ Successfully restored', stacks.size, 'stacks from localStorage');
                    }
                } catch (e) {
                    console.error('❌ Failed to parse localStorage stacks:', e);
                }
            }
        }
        
        // Check each loading result and log errors
        if (profileResult.status === 'rejected') {
            console.error('❌ Failed to load user profile:', profileResult.reason);
        }
        if (insightsResult.status === 'rejected') {
            console.error('❌ Failed to load user insights:', insightsResult.reason);
        }
        if (tagsResult.status === 'rejected') {
            console.error('❌ Failed to load user tags:', tagsResult.reason);
        }
        
        // Initialize filter buttons
        initFilterButtons();
        
        // Bind events
        bindEvents();
        
        // Bind edit mode button events
        bindEditModeEvents();
        
        // Set up event delegation for card interactions (performance optimization)
        setupCardEventDelegation();
        
        // Set up authentication listener to reload stacks when user logs in
        setupAuthListener();
        
        // Initialize search functionality
        initSearch();
        
        // Initialize pagination
        initPagination();
        
        // Handle deep linking for stack views
        const { viewMode: initialViewMode, stackId } = parseRoute();
        if (initialViewMode === 'stack' && stackId) {
            // Navigate to stack view
            renderStackView(stackId);
        } else {
            // Final render after all data is loaded
            renderInsights();
        }
        
        // Ensure edit mode is always off when entering My Space page
        if (document.body.classList.contains('edit-mode')) {
            console.log('🔄 My Space page loaded, disabling edit mode');
            document.body.classList.remove('edit-mode');
            isEditMode = false;
            updateEditModeState();
        }
        
        // Force show content area to ensure page is visible
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.style.display = 'block';
            mainContent.style.opacity = '1';
            mainContent.style.visibility = 'visible';
        }
        
        // Ensure content cards container is visible
        if (contentCards) {
            contentCards.style.opacity = '1';
            contentCards.style.visibility = 'visible';
        }
        
        console.log('✅ Page content area forced to show');
        
        // If no content, ensure empty state is shown
        setTimeout(() => {
            if (contentCards && contentCards.children.length === 0) {
                console.log('⚠️ No content detected, forcing empty state display');
                const emptyState = document.createElement('div');
                emptyState.className = 'empty-state';
                emptyState.innerHTML = `
                    <div class="empty-state-icon">📚</div>
                    <h3>Welcome to My Space!</h3>
                    <p>Start adding your favorite media content to your collection</p>
                    <button class="btn btn-primary add-content-btn" onclick="showAddContentModal()">
                        Add Content
                    </button>
                `;
                contentCards.appendChild(emptyState);
            }
        }, 100);
        
        // Pagination mode: no infinite scroll needed
    } catch (error) {
        console.error('❌ Page initialization failed:', error);
        
        // If authentication error, redirect to login page
        if (error.message.includes('Authentication expired') || error.message.includes('Please login again')) {
            window.location.href = PATHS.LOGIN;
            return;
        }
        
        showErrorMessage('Page initialization failed, please refresh and try again');
    }
}

// Load user stacks
async function loadUserStacks() {
    try {
        // Allow loading from localStorage even when not authenticated to avoid data loss
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
                    console.error('❌ Failed to parse local stacks:', e);
                }
            }
            
            // Mark stacks as loaded regardless of whether any were found
            hasLoadedStacksOnce = true;
            console.log('✅ Stacks loading process completed (unauthenticated). Found', stacks.size, 'stacks');
            
            // Don't continue calling backend when not authenticated
            return;
        }
        
        // Load stacks and populate them with ALL insights to show correct counts
        let allInsights = [];
        const uid = (auth?.user?.id || currentUser?.id || undefined);
        
        // Load stacks directly from the stack API
        console.log('🔍 Loading stacks from API...');
        const stacksResponse = await api.getUserStacks(uid);
        console.log('📡 Stacks API response:', stacksResponse);
        
        // Process stacks from API response
        if (stacksResponse && stacksResponse.success && stacksResponse.data) {
            console.log('📦 Processing stacks from API:', stacksResponse.data.length, 'stacks');
            console.log('📦 Raw API response data:', stacksResponse.data);
            stacksResponse.data.forEach(stack => {
                const stackData = {
                    id: String(stack.id),
                    name: stack.name || 'Stack',
                    description: stack.description || 'A collection of related content',
                    cards: [], // Will be populated from insights
                    createdAt: stack.created_at || new Date().toISOString(),
                    modifiedAt: stack.updated_at || new Date().toISOString(),
                    isExpanded: false
                };
                console.log('📦 Loading stack:', { id: stack.id, name: stack.name, description: stack.description });
                stacks.set(String(stack.id), stackData);
            });
            console.log('✅ Loaded', stacks.size, 'stacks from API');
            console.log('📦 Final stacks map:', Array.from(stacks.entries()));
        } else {
            console.log('⚠️ No stacks found in API response or API failed');
        }
        
        // Fetch ALL insights to properly populate stack counts
        console.log('🔍 Fetching ALL insights to populate stack counts...');
        const response = await api.getInsightsPaginated(1, 100, uid, '', true);
        
        if (response.success && response.data) {
            const { items } = normalizePaginatedInsightsResponse(response);
            if (items && items.length > 0) {
                allInsights = items;
                console.log(`📦 Fetched ${allInsights.length} insights for stack population`);
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
                
                // Update stackIdCounter
                if (stacks.size > 0) {
                    const maxTimestamp = Math.max(...Array.from(stacks.keys()).map(id => {
                        const timestamp = id.split('_')[1];
                        return timestamp ? parseInt(timestamp) : 0;
                    }));
                    stackIdCounter = maxTimestamp + 1;
                }
            
            // Validate one-to-one constraint (now guaranteed by database)
            const allInsightIds = new Set();
            let hasDuplicates = false;
            
            stacks.forEach(stack => {
                stack.cards.forEach(card => {
                    if (allInsightIds.has(card.id)) {
                    console.warn('⚠️ Found duplicate insight ID:', card.id, 'violating one-to-one constraint');
                        hasDuplicates = true;
                    }
                    allInsightIds.add(card.id);
                });
            });
            
            if (hasDuplicates) {
                console.error('❌ Data violates one-to-one constraint, please check backend data');
            }
            
                        if (stacks.size > 0) hasLoadedStacksOnce = true;
        } catch (error) {
            console.error('❌ Failed to load user stacks:', error);
            // If stacks endpoint does not exist, continue using local storage
            if (error.message.includes('404') || error.message.includes('Not Found')) {
                console.log('⚠️ Stacks API endpoint not implemented yet, using local storage mode');
            }
            
            // If authentication fails, try to restore stacks data from localStorage
            if (error.message.includes('401') || error.message.includes('403') || error.message.includes('Authentication')) {
                console.log('🔍 Authentication failed, trying to restore stacks data from localStorage...');
                const savedStacks = localStorage.getItem('quest_stacks');
                if (savedStacks) {
                    try {
                        const entries = JSON.parse(savedStacks);
                        console.log('📦 Restoring stacks from localStorage:', entries.length, 'entries');
                        entries.forEach(([id, data]) => {
                            const stringId = String(id);
                            data.id = stringId;
                            stacks.set(stringId, data);
                        });
                        if (stacks.size > 0) hasLoadedStacksOnce = true;
                        console.log('✅ Successfully restored', stacks.size, 'stacks from localStorage');
                    } catch (e) {
                        console.error('❌ Failed to parse localStorage stacks:', e);
                    }
                }
            }
            // Do not throw error, allow page to continue loading
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

// Load user profile
async function loadUserProfile() {
    try {
        // Check authentication status，如果未认证则使用本地数据
        if (!auth.checkAuth()) {
            console.log('⚠️ User not authenticated, using local user data');
            const localUser = auth.getCurrentUser();
            if (localUser) {
                currentUser = localUser;
                updateUserProfileUI();
                return;
            }
            throw new Error('User not authenticated and no local data');
        }
        
        // Always try to get latest user profile from API
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
                // If API directly returns user data instead of wrapped in success/data
                currentUser = response;
                // 更新auth管理器中的用户数据
                auth.user = currentUser;
                auth.saveSession(currentUser, auth.getCurrentToken());
                updateUserProfileUI();
                return;
            } else {
                console.warn('⚠️ Backend user profile format abnormal, trying to use local storage');
                throw new Error('API return format error');
            }
        } catch (profileError) {
            console.warn('⚠️ Profile API call failed, using local storage as fallback:', profileError);
            
            // Fallback to local storage
            const localUser = auth.getCurrentUser();
            if (localUser) {
                currentUser = localUser;
                updateUserProfileUI();
                return;
            }
            
            // Final fallback: use default user info
            currentUser = {
                id: 'user_' + Date.now(),
                email: 'user@example.com',
                nickname: 'User'
            };
            updateUserProfileUI();
        }
    } catch (error) {
        console.error('❌ Failed to get user profile:', error);
        // Use default user info
        currentUser = {
            id: 'user_' + Date.now(),
            email: 'user@example.com',
            nickname: 'User'
        };
        updateUserProfileUI();
    }
}

// Update user profile UI
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
    
    // Update avatar
    if (userAvatar) {
        if (currentUser.avatar_url) {
            userAvatar.src = currentUser.avatar_url;
            userAvatar.style.display = 'block';
        } else {
            // If no avatar URL, use default avatar or hide
            userAvatar.style.display = 'block';
            // Can set a default avatar or keep current state
        }
    }
    
    // Update username
    if (actualUsername) {
        // Try multiple possible display name fields
        const displayName = currentUser.nickname || 
                           currentUser.username || 
                           currentUser.name || 
                           currentUser.display_name ||
                           currentUser.email || 
                           'User';
        
        actualUsername.textContent = displayName;
        actualUsername.style.display = 'inline';
    }
    
    // Update header avatar
    if (headerAvatar) {
        if (currentUser.avatar_url) {
            headerAvatar.src = currentUser.avatar_url;
        }
    }
    
    // Update header welcome message
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

// Load user insights
async function loadUserInsights() {
    try {
        // Use pagination API method to get insights
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
            
            renderInsightsInitial();      // Only render current page data
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
        console.error('❌ Failed to load user insights:', error);
        
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
                // Allow using "expired" backup when authentication/network error to avoid empty data
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
        
        // Check if it is a backend service issue
        if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
            showErrorMessage('Backend service temporarily unavailable due to expired token, please relogin.');
        } else if (error.message.includes('401') || error.message.includes('403')) {
            showErrorMessage('Authentication failed. Please log in again.');
            // Redirect to login page
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

// Render insights list
function renderInsights() {
    console.log('🚨 renderInsights() called - viewMode:', viewMode, 'activeStackId:', activeStackId);
    console.log('🔍 DEBUG: renderInsights - currentPage:', currentPage, 'totalPages:', totalPages);
    console.trace('renderInsights call stack');
    
    // Guard clause: don't render home view when in stack view mode
    if (viewMode === 'stack') {
        console.log('⚠️ renderInsights() called but we are in stack view mode, ignoring');
        return;
    }
    
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
    console.log('🔍 DEBUG: currentInsights.length:', currentInsights.length);
    console.log('🔍 DEBUG: currentInsights:', currentInsights.map(i => ({ id: i.id, title: i.title })));
    console.log('🎯 Stacks count:', stacks.size);
    console.log('🎯 Effective limit for page', currentPage, ':', effectiveLimitForPage(currentPage));
    
    // Check if we have any content to render (insights OR stacks)
    // For page 1, check both insights and stacks. For other pages, only check insights
    const hasInsights = currentPage === 1 ? filteredInsights.length > 0 : currentInsights.length > 0;
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
    // Only show stacks if no specific tag filter is active AND we're on page 1
    const hasActiveTagFilter = currentFilters.tags && currentFilters.tags !== 'all';
    console.log(`🔍 DEBUG: Stack rendering check - currentPage=${currentPage}, hasStacks=${hasStacks}, hasActiveTagFilter=${hasActiveTagFilter}`);
    
    if (currentPage === 1 && hasStacks && !hasActiveTagFilter) {
        console.log(`🔍 DEBUG: Rendering ${stacks.size} stacks on page 1`);
        for (const [, stackData] of stacks) {
            fragment.appendChild(createStackCard(stackData));
        }
    } else {
        console.log(`🔍 DEBUG: Not rendering stacks - currentPage=${currentPage}, hasStacks=${hasStacks}, hasActiveTagFilter=${hasActiveTagFilter}`);
    }
    
    // Then render insights (using filtered insights)
    if (hasInsights) {
        if (hasActiveTagFilter) {
            // When filtering, paginate through filtered results
            const startIndex = (currentPage - 1) * insightsPerPage;
            const endIndex = startIndex + insightsPerPage;
            const list = filteredInsights.slice(startIndex, endIndex);
            
            console.log(`🔍 DEBUG: Tag filter rendering - startIndex=${startIndex}, endIndex=${endIndex}, list.length=${list.length}`);
            console.log(`🔍 DEBUG: filteredInsights.length=${filteredInsights.length}, insightsPerPage=${insightsPerPage}`);
            
            for (const insight of list) {
                fragment.appendChild(createInsightCard(insight));
            }
        } else {
            // When not filtering, use normal pagination with stack accounting
            const limit = effectiveLimitForPage(currentPage);
            console.log(`🔍 DEBUG: Rendering logic - currentPage=${currentPage}, limit=${limit}`);
            console.log(`🔍 DEBUG: filteredInsights.length=${filteredInsights.length}, currentInsights.length=${currentInsights.length}`);
            
            // For page 1, slice to account for stacks. For other pages, use the insights loaded for that page
            const list = currentPage === 1 ? filteredInsights.slice(0, limit) : currentInsights;
            console.log(`🔍 DEBUG: Final list to render:`, list.length, 'insights');
            console.log(`🔍 DEBUG: List items:`, list.map(i => ({ id: i.id, title: i.title })));
            
            for (const insight of list) {
                console.log(`🔍 DEBUG: Creating card for insight:`, insight.id, insight.title);
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
    console.log(`📊 Rendering page ${currentPage}: ${insightsCount} insights + ${stacksCount} stacks = ${totalCards} total cards`);
    console.log(`🔍 DEBUG: Final rendering stats - currentPage=${currentPage}, insightsCount=${insightsCount}, stacksCount=${stacksCount}, totalCards=${totalCards}`);
    
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
    // For "All" filter, use the total available insights for proper pagination
    if (currentFilters.tags === 'all' && !currentFilters.search) {
        // Use all available insights for proper pagination when showing all
        const allAvailableInsights = window.allInsightsForFiltering || [];
        totalInsights = allAvailableInsights.length;
        console.log(`🔍 DEBUG: Using all available insights for pagination: ${totalInsights}`);
        
        // For "All" filter, calculate pagination the same way as normal pagination
        // Page 1 shows (insightsPerPage - stacksCount) insights + stacks
        // Remaining insights go to page 2
        const stacksCount = stacks.size;
        const page1SlotsForInsights = Math.max(0, insightsPerPage - stacksCount);
        const remainingInsights = Math.max(0, totalInsights - page1SlotsForInsights);
        
        // Calculate total pages based on actual page capacity
        totalPages = remainingInsights > 0 ? 2 : 1;
        console.log(`🔍 DEBUG: All filter pagination - page1Slots=${page1SlotsForInsights}, remaining=${remainingInsights}, totalPages=${totalPages}`);
    } else {
        totalInsights = filteredInsights.length;
        console.log(`🔍 DEBUG: Using filtered insights for pagination: ${totalInsights}`);
        totalPages = Math.max(1, Math.ceil(totalInsights / insightsPerPage));
    }
    currentPage = 1; // Reset to first page when filtering
    
    console.log(`🔍 DEBUG: Pagination calculation - totalInsights=${totalInsights}, insightsPerPage=${insightsPerPage}, totalPages=${totalPages}`);
    
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

// Array of random images for cards without images
const randomImages = [
    '/public/新建文件夹/微信图片_20250822114123_2436_9.jpg',
    '/public/新建文件夹/微信图片_20250822114124_2437_9.jpg',
    '/public/新建文件夹/微信图片_20250822114125_2438_9.jpg',
    '/public/新建文件夹/微信图片_20250822114126_2439_9.jpg',
    '/public/新建文件夹/微信图片_20250822114126_2440_9.jpg',
    '/public/新建文件夹/微信图片_20250822114127_2441_9.jpg',
    '/public/新建文件夹/微信图片_20250822114128_2442_9.jpg',
    '/public/新建文件夹/微信图片_20250822114129_2443_9.jpg',
    '/public/新建文件夹/微信图片_20250822114131_2444_9.jpg',
    '/public/新建文件夹/微信图片_20250822114132_2445_9.jpg',
    '/public/新建文件夹/微信图片_20250822114133_2446_9.jpg',
    '/public/新建文件夹/微信图片_20250822114134_2447_9.jpg',
    '/public/新建文件夹/微信图片_20250822114136_2448_9.jpg',
    '/public/新建文件夹/微信图片_20250822114137_2449_9.jpg'
];

// Function to get a random image
function getRandomImage() {
    return randomImages[Math.floor(Math.random() * randomImages.length)];
}

// Create insight card
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
    
    // Card image area - always show an image (either original or random)
    const imageContainer = document.createElement('div');
    imageContainer.className = 'content-card-image-container';
    
    const image = document.createElement('img');
    image.className = 'content-card-image';
    
    // Use original image_url if available, otherwise use a random image
    image.src = insight.image_url || getRandomImage();
    image.alt = insight.title || 'Content image';
    image.loading = 'lazy';
    
    // Image loading error handling
    image.onerror = function() {
        // If the original image fails to load and we haven't tried a random image yet, try a random one
        if (insight.image_url && !this.dataset.randomImageUsed) {
            this.src = getRandomImage();
            this.dataset.randomImageUsed = 'true';
        } else {
            // If random image also fails, hide the image
            this.style.display = 'none';
            this.parentElement.classList.add('no-image');
        }
    };
    
    imageContainer.appendChild(image);
    card.appendChild(imageContainer);
    
    // Card content area
    const cardContent = document.createElement('div');
    cardContent.className = 'content-card-content';
    
    // Card header - Top row with date and source info
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
    
    // Card description
    const description = document.createElement('div');
    description.className = 'content-card-description';
    description.textContent = insight.description || `Content from ${new URL(insight.url).hostname}`;
    
    // Tag functionality removed - only show main tags at bottom
    
    // Card footer
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
    
    // Assemble card content
    cardContent.appendChild(cardHeader);
    cardContent.appendChild(description);
    // Tag area only added when there are tags
    cardContent.appendChild(cardFooter);
    
    // Assemble complete card
    card.appendChild(cardContent);
    
    console.log('✅ Insight card created successfully:', {
        title: insight.title,
        id: insight.id,
        classes: card.className,
        dataset: card.dataset
    });
    
    return card;
}

// Load user tags for tag filter
async function loadUserTagsForFilter(dropdownOptions) {
    try {
        const response = await getCachedUserTags();
        const tags = response.success ? response.data : [];
        
        if (tags.length > 0) {
            // Create options for each tag
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
        console.error('❌ Failed to load user tags:', error);
    }
}

// Initialize filter buttons
async function initFilterButtons() {
    if (!filterButtons) {
        console.error('❌ Filter buttons container not found');
        return;
    }
    
    try {
        console.log('🔧 Initializing filter buttons...');
        
        // Get user tags
        const response = await getCachedUserTags();
        const userTags = response.success ? response.data : [];
        
        console.log('📋 User tags loaded:', userTags);
        
        // Clear existing buttons
        filterButtons.innerHTML = '';
        
        // Create two main filter buttons
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
        
        // Create filter button
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
            
            // Create different content based on button type
            if (filterConfig.type === 'dropdown') {
                // All buttons create dropdown menus
                const dropdownOptions = document.createElement('div');
                dropdownOptions.className = 'filter-dropdown-options';
                
                // If it is a tag button, create PARA system options
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
                
                // Bind click event
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    buttonContainer.classList.toggle('open');
                    
                    // Update arrow direction
                    const arrow = button.querySelector('.filter-arrow');
                    if (arrow) {
                        arrow.style.transform = buttonContainer.classList.contains('open') ? 'rotate(180deg)' : 'rotate(0deg)';
                    }
                });
                
                // Bind option click event
                dropdownOptions.addEventListener('click', (e) => {
                    console.log('🖱️ Filter option clicked:', e.target);
                    
                    const option = e.target.closest('.filter-option');
                    if (option) {
                        const filterKey = option.dataset.filter;
                        const filterType = filterConfig.key; // latest, tags
                        const optionLabel = option.querySelector('.filter-option-label').textContent;
                        
                        console.log('🎯 Setting filter:', { filterType, filterKey, optionLabel });
                        setFilter(filterType, filterKey, optionLabel);
                        
                        // Close all dropdowns
                        document.querySelectorAll('.filter-button-container').forEach(container => {
                            container.classList.remove('open');
                            const arrow = container.querySelector('.filter-arrow');
                            if (arrow) arrow.style.transform = 'rotate(0deg)';
                        });
                    }
                });
                
                // Prevent dropdown option click event bubbling
                dropdownOptions.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
                
                // Add PARA tooltip functionality
                if (filterConfig.key === 'tags') {
                    console.log('💡 Setting up PARA tooltips');
                    setupPARATooltips(dropdownOptions);
                }
                
                buttonContainer.appendChild(button);
                buttonContainer.appendChild(dropdownOptions);
            } else {
                // Other buttons: create dropdown menu
                const dropdownOptions = document.createElement('div');
                dropdownOptions.className = 'filter-dropdown-options';
                dropdownOptions.innerHTML = filterConfig.options.map(option => `
                    <div class="filter-option" data-filter="${option.key}">
                        <span class="filter-option-label">${option.label}</span>
                    </div>
                `).join('');
                
                // Bind click event
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    buttonContainer.classList.toggle('open');
                    
                    // Update arrow direction
                    const arrow = button.querySelector('.filter-arrow');
                    if (arrow) {
                        arrow.style.transform = buttonContainer.classList.contains('open') ? 'rotate(180deg)' : 'rotate(0deg)';
                    }
                });
                
                // Bind option click event
                dropdownOptions.addEventListener('click', (e) => {
                    const option = e.target.closest('.filter-option');
                    if (option) {
                        const filterKey = option.dataset.filter;
                        const filterType = filterConfig.key; // latest, tags
                        const optionLabel = option.querySelector('.filter-option-label').textContent;
                        setFilter(filterType, filterKey, optionLabel);
                        
                        // Close all dropdowns
                        document.querySelectorAll('.filter-button-container').forEach(container => {
                            container.classList.remove('open');
                            const arrow = container.querySelector('.filter-arrow');
                            if (arrow) arrow.style.transform = 'rotate(0deg)';
                        });
                    }
                });
                
                // Prevent dropdown option click event bubbling
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
        
        // Edit Tags button has been moved next to tag selector, no longer need to add here
        
    } catch (error) {
        console.error('❌ Failed to initialize filter buttons:', error);
        
        // Show basic filter options
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
        
        // Try to fetch all insights with tags included
        let allInsights = [];
        
        try {
            const uid = (auth?.user?.id || currentUser?.id || undefined);
            const response = await api.getInsightsPaginated(1, 100, uid, '', true); // Reasonable limit to get all
            
            if (response?.success) {
                const { items } = normalizePaginatedInsightsResponse(response);
                allInsights = items || [];
                console.log('✅ Fetched insights from API:', allInsights.length);
            }
        } catch (apiError) {
            console.warn('⚠️ API fetch failed, using existing insights:', apiError);
            console.warn('⚠️ API error details:', apiError.message, apiError.status);
            // Fallback: use current insights and add insights from stacks
            allInsights = [...currentInsights];
        }
        
        // Add insights from stacks to ensure we have all insights
        const insightsFromStacks = [];
        stacks.forEach(stackData => {
            stackData.cards.forEach(card => {
                // Check if this insight is already in allInsights
                const exists = allInsights.some(insight => insight.id === card.id);
                if (!exists) {
                    insightsFromStacks.push(card);
                }
            });
        });
        
        console.log('📊 Before combining:');
        console.log(`  - API insights: ${allInsights.length}`);
        console.log(`  - Insights from stacks: ${insightsFromStacks.length}`);
        console.log(`  - Stack insights details:`, insightsFromStacks.map(i => ({ id: i.id, title: i.title })));
        
        // Combine all insights
        allInsights = [...allInsights, ...insightsFromStacks];
        console.log('📊 Total insights for filtering (including from stacks):', allInsights.length);
        console.log('📊 All insights details:', allInsights.map(i => ({ id: i.id, title: i.title, stack_id: i.stack_id })));
        
        // Ensure tags are normalized for all insights
        const insightsWithoutTags = allInsights.filter(insight => !insight.tags || insight.tags.length === 0);
        if (insightsWithoutTags.length > 0) {
            console.log('🔄 Loading tags for insights without them...');
            await loadTagsForInsights(insightsWithoutTags);
        }
        
        // Store globally for filtering
        window.allInsightsForFiltering = allInsights;
        console.log('✅ Prepared all insights for filtering:', allInsights.length);
        
        return allInsights;
    } catch (error) {
        console.error('❌ Failed to prepare all insights for filtering:', error);
        return [];
    }
}

// Set filter conditions
async function setFilter(filterType, filterValue, optionLabel = null) {
    console.log('🔧 setFilter called:', { filterType, filterValue, optionLabel });
    
    // Update corresponding filter conditions
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
            // Ensure we have all insights available for proper pagination
            // If we don't have enough insights loaded, fetch them
            if (currentInsights.length < totalInsights) {
                console.log('🔄 Switching back to "All" filter - need to fetch all insights for pagination');
                await fetchAllInsightsForFiltering();
            } else {
                console.log('🔄 Switching back to "All" filter - all insights already available');
            }
        }
    }
    
    // Update button display text
    updateFilterButtonDisplay(filterType, filterValue, optionLabel);
    
    // Update button state
    updateFilterButtonStates();
    
    // Show filter status
    showFilterStatus();
    
    // Re-render
    console.log('🔄 Re-rendering insights with new filter...');
    resetInsightsPaginationAndRerender();
}

// Update filter button display text
function updateFilterButtonDisplay(filterType, filterValue, optionLabel) {
    const buttonContainer = filterButtons.querySelector(`[data-filter="${filterType}"]`).closest('.filter-button-container');
    const button = buttonContainer.querySelector('.filter-label');
    
    if (filterType === 'tags' && filterValue && filterValue.startsWith('tag_')) {
        // Tag filter: show selected tag names
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
        // Sort method: show sort method
        if (filterValue === 'latest') {
            button.textContent = 'Latest';
        } else if (filterValue === 'oldest') {
            button.textContent = 'Oldest';
        } else if (filterValue === 'alphabetical') {
            button.textContent = 'Alphabetical';
        }
    }
}

// Update filter button state
function updateFilterButtonStates() {
    const buttons = filterButtons.querySelectorAll('.FilterButton');
    buttons.forEach(btn => {
        // Remove active class from all buttons - no purple highlighting
        btn.classList.remove('active');
    });
}

// Show filter status
function showFilterStatus() {
    const statusParts = [];
    
    // Sort status
    if (currentFilters.latest === 'latest') {
        statusParts.push('Latest first');
    } else if (currentFilters.latest === 'oldest') {
        statusParts.push('Oldest first');
    } else if (currentFilters.latest === 'alphabetical') {
        statusParts.push('Alphabetical');
    }
    
    // Tag filter status
    if (currentFilters.tags && currentFilters.tags !== 'all') {
        if (currentFilters.tags.startsWith('tag_')) {
            const tagButton = document.querySelector(`[data-filter="tags"]`);
            if (tagButton) {
                const tagOption = tagButton.closest('.filter-button-container').querySelector(`[data-filter="${currentFilters.tags}"]`);
                if (tagOption) {
                    statusParts.push(`Tag: ${tagOption.textContent.trim()}`);
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
            statusParts.push(`Tag: ${paraCategoryNames[currentFilters.tags]}`);
        }
    } else if (currentFilters.tags === 'all') {
        statusParts.push('All tags');
    }
    

    
    const statusText = statusParts.length > 0 ? statusParts.join(' | ') : 'Show all content';
    
    // Can add UI to show filter status here
    // Like showing a small tip at the top of the page
}

// Get currently filtered articles
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
    
    // If we have an active tag filter or search filter, we need to work with all insights, not just current page
    const hasActiveTagFilter = currentFilters.tags && currentFilters.tags !== 'all';
    const hasActiveSearchFilter = currentFilters.search && currentFilters.search.trim() !== '';
    const hasAnyFilter = hasActiveTagFilter || hasActiveSearchFilter;
    let insightsToFilter = currentInsights;
    
    if (hasAnyFilter) {
        if (window.allInsightsForFiltering) {
            // Use all insights for filtering when any filter is active
            insightsToFilter = window.allInsightsForFiltering;
            console.log('🔍 Using all insights for filtering:', insightsToFilter.length);
        } else {
            // Fallback: combine current insights with insights from stacks
            console.log('⚠️ allInsightsForFiltering not available, creating fallback...');
            const insightsFromStacks = [];
            stacks.forEach(stackData => {
                stackData.cards.forEach(card => {
                    // Check if this insight is already in currentInsights
                    const exists = currentInsights.some(insight => insight.id === card.id);
                    if (!exists) {
                        insightsFromStacks.push(card);
                    }
                });
            });
            
            insightsToFilter = [...currentInsights, ...insightsFromStacks];
            console.log('🔍 Using fallback insights for filtering:', insightsToFilter.length);
            console.log('📊 Current insights:', currentInsights.length);
            console.log('📊 Insights from stacks:', insightsFromStacks.length);
        }
    } else {
        // No active filter - use all available insights for proper pagination
        if (window.allInsightsForFiltering) {
            insightsToFilter = window.allInsightsForFiltering;
            console.log('🔍 Using all insights for "All" filter:', insightsToFilter.length);
        } else {
            // Fallback: combine current insights with insights from stacks
            console.log('⚠️ allInsightsForFiltering not available for "All" filter, creating fallback...');
            const insightsFromStacks = [];
            stacks.forEach(stackData => {
                stackData.cards.forEach(card => {
                    // Check if this insight is already in currentInsights
                    const exists = currentInsights.some(insight => insight.id === card.id);
                    if (!exists) {
                        insightsFromStacks.push(card);
                    }
                });
            });
            
            insightsToFilter = [...currentInsights, ...insightsFromStacks];
            console.log('🔍 Using fallback insights for "All" filter:', insightsToFilter.length);
        }
    }
    
    let filteredInsights = [...insightsToFilter];
    
    // Only filter out cards that are in stacks when there's NO active filter
    // When any filtering is active, we want to show insights from stacks too
    if (!hasAnyFilter) {
        // Only remove insights that are actually in stacks based on their stack_id field
        // Don't rely on the stacks Map which might contain stale data
        filteredInsights = filteredInsights.filter(insight => {
            // Keep insights that don't have a stack_id (not in any stack)
            return !insight.stack_id;
        });
        console.log('📋 Insights after removing stacked cards (no filter):', filteredInsights.length);
    } else {
        console.log('📋 Keeping all insights for filtering (including those in stacks):', filteredInsights.length);
    }
    
    // 1. Sorting logic (always applied)
    if (currentFilters.latest === 'latest') {
        // Sort by latest time
        filteredInsights.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (currentFilters.latest === 'oldest') {
        // Sort by oldest time
        filteredInsights.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (currentFilters.latest === 'alphabetical') {
        // Sort by title first letter A-Z
        filteredInsights.sort((a, b) => {
            const titleA = (a.title || a.url || '').toLowerCase();
            const titleB = (b.title || b.url || '').toLowerCase();
            return titleA.localeCompare(titleB);
        });
    } else {
        // Default sort by latest time
        filteredInsights.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    
    // 2. Text search filter (title + metadata)
    if (currentFilters.search && currentFilters.search.trim() !== '') {
        const q = currentFilters.search.trim().toLowerCase();
        console.log('🔍 Applying search filter:', q);

        const matchSearch = (insight) => {
            // title
            const title = (insight.title || insight.url || '').toLowerCase();

            // try common metadata-ish fields; if you have `metadata` object, this will catch it,
            // else we fall back to description/summary etc.
            let metaBlob = '';
            const metaCandidates = [
                'metadata', 'meta', 'description', 'summary', 'site_name', 'author'
            ];
            metaCandidates.forEach((k) => {
                const v = insight[k];
                if (!v) return;
                metaBlob += ' ' + (typeof v === 'object' ? JSON.stringify(v) : String(v));
            });
            metaBlob = metaBlob.toLowerCase();

            return title.includes(q) || metaBlob.includes(q);
        };

        filteredInsights = filteredInsights.filter(matchSearch);
        console.log('📋 Insights after search filtering:', filteredInsights.length);
    }
    
    // 3. Tag filtering
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



// Share insight
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
            // Copy link to clipboard
            navigator.clipboard.writeText(insight.url).then(() => {
                alert('Link copied to clipboard!');
            }).catch(() => {
                // Fallback solution
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

// Delete insight
async function deleteInsight(id) {
    if (!confirm('Are you sure you want to delete this content?')) {
        return;
    }
    
    try {
        await api.deleteInsight(id);
        
        // Clear cache for insights endpoint to ensure fresh data
        if (window.apiCache) {
            window.apiCache.clearPattern('/api/v1/insights');
        }
        
        clearPageCache(); // Clear cache because data has changed
        
        // Handle refresh based on current view mode
        if (viewMode === 'stack' && activeStackId) {
            // We're in stack view - refresh the stack view
            console.log('🔄 Deleting insight in stack view, refreshing stack:', activeStackId);
            await renderStackView(activeStackId);
        } else {
            // We're in home view - refresh normally
            await loadUserInsightsWithPagination();
        }
        
        // Also save to localStorage backup
        saveInsightsToLocalStorage({ force: true });
        
        alert('Content deleted successfully!');
    } catch (error) {
        console.error('Failed to delete content:', error);
        alert(error.message || 'Failed to delete content, please try again');
    }
}

// Scroll state management tool
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
        console.error('❌ Modal element not found');
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
    
    // Header email preferences button
    if (headerEmailPreferences) {
        headerEmailPreferences.addEventListener('click', () => {
            // Navigate to email preferences page
            window.location.href = '/email-preferences';
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
                
                // Show loading state
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
                
                // If we're in stack view mode, add the insight to the current stack
                console.log('🔍 DEBUG: Checking stack assignment conditions:');
                console.log('🔍 DEBUG: viewMode:', viewMode);
                console.log('🔍 DEBUG: activeStackId:', activeStackId);
                console.log('🔍 DEBUG: viewMode === "stack":', viewMode === 'stack');
                console.log('🔍 DEBUG: activeStackId truthy:', !!activeStackId);
                console.log('🔍 DEBUG: Both conditions met:', viewMode === 'stack' && activeStackId);
                console.log('🔍 DEBUG: insightData before assignment:', JSON.stringify(insightData, null, 2));
                
                if (viewMode === 'stack' && activeStackId) {
                    // Convert stack_id to integer since backend expects integer type
                    insightData.stack_id = parseInt(activeStackId);
                    console.log('🔄 Adding insight to current stack:', activeStackId);
                    console.log('🔄 stack_id value:', insightData.stack_id);
                    console.log('🔄 Type of stack_id:', typeof insightData.stack_id);
                    console.log('🔄 insightData after assignment:', JSON.stringify(insightData, null, 2));
                } else {
                    console.log('⚠️ Stack assignment skipped - conditions not met');
                    console.log('⚠️ Reason: viewMode !== "stack" or activeStackId is falsy');
                }
                
                // 获取自定义字段
                const customTitle = document.getElementById('customTitle')?.value?.trim();
                const customThought = document.getElementById('customThought')?.value?.trim();
                
                // 只有当有选中的标签时才添加tag_ids（使用标签ID而不是名称）
                if (selectedTags.length > 0) {
                    const tagIds = selectedTags.map(tag => tag.id);
                    if (tagIds.length > 0) {
                        insightData.tag_ids = tagIds;
                        console.log('🔍 DEBUG: Using selected tags:', tagIds);
                    }
                } else {
                    // TEMPORARY: Use hardcoded Archive tag ID to test
                    console.log('🔍 DEBUG: No tags selected, using hardcoded Archive tag ID...');
                    insightData.tag_ids = ["90c083ca-6a03-4431-8469-d541a7e59998"];
                    console.log('🔍 DEBUG: Set hardcoded tag_ids to:', insightData.tag_ids);
                }
                
                // 添加自定义字段（如果用户输入了的话）
                if (customTitle) insightData.title = customTitle;
                if (customThought) insightData.thought = customThought;
                
                // 使用正确的API端点创建insight
                console.log('📝 Creating insight with data:', insightData);
                console.log('🔍 DEBUG: Full insightData object:', JSON.stringify(insightData, null, 2));
                console.log('🔍 DEBUG: stack_id value:', insightData.stack_id);
                console.log('🔍 DEBUG: stack_id type:', typeof insightData.stack_id);
                console.log('🔍 DEBUG: activeStackId:', activeStackId);
                console.log('🔍 DEBUG: viewMode:', viewMode);
                console.log('🔍 DEBUG: Final data being sent to API:', JSON.stringify(insightData, null, 2));
                
                // Use the correct API endpoint /api/v1/insights/ which supports stack_id
                const result = await api.createInsight(insightData);
                console.log('✅ Insight creation result:', result);
                console.log('🔍 DEBUG: Result data:', JSON.stringify(result, null, 2));
                
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
                        
                        clearPageCache(); // Clear cache because data has changed
                        
                        // Check if we're in stack view mode
                        if (viewMode === 'stack' && activeStackId) {
                            console.log('🔄 In stack view mode, refreshing current stack');
                            
                            try {
                                // Simply refresh the current stack view to show the new insight
                                console.log('🎯 Refreshing stack view for stack:', activeStackId);
                                await renderStackView(activeStackId);
                                console.log('✅ Stack view refreshed with new insight');
                            } catch (error) {
                                console.error('❌ Failed to reload stack data:', error);
                                // Fallback: just re-render the current stack view
                                renderStackView(activeStackId);
                            }
                        } else {
                            // Normal home view reload
                            await loadUserInsightsWithPagination();
                        }
                        
                        // Also save to localStorage backup
                        saveInsightsToLocalStorage({ force: true });
                    } catch (error) {
                        console.error('❌ Failed to reload content:', error);
                        // 不要显示错误，因为内容已经添加成功了
                    }
                }, 2000);
                
            } catch (error) {
                console.error('❌ Failed to add content:', error);
                let errorMessage = 'Failed to add content. Please try again.';
                
                if (error.message) {
                    if (error.message.includes('401') || error.message.includes('unauthorized')) {
                        errorMessage = 'Please log in again to add content.';
                    } else if (error.message.includes('400') || error.message.includes('bad request')) {
                        errorMessage = 'Invalid URL or content format.';
                    } else if (error.message.includes('422')) {
                        errorMessage = 'Data validation failed. Please check your input and try again.';
                        console.error('🔍 422 error details - error message:', error.message);
                        console.error('🔍 422 error details - complete error object:', error);
                        console.error('🔍 422 error details - URL:', url);
                        console.error('🔍 422 error details - tag count:', tag_ids ? tag_ids.length : 0);
                        console.error('🔍 422 error details - tag ID array:', insightData.tag_ids);
                        console.error('🔍 422 error details - complete insightData:', insightData);
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
        // Check authentication status
        if (!auth.checkAuth()) {
            console.log('⚠️ User not authenticated, using empty tag list');
            renderTagSelector([]);
            updateFilterButtons([]);
            return;
        }
        
        // 使用缓存的API方法获取标签
        const response = await getCachedUserTags();
        
        if (response.success && response.data) {
            const tags = response.data;
            
            // 更新标签选择器
            renderTagSelector(tags);
            
            // 更新过滤器按钮
            updateFilterButtons(tags);
        } else {
            console.warn('⚠️ API return format incorrect:', response);
            renderTagSelector([]);
        }
    } catch (error) {
        console.error('❌ Failed to load user tags:', error);
        
        // 检查是否是认证问题
        if (error.message.includes('401') || error.message.includes('403') || error.message.includes('认证')) {
            console.log('⚠️ Authentication failed, using empty tag list');
            renderTagSelector([]);
            updateFilterButtons([]);
            // 不要显示错误信息或重定向，让用户继续使用页面
        } else if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
            showErrorMessage('Backend service temporarily unavailable due to expired token, please relogin.');
            renderTagSelector([]);
        } else {
            console.log('⚠️ Other error, using empty tag list');
            renderTagSelector([]);
        }
    }
}

// 渲染标签选择器
function renderTagSelector(tags) {
    const tagSelectorOptions = document.getElementById('tagSelectorOptions');
    if (!tagSelectorOptions) {
        console.error('❌ Tag selector options container not found');
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
        
                // Bind click event
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
        console.error('❌ Tag selector element not found');
        return;
    }
    
    // 点击触发器显示/隐藏下拉选项
    tagSelectorTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        tagSelectorDropdown.classList.toggle('open');
        
        const isOpen = tagSelectorDropdown.classList.contains('open');
        
                    // Update arrow direction
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
            console.error('❌ Tag name input field not found');
        }
    } else {
        console.error('❌ Create tag modal not found');
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
            console.error('❌ Tag name input field not found');
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

// ===== SEARCH FUNCTIONALITY =====

// Helper to apply search and re-render both views consistently
async function applySearch(query) {
    currentFilters.search = (query || '').trim();
    // keep inputs in sync across bars
    const homeInput = document.getElementById('searchInput');
    const stackInput = document.getElementById('stackSearchInput');
    if (homeInput && homeInput.value !== currentFilters.search) homeInput.value = currentFilters.search;
    if (stackInput && stackInput.value !== currentFilters.search) stackInput.value = currentFilters.search;

    // If search is active, fetch all insights for filtering (similar to tag filtering)
    if (currentFilters.search.trim() !== '') {
        try {
            console.log('🔍 Search active, fetching all insights for filtering...');
            await fetchAllInsightsForFiltering();
        } catch (error) {
            console.warn('⚠️ Failed to fetch all insights for search, using fallback:', error);
        }
    } else {
        // Clear the global insights when search is cleared
        window.allInsightsForFiltering = null;
    }

    renderInsights();         // re-renders lists with new filter
    updatePaginationUI?.();   // update pagination counts
}

// Initialize search functionality
function initSearch() {
    // Wire home bar
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') applySearch(searchInput.value);
        });
    }
    if (searchBtn) {
        searchBtn.addEventListener('click', () => applySearch(searchInput?.value || ''));
    }

    // Wire stack bar
    const stackSearchInput = document.getElementById('stackSearchInput');
    const stackSearchBtn = document.getElementById('stackSearchBtn');
    if (stackSearchInput) {
        stackSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') applySearch(stackSearchInput.value);
        });
    }
    if (stackSearchBtn) {
        stackSearchBtn.addEventListener('click', () => applySearch(stackSearchInput?.value || ''));
    }

    // Optional: keep inputs populated on first render, e.g. after restoring state
    applySearch(currentFilters.search || '');
}

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
    
    // Show loading state immediately to prevent layout shift
    showStackLoadingState();
    
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
            // First get the stack metadata
            const stacksResponse = await api.getUserStacks(currentUser?.id);
            if (stacksResponse.success && stacksResponse.data) {
                const stackData = stacksResponse.data.find(s => String(s.id) === String(stackId));
                if (stackData) {
                    // Then get the insights for this specific stack
                    const insightsResponse = await api.getStackItems(stackId);
                    console.log(`🔍 Fetching insights for stack ${stackId}:`, insightsResponse);
                    const stackInsights = insightsResponse.success && insightsResponse.data ? 
                        (insightsResponse.data.items || insightsResponse.data.insights || insightsResponse.data) : [];
                    console.log(`📦 Found ${stackInsights.length} insights for stack ${stackId}:`, stackInsights.map(i => ({ id: i.id, title: i.title, stack_id: i.stack_id })));
                    
                    // TEMPORARY WORKAROUND: If backend filtering isn't working, filter on frontend
                    let validInsights;
                    if (stackInsights.length > 0 && stackInsights.every(insight => insight.stack_id === null)) {
                        console.warn('⚠️ Backend filtering not working - all insights have stack_id null. Using frontend fallback...');
                        // Fallback: Get all insights and filter by stack_id on frontend
                        const allInsightsResponse = await api.getInsightsPaginated(1, 100, null, '', true);
                        if (allInsightsResponse.success && allInsightsResponse.data) {
                            const allInsights = allInsightsResponse.data.items || allInsightsResponse.data.insights || [];
                            validInsights = allInsights.filter(insight => parseInt(insight.stack_id) === parseInt(stackId));
                            console.log(`📦 Frontend fallback: Found ${validInsights.length} insights with stack_id ${stackId}`);
                        } else {
                            validInsights = [];
                        }
                    } else {
                        // Normal validation
                        validInsights = stackInsights.filter(insight => {
                            const belongsToStack = insight.stack_id === stackId;
                            if (!belongsToStack) {
                                console.warn(`⚠️ Insight ${insight.id} has stack_id ${insight.stack_id} but expected ${stackId}`);
                            }
                            return belongsToStack;
                        });
                    }
                    console.log(`📦 Valid insights for stack ${stackId}: ${validInsights.length} (filtered from ${stackInsights.length})`);
                    
                    stack = {
                        id: String(stackId),
                        name: stackData.name,
                        description: stackData.description,
                        cards: validInsights, // Use validated insights
                        createdAt: stackData.created_at,
                        updatedAt: stackData.updated_at,
                        modifiedAt: new Date().toISOString()
                    };
                    stacks.set(stackId, stack);
                }
            }
        } catch (error) {
            console.error('❌ Failed to fetch stack data:', error);
            hideStackLoadingState();
            showErrorMessage('Failed to load stack data');
            return;
        }
    } else {
        // If stack exists in memory, refresh its insights
        try {
            const insightsResponse = await api.getStackItems(stackId);
            console.log(`🔍 Refreshing insights for stack ${stackId}:`, insightsResponse);
            const stackInsights = insightsResponse.success && insightsResponse.data ? 
                (insightsResponse.data.items || insightsResponse.data.insights || insightsResponse.data) : [];
            console.log(`📦 Refreshed stack ${stackId} with ${stackInsights.length} insights:`, stackInsights.map(i => ({ id: i.id, title: i.title, stack_id: i.stack_id })));
            
            // TEMPORARY WORKAROUND: If backend filtering isn't working, filter on frontend
            let validInsights;
            if (stackInsights.length > 0 && stackInsights.every(insight => insight.stack_id === null)) {
                console.warn('⚠️ Backend filtering not working - all insights have stack_id null. Using frontend fallback...');
                // Fallback: Get all insights and filter by stack_id on frontend
                const allInsightsResponse = await api.getInsightsPaginated(1, 100, null, '', true);
                if (allInsightsResponse.success && allInsightsResponse.data) {
                    const allInsights = allInsightsResponse.data.items || allInsightsResponse.data.insights || [];
                    validInsights = allInsights.filter(insight => parseInt(insight.stack_id) === parseInt(stackId));
                    console.log(`📦 Frontend fallback: Found ${validInsights.length} insights with stack_id ${stackId}`);
                } else {
                    validInsights = [];
                }
            } else {
                // Normal validation
                validInsights = stackInsights.filter(insight => {
                    // Convert both to numbers for comparison since stack_id is stored as integer
                    const insightStackId = parseInt(insight.stack_id);
                    const expectedStackId = parseInt(stackId);
                    const belongsToStack = insightStackId === expectedStackId;
                    if (!belongsToStack) {
                        console.warn(`⚠️ Insight ${insight.id} has stack_id ${insight.stack_id} (${typeof insight.stack_id}) but expected ${stackId} (${typeof stackId})`);
                    }
                    return belongsToStack;
                });
            }
            console.log(`📦 Valid refreshed insights for stack ${stackId}: ${validInsights.length} (filtered from ${stackInsights.length})`);
            
            // Update the stack with validated insights
            stack.cards = validInsights;
            stacks.set(stackId, stack);
        } catch (error) {
            console.error('❌ Failed to refresh stack insights:', error);
        }
    }
    
    if (!stack) {
        console.error('❌ Stack not found:', stackId);
        hideStackLoadingState();
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
    
    // Hide loading state
    hideStackLoadingState();
    
    // Hide pagination
    hidePagination();
}

// Professional skeleton loading state with smooth transitions and layout stability
let __SKELETON_STARTED_AT__ = 0;

function skeletonMarkup(count = 6) {
    const cards = Array.from({length: count}, () => '<div class="skeleton-card"></div>').join('');
    return `<div class="progress-bar" role="progressbar" aria-valuetext="Loading"></div>
            <div class="skeleton-grid" aria-hidden="true">${cards}</div>`;
}

// Show loading state for stack view to prevent layout shift
function showStackLoadingState() {
    const container = document.getElementById('contentCards');
    if (!container) return;

    // signal busy for a11y
    container.setAttribute('aria-busy', 'true');

    // Prefer a dedicated overlay to avoid removing the static skeleton block in HTML
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = skeletonMarkup(6);
        container.appendChild(overlay);
    } else {
        overlay.classList.remove('fade-out');
        overlay.classList.add('fade-in');
    }
    __SKELETON_STARTED_AT__ = performance.now();
}

// Hide loading state for stack view
function hideStackLoadingState() {
    const container = document.getElementById('contentCards');
    const overlay = document.getElementById('loadingOverlay');
    if (!container) return;

    // ensure skeleton shows for at least 300ms to prevent flash/flicker
    const MIN_MS = 300;
    const elapsed = performance.now() - (__SKELETON_STARTED_AT__ || 0);
    const delay = Math.max(0, MIN_MS - elapsed);

    window.setTimeout(() => {
        if (overlay) {
            overlay.classList.add('fade-out');
            overlay.addEventListener('animationend', () => overlay.remove(), { once: true });
        }
        container.removeAttribute('aria-busy');
    }, delay);
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
    console.log('🎯 Current viewMode:', viewMode, 'activeStackId:', activeStackId);
    
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
        console.log('🔍 After renderEmptyStackState, contentCards children:', contentCards.children.length);
        console.log('🔍 Template card exists:', !!contentCards.querySelector('.template-card'));
        return;
    }
    
    console.log(`📋 Rendering ${stack.cards.length} insights for stack ${stack.id}`);
    
    // Render stack insights using existing card creation logic
    stack.cards.forEach((insight, index) => {
        console.log(`📄 Creating card ${index + 1} for insight:`, insight.title, 'ID:', insight.id);
        const card = createInsightCard(insight);
        if (card) {
            console.log(`✅ Card created successfully, appending to DOM`);
            contentCards.appendChild(card);
        } else {
            console.error(`❌ Failed to create card for insight:`, insight.title);
        }
    });
    
    console.log(`🔍 After rendering, contentCards has ${contentCards.children.length} children`);
    console.log(`🔍 ContentCards HTML:`, contentCards.innerHTML.substring(0, 200) + '...');
    
    console.log(`📊 Total cards in DOM after rendering:`, contentCards.querySelectorAll('.content-card').length);
    
    // Add template card if in edit mode
    if (document.body.classList.contains('edit-mode')) {
        addTemplateCard();
    }
    
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
                <button class="btn-primary" id="emptyStackAddInsightBtn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Add Insight
                </button>
                <button class="btn-secondary" id="emptyStackBackToHomeBtn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Back to My Space
                </button>
            </div>
        </div>
    `;
    
    // Add event listeners for the buttons
    const addInsightBtn = emptyState.querySelector('#emptyStackAddInsightBtn');
    const backToHomeBtn = emptyState.querySelector('#emptyStackBackToHomeBtn');
    
    if (addInsightBtn) {
        addInsightBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🖱️ Empty stack add insight button clicked');
            showAddContentModal();
        });
    }
    
    if (backToHomeBtn) {
        backToHomeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🖱️ Empty stack back to home button clicked');
            navigateToHome();
        });
    }
    
    contentCards.appendChild(emptyState);
    console.log('🔍 After appending emptyState, contentCards children:', contentCards.children.length);
    console.log('🔍 Template card exists after emptyState:', !!contentCards.querySelector('.template-card'));
    
    // Disable edit mode when showing empty stack state
    if (document.body.classList.contains('edit-mode')) {
        console.log('📭 Empty stack detected, disabling edit mode');
        document.body.classList.remove('edit-mode');
        isEditMode = false; // Update the edit mode state variable
        updateEditModeState();
    }
    
    console.log('🔍 After disabling edit mode, contentCards children:', contentCards.children.length);
    console.log('🔍 Template card exists after edit mode disabled:', !!contentCards.querySelector('.template-card'));
}

// Render home view (existing functionality)
function renderHomeView() {
    console.log('🏠 Rendering home view');
    
    // Ensure we're in home view mode
    viewMode = 'home';
    activeStackId = null;
    
    // Disable stack view mode (shows profile/controls sections)
    setStackViewEnabled(false);
    
    // Ensure edit mode is always off when entering home view
    if (document.body.classList.contains('edit-mode')) {
        console.log('🏠 Home view loaded, disabling edit mode');
        document.body.classList.remove('edit-mode');
        isEditMode = false;
        updateEditModeState();
    }
    
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

    // Check if current stack is empty
    const currentStack = stacks.get(activeStackId);
    const isEmpty = !currentStack || !currentStack.cards || currentStack.cards.length === 0;
    
    if (isEmpty) {
        // Show Add button for empty stacks
        actions.innerHTML = `
            <button class="stack-action-btn primary" id="stackAddBtn" aria-label="Add content">Add</button>
        `;
    } else {
        // Show Edit button for stacks with content
        actions.innerHTML = `
            <button class="stack-action-btn primary" id="stackEditModeBtn" aria-label="Toggle edit mode">Edit</button>
        `;
    }
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
    
    const addBtn = document.getElementById('stackAddBtn');
    if (addBtn) {
        addBtn.onclick = () => {
            console.log('🖱️ Stack Add button clicked');
            showAddContentModal();
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
        console.error('❌ Failed to delete tag:', error);
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

// 测试函数 - 可以在控制台调用
window.testStackIdFunctionality = async function() {
    console.log('🧪 Starting stack_id functionality test...');
    
    // 检查当前状态
    console.log('🔍 Current viewMode:', viewMode);
    console.log('🔍 Current activeStackId:', activeStackId);
    console.log('🔍 Current stacks:', Array.from(stacks.entries()));
    
    // 测试数据
    const testData = {
        url: 'https://example.com/test-stack-insight',
        title: 'Test Stack Insight',
        thought: 'This is a test insight for stack functionality',
        stack_id: isNaN(activeStackId) ? activeStackId : parseInt(activeStackId)
    };
    
    console.log('🧪 Test data:', testData);
    console.log('🧪 Test data stack_id type:', typeof testData.stack_id);
    
    try {
        // 测试API调用
        console.log('🧪 Testing API call...');
        const result = await api.createInsight(testData);
        console.log('🧪 API result:', result);
        
        // 检查结果
        if (result.success && result.data) {
            console.log('✅ Insight created successfully');
            console.log('🔍 Created insight data:', result.data);
            console.log('🔍 Created insight stack_id:', result.data.stack_id);
            console.log('🔍 Created insight stack_id type:', typeof result.data.stack_id);
        } else {
            console.error('❌ Insight creation failed:', result);
        }
        
    } catch (error) {
        console.error('❌ Test failed with error:', error);
    }
};

// 测试函数 - 检查数据库中的stack_id
window.testDatabaseStackId = async function() {
    console.log('🧪 Testing database stack_id storage...');
    
    try {
        // 获取最新的insights
        const response = await api.getInsightsPaginated(1, 10, null, '', true);
        console.log('🧪 Latest insights from API:', response);
        
        if (response.success && response.data) {
            const insights = response.data.items || response.data.insights || [];
            console.log('🧪 Found insights:', insights.length);
            
            insights.forEach((insight, index) => {
                console.log(`🧪 Insight ${index + 1}:`, {
                    id: insight.id,
                    title: insight.title,
                    stack_id: insight.stack_id,
                    stack_id_type: typeof insight.stack_id,
                    url: insight.url
                });
            });
            
            // 检查是否有任何 insights with stack_id
            const insightsWithStackId = insights.filter(i => i.stack_id);
            console.log('🧪 Insights with stack_id:', insightsWithStackId.length);
            console.log('🧪 Insights with stack_id details:', insightsWithStackId);
        }
        
    } catch (error) {
        console.error('❌ Database test failed:', error);
    }
};

// 测试函数 - 检查特定stack的内容
window.testStackContent = async function(stackId = null) {
    const targetStackId = stackId || activeStackId;
    console.log('🧪 Testing stack content for stack:', targetStackId);
    
    if (!targetStackId) {
        console.error('❌ No stack ID provided and no active stack');
        return;
    }
    
    try {
        // 获取stack数据
        const stackResponse = await api.getUserStacksWithInsights(currentUser?.id);
        console.log('🧪 Stack API response:', stackResponse);
        
        if (stackResponse.success && stackResponse.data) {
            const targetStack = stackResponse.data.find(s => String(s.id) === String(targetStackId));
            console.log('🧪 Target stack:', targetStack);
            
            if (targetStack) {
                console.log('🧪 Stack insights count:', targetStack.insights?.length || 0);
                console.log('🧪 Stack insights:', targetStack.insights || []);
                
                // 检查每个insight的stack_id
                if (targetStack.insights) {
                    targetStack.insights.forEach((insight, index) => {
                        console.log(`🧪 Stack insight ${index + 1}:`, {
                            id: insight.id,
                            title: insight.title,
                            stack_id: insight.stack_id,
                            stack_id_type: typeof insight.stack_id,
                            matches_stack: insight.stack_id === targetStackId
                        });
                    });
                }
            } else {
                console.error('❌ Stack not found:', targetStackId);
            }
        }
        
    } catch (error) {
        console.error('❌ Stack content test failed:', error);
    }
};

// 测试函数 - 调用后端调试端点
// 调试函数 - 检查后端数据库状态
window.debugBackendDatabase = async function() {
    console.log('🔍 Checking backend database state...');
    
    try {
        const response = await fetch('https://quest-api-edz1.onrender.com/api/v1/insights/debug/stack-ids', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${api.authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('📡 Backend debug response:', data);
            
            if (data.success && data.data) {
                console.log('📦 Recent insights from database:');
                data.data.insights.forEach(insight => {
                    console.log(`  - ${insight.id}: "${insight.title}" (stack_id: ${insight.stack_id}, type: ${typeof insight.stack_id})`);
                });
                
                console.log('📦 All stacks from database:');
                data.data.stacks.forEach(stack => {
                    console.log(`  - Stack ${stack.id}: "${stack.name}"`);
                });
            }
            
            return data;
        } else {
            console.error('❌ Backend debug failed:', response.status, response.statusText);
            return null;
        }
    } catch (error) {
        console.error('❌ Backend debug error:', error);
        return null;
    }
};

window.testBackendDebug = async function() {
    console.log('🧪 Testing backend debug endpoint...');
    
    try {
        const response = await api.request('/api/v1/insights/debug/stack-ids');
        console.log('🧪 Backend debug response:', response);
        
        if (response.success && response.data) {
            console.log('🧪 Recent insights from backend:', response.data.insights);
            console.log('🧪 All stacks from backend:', response.data.stacks);
            
            // 分析stack_id状态
            const insights = response.data.insights || [];
            const stacks = response.data.stacks || [];
            
            console.log('🧪 Analysis:');
            console.log(`  - Total insights: ${insights.length}`);
            console.log(`  - Total stacks: ${stacks.length}`);
            
            const insightsWithStackId = insights.filter(i => i.stack_id);
            console.log(`  - Insights with stack_id: ${insightsWithStackId.length}`);
            
            if (insightsWithStackId.length > 0) {
                console.log('🧪 Insights with stack_id details:', insightsWithStackId);
            } else {
                console.log('🧪 No insights have stack_id - this is the problem!');
            }
        }
        
    } catch (error) {
        console.error('❌ Backend debug test failed:', error);
    }
};

// 调试函数 - 检查数据库中的stack_id状态
window.debugStackInsights = async function(stackId) {
    console.log(`🔍 Debugging stack insights for stack ${stackId}...`);
    
    try {
        // 1. 检查API返回的数据
        const insightsResponse = await api.getStackItems(stackId);
        console.log('📡 Raw API response:', insightsResponse);
        
        if (insightsResponse.success && insightsResponse.data) {
            const stackInsights = insightsResponse.data.items || insightsResponse.data.insights || insightsResponse.data;
            console.log(`📦 Found ${stackInsights.length} insights from API:`, stackInsights);
            
            // 2. 检查每个insight的stack_id
            stackInsights.forEach((insight, index) => {
                console.log(`🔍 Insight ${index + 1}:`, {
                    id: insight.id,
                    title: insight.title,
                    stack_id: insight.stack_id,
                    stack_id_type: typeof insight.stack_id,
                    expected_stack_id: stackId,
                    expected_type: typeof stackId,
                    matches: parseInt(insight.stack_id) === parseInt(stackId),
                    strict_matches: insight.stack_id === stackId
                });
            });
            
            // 3. 检查验证逻辑
                const validInsights = stackInsights.filter(insight => {
                const belongsToStack = parseInt(insight.stack_id) === parseInt(stackId);
                console.log(`🔍 Validation for ${insight.id}: stack_id=${insight.stack_id} (${typeof insight.stack_id}), expected=${stackId} (${typeof stackId}), valid=${belongsToStack}`);
                return belongsToStack;
            });
            
            console.log(`📊 Validation results: ${validInsights.length} valid out of ${stackInsights.length} total`);
            
            return {
                total: stackInsights.length,
                valid: validInsights.length,
                insights: stackInsights,
                validInsights: validInsights
            };
        } else {
            console.error('❌ API response failed:', insightsResponse);
            return null;
        }
    } catch (error) {
        console.error('❌ Debug failed:', error);
        return null;
    }
};

// 调试函数 - 检查所有insights的stack_id
window.debugAllInsights = async function() {
    console.log('🔍 Debugging all insights...');
    
    try {
        const response = await api.getInsightsPaginated(1, 50, null, '', true);
        console.log('📡 All insights API response:', response);
        
        if (response.success && response.data) {
            const insights = response.data.items || response.data.insights || [];
            console.log(`📦 Found ${insights.length} total insights`);
            
            // 按stack_id分组
            const byStackId = {};
            insights.forEach(insight => {
                const stackId = insight.stack_id;
                if (!byStackId[stackId]) {
                    byStackId[stackId] = [];
                }
                byStackId[stackId].push(insight);
            });
            
            console.log('📊 Insights by stack_id:', byStackId);
            
            // 显示有stack_id的insights
            Object.keys(byStackId).forEach(stackId => {
                if (stackId !== 'null' && stackId !== null) {
                    console.log(`📦 Stack ${stackId} has ${byStackId[stackId].length} insights:`, 
                        byStackId[stackId].map(i => ({ id: i.id, title: i.title, stack_id: i.stack_id })));
                }
            });
            
            return byStackId;
        }
    } catch (error) {
        console.error('❌ Debug all insights failed:', error);
        return null;
    }
};

// 测试函数 - 创建insight并立即验证stack_id
window.testCreateAndVerify = async function() {
    console.log('🧪 Testing create insight and verify stack_id...');
    
    if (!activeStackId) {
        console.error('❌ No active stack. Please navigate to a stack first.');
        return;
    }
    
    const testData = {
        url: `https://example.com/test-${Date.now()}`,
        title: `Test Insight ${Date.now()}`,
        thought: 'This is a test insight to verify stack_id storage',
        stack_id: parseInt(activeStackId)  // Convert to integer for backend
    };
    
    console.log('🧪 Creating insight with data:', testData);
    console.log('🧪 Active stack ID type:', typeof activeStackId);
    console.log('🧪 Active stack ID value:', activeStackId);
    
    try {
        // 创建insight
        const result = await api.createInsight(testData);
        console.log('🧪 Creation result:', result);
        
        if (result.success && result.data) {
            console.log('✅ Insight created successfully');
            console.log('🔍 Created insight stack_id:', result.data.stack_id);
            console.log('🔍 Created insight stack_id type:', typeof result.data.stack_id);
            console.log('🔍 Expected stack_id:', activeStackId);
            console.log('🔍 Expected stack_id type:', typeof activeStackId);
            console.log('🔍 Stack_id matches:', result.data.stack_id === activeStackId);
            console.log('🔍 Stack_id loose match:', result.data.stack_id == activeStackId);
            
            // 立即查询数据库验证
            console.log('🧪 Verifying in database...');
            const verifyResponse = await api.getInsightsPaginated(1, 5, null, '', true);
            
            if (verifyResponse.success && verifyResponse.data) {
                const insights = verifyResponse.data.items || verifyResponse.data.insights || [];
                const createdInsight = insights.find(i => i.id === result.data.id);
                
                if (createdInsight) {
                    console.log('🔍 Database verification:');
                    console.log('  - Insight found in database:', !!createdInsight);
                    console.log('  - Database stack_id:', createdInsight.stack_id);
                    console.log('  - Database stack_id type:', typeof createdInsight.stack_id);
                    console.log('  - Expected stack_id:', activeStackId);
                    console.log('  - Expected stack_id type:', typeof activeStackId);
                    console.log('  - Stack_id strict match:', createdInsight.stack_id === activeStackId);
                    console.log('  - Stack_id loose match:', createdInsight.stack_id == activeStackId);
                    
                    // Test if we can find it in stack items
                    console.log('🧪 Testing stack items API...');
                    const stackItemsResponse = await api.getStackItems(activeStackId);
                    console.log('🧪 Stack items response:', stackItemsResponse);
                    
                    if (stackItemsResponse.success && stackItemsResponse.data) {
                        const stackItems = stackItemsResponse.data.items || stackItemsResponse.data.insights || stackItemsResponse.data;
                        console.log('🧪 Stack items found:', stackItems.length);
                        const foundInStack = stackItems.find(item => item.id === result.data.id);
                        console.log('🧪 Found in stack items:', !!foundInStack);
                        if (foundInStack) {
                            console.log('🧪 Stack item stack_id:', foundInStack.stack_id);
                            console.log('🧪 Stack item stack_id type:', typeof foundInStack.stack_id);
                        }
                    }
                } else {
                    console.error('❌ Created insight not found in database');
                }
            }
        } else {
            console.error('❌ Insight creation failed:', result);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
};

// 测试函数 - 直接测试API端点
window.testApiDirectly = async function() {
    console.log('🧪 Testing API endpoints directly...');
    
    if (!activeStackId) {
        console.error('❌ No active stack. Please navigate to a stack first.');
        return;
    }
    
    console.log('🧪 Current stack ID:', activeStackId);
    console.log('🧪 Current stack ID type:', typeof activeStackId);
    
    // Test 1: Check what the stack items API returns
    console.log('🧪 Test 1: Checking stack items API...');
    try {
        const stackItemsResponse = await api.getStackItems(activeStackId);
        console.log('🧪 Stack items response:', stackItemsResponse);
        
        if (stackItemsResponse.success && stackItemsResponse.data) {
            const items = stackItemsResponse.data.items || stackItemsResponse.data.insights || stackItemsResponse.data;
            console.log('🧪 Current stack items:', items.length);
            if (items.length > 0) {
                console.log('🧪 First item stack_id:', items[0].stack_id);
                console.log('🧪 First item stack_id type:', typeof items[0].stack_id);
            }
        }
    } catch (error) {
        console.error('❌ Stack items API error:', error);
    }
    
    // Test 2: Create insight with different stack_id formats
    console.log('🧪 Test 2: Testing different stack_id formats...');
    const testCases = [
        { name: 'Integer', stack_id: parseInt(activeStackId) },
        { name: 'String', stack_id: activeStackId },
        { name: 'Null', stack_id: null }
    ].filter(test => test.stack_id !== null);
    
    for (const testCase of testCases) {
        console.log(`🧪 Testing ${testCase.name}:`, testCase.stack_id);
        
        const testData = {
            url: `https://example.com/test-${testCase.name}-${Date.now()}`,
            title: `Test ${testCase.name} ${Date.now()}`,
            thought: `Testing ${testCase.name} format`,
            stack_id: testCase.stack_id
        };
        
        try {
            const result = await api.createInsight(testData);
            console.log(`🧪 ${testCase.name} result:`, result);
            
            if (result.success && result.data) {
                console.log(`✅ ${testCase.name} created successfully`);
                console.log(`🔍 ${testCase.name} returned stack_id:`, result.data.stack_id);
                console.log(`🔍 ${testCase.name} returned stack_id type:`, typeof result.data.stack_id);
                
                // Immediately check if it appears in stack items
                const stackItemsResponse = await api.getStackItems(activeStackId);
                if (stackItemsResponse.success && stackItemsResponse.data) {
                    const items = stackItemsResponse.data.items || stackItemsResponse.data.insights || stackItemsResponse.data;
                    const found = items.find(item => item.id === result.data.id);
                    console.log(`🔍 ${testCase.name} found in stack items:`, !!found);
                    if (found) {
                        console.log(`🔍 ${testCase.name} stack_id in items:`, found.stack_id);
                    }
                }
            } else {
                console.error(`❌ ${testCase.name} failed:`, result);
            }
        } catch (error) {
            console.error(`❌ ${testCase.name} error:`, error);
        }
        
        // Wait a bit between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
};

// 测试函数 - 检查后端API响应格式
window.testBackendResponse = async function() {
    console.log('🧪 Testing backend API response format...');
    
    if (!activeStackId) {
        console.error('❌ No active stack. Please navigate to a stack first.');
        return;
    }
    
    // Test creating an insight and examine the full response
    const testData = {
        url: `https://example.com/backend-test-${Date.now()}`,
        title: `Backend Test ${Date.now()}`,
        thought: 'Testing backend response format',
        stack_id: parseInt(activeStackId)
    };
    
    console.log('🧪 Sending data to backend:', testData);
    
    try {
        // Make the API call and capture the full response
        const response = await fetch(`${API_CONFIG.API_BASE_URL}${API_CONFIG.INSIGHTS.CREATE}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${api.authToken}`
            },
            body: JSON.stringify(testData)
        });
        
        console.log('🧪 Raw response status:', response.status);
        console.log('🧪 Raw response headers:', Object.fromEntries(response.headers.entries()));
        
        const responseText = await response.text();
        console.log('🧪 Raw response text:', responseText);
        
        let responseData;
        try {
            responseData = JSON.parse(responseText);
            console.log('🧪 Parsed response data:', responseData);
        } catch (e) {
            console.error('❌ Failed to parse response as JSON:', e);
            return;
        }
        
        if (responseData.success && responseData.data) {
            console.log('✅ Insight created via direct API call');
            console.log('🔍 Created insight:', responseData.data);
            console.log('🔍 Stack_id in response:', responseData.data.stack_id);
            console.log('🔍 Stack_id type in response:', typeof responseData.data.stack_id);
            
            // Now test the stack items endpoint
            console.log('🧪 Testing stack items endpoint...');
            const stackItemsUrl = `${API_CONFIG.API_BASE_URL}${API_CONFIG.INSIGHTS.LIST}?stack_id=${activeStackId}`;
            console.log('🧪 Stack items URL:', stackItemsUrl);
            
            const stackResponse = await fetch(stackItemsUrl, {
                headers: {
                    'Authorization': `Bearer ${api.authToken}`
                }
            });
            
            const stackResponseText = await stackResponse.text();
            console.log('🧪 Stack items raw response:', stackResponseText);
            
            try {
                const stackResponseData = JSON.parse(stackResponseText);
                console.log('🧪 Stack items parsed response:', stackResponseData);
                
                if (stackResponseData.success && stackResponseData.data) {
                    const items = stackResponseData.data.items || stackResponseData.data.insights || stackResponseData.data;
                    console.log('🧪 Stack items found:', items.length);
                    
                    const found = items.find(item => item.id === responseData.data.id);
                    console.log('🧪 New insight found in stack items:', !!found);
                    if (found) {
                        console.log('🧪 Found item stack_id:', found.stack_id);
                        console.log('🧪 Found item stack_id type:', typeof found.stack_id);
                    }
                }
            } catch (e) {
                console.error('❌ Failed to parse stack response:', e);
            }
        }
        
    } catch (error) {
        console.error('❌ Direct API test failed:', error);
    }
};

// 测试函数 - 快速验证修复
window.testFix = async function() {
    console.log('🧪 Testing the fix for stack_id assignment...');
    
    if (!activeStackId) {
        console.error('❌ No active stack. Please navigate to a stack first.');
        return;
    }
    
    const testData = {
        url: `https://example.com/fix-test-${Date.now()}`,
        title: `Fix Test ${Date.now()}`,
        thought: 'Testing the stack_id fix',
        stack_id: parseInt(activeStackId)  // Use integer format
    };
    
    console.log('🧪 Creating insight with integer stack_id:', testData);
    
    try {
        const result = await api.createInsight(testData);
        console.log('🧪 Creation result:', result);
        
        if (result.success && result.data) {
            console.log('✅ Insight created successfully');
            console.log('🔍 Created insight stack_id:', result.data.stack_id);
            console.log('🔍 Expected stack_id:', parseInt(activeStackId));
            console.log('🔍 Stack_id matches:', result.data.stack_id === parseInt(activeStackId));
            
            // Check if it appears in stack items
            const stackItemsResponse = await api.getStackItems(activeStackId);
            if (stackItemsResponse.success && stackItemsResponse.data) {
                const items = stackItemsResponse.data.items || stackItemsResponse.data.insights || stackItemsResponse.data;
                const found = items.find(item => item.id === result.data.id);
                console.log('🔍 Found in stack items:', !!found);
                if (found) {
                    console.log('🔍 Stack item stack_id:', found.stack_id);
                    console.log('🔍 Stack item stack_id type:', typeof found.stack_id);
                }   
            }
        } else {
            console.error('❌ Insight creation failed:', result);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
};

// 测试函数 - 验证stack过滤逻辑
window.testStackFiltering = async function() {
    console.log('🧪 Testing stack filtering logic...');
    
    if (!activeStackId) {
        console.error('❌ No active stack. Please navigate to a stack first.');
        return;
    }
    
    console.log('🧪 Testing stack filtering for stack:', activeStackId);
    console.log('🧪 Stack ID type:', typeof activeStackId);
    
    try {
        const stackItemsResponse = await api.getStackItems(activeStackId);
        console.log('🧪 Stack items response:', stackItemsResponse);
        
        if (stackItemsResponse.success && stackItemsResponse.data) {
            const items = stackItemsResponse.data.items || stackItemsResponse.data.insights || stackItemsResponse.data;
            console.log('🧪 Total items returned:', items.length);
            
            // Test the filtering logic
            const validItems = items.filter(insight => parseInt(insight.stack_id) === parseInt(activeStackId));
            console.log('🧪 Valid items after filtering:', validItems.length);
            
            items.forEach((item, index) => {
                console.log(`🧪 Item ${index}:`, {
                    id: item.id,
                    title: item.title,
                    stack_id: item.stack_id,
                    stack_id_type: typeof item.stack_id,
                    matches: parseInt(item.stack_id) === parseInt(activeStackId)
                });
            });
        }
    } catch (error) {
        console.error('❌ Stack filtering test failed:', error);
    }
};

// 测试函数 - 检查当前状态
window.checkCurrentState = function() {
    console.log('🧪 Checking current application state...');
    console.log('🧪 viewMode:', viewMode);
    console.log('🧪 activeStackId:', activeStackId);
    console.log('🧪 activeStackId type:', typeof activeStackId);
    console.log('🧪 viewMode === "stack":', viewMode === 'stack');
    console.log('🧪 activeStackId truthy:', !!activeStackId);
    console.log('🧪 Both conditions for stack assignment:', viewMode === 'stack' && activeStackId);
    
    if (viewMode === 'stack' && activeStackId) {
        console.log('✅ Stack assignment conditions are met');
        console.log('✅ Should assign stack_id:', parseInt(activeStackId));
    } else {
        console.log('❌ Stack assignment conditions NOT met');
        if (viewMode !== 'stack') {
            console.log('❌ Reason: viewMode is not "stack", it is:', viewMode);
        }
        if (!activeStackId) {
            console.log('❌ Reason: activeStackId is falsy:', activeStackId);
        }
    }
};

// 测试AI摘要数据
window.testAISummaryData = function() {
    console.log('🧪 Testing AI Summary Data...');
    
    if (!currentInsights || currentInsights.length === 0) {
        console.log('❌ No insights available for testing');
        return;
    }
    
    console.log('📊 Testing insights data structure:');
    currentInsights.forEach((insight, index) => {
        console.log(`\n🔍 Insight ${index + 1}:`, {
            id: insight.id,
            title: insight.title,
            hasInsightContents: !!insight.insight_contents,
            insightContentsLength: insight.insight_contents ? insight.insight_contents.length : 0
        });
        
        if (insight.insight_contents && insight.insight_contents.length > 0) {
            const content = insight.insight_contents[0];
            console.log('  📝 Content data:', {
                hasSummary: !!content.summary,
                summaryLength: content.summary ? content.summary.length : 0,
                summaryPreview: content.summary ? content.summary.substring(0, 100) + '...' : 'No summary',
                hasThought: !!content.thought,
                thoughtLength: content.thought ? content.thought.length : 0
            });
        } else {
            console.log('  ❌ No insight_contents data found');
        }
    });
    
    // 测试API响应
    console.log('\n🌐 Testing API response...');
    api.getInsightsPaginated(1, 9, null, true)
        .then(response => {
            console.log('✅ API Response received:', response);
            if (response.data && response.data.insights) {
                console.log('📊 API insights count:', response.data.insights.length);
                response.data.insights.forEach((insight, index) => {
                    console.log(`API Insight ${index + 1}:`, {
                        id: insight.id,
                        title: insight.title,
                        hasInsightContents: !!insight.insight_contents,
                        insightContentsLength: insight.insight_contents ? insight.insight_contents.length : 0
                    });
                });
            }
        })
        .catch(error => {
            console.error('❌ API test failed:', error);
        });
};

// 测试模态框摘要显示
window.testModalSummaryDisplay = function() {
    console.log('🧪 Testing Modal Summary Display...');
    
    if (!currentInsights || currentInsights.length === 0) {
        console.log('❌ No insights available for testing');
        return;
    }
    
    // 找到第一个有insight_contents的insight
    const insightWithContent = currentInsights.find(insight => 
        insight.insight_contents && insight.insight_contents.length > 0
    );
    
    if (!insightWithContent) {
        console.log('❌ No insights with content data found');
        return;
    }
    
    console.log('✅ Found insight with content:', insightWithContent.title);
    console.log('📝 Content data:', insightWithContent.insight_contents[0]);
    
    // 打开模态框进行测试
    openContentDetailModal(insightWithContent);
    
    // 检查模态框中的摘要元素
    setTimeout(() => {
        const summaryElement = document.getElementById('summaryText');
        if (summaryElement) {
            console.log('✅ Summary element found:', summaryElement);
            console.log('📝 Summary text content:', summaryElement.textContent);
            console.log('📝 Summary innerHTML:', summaryElement.innerHTML);
        } else {
            console.log('❌ Summary element not found');
        }
    }, 100);
};

console.log('🧪 Test functions loaded. Available commands:');
console.log('  - checkCurrentState() - Check current app state (viewMode, activeStackId)');
console.log('  - testFix() - Quick test of the stack_id fix');
console.log('  - testStackFiltering() - Test stack filtering logic');
console.log('  - testStackIdFunctionality() - Test creating insight with stack_id');
console.log('  - testDatabaseStackId() - Check database for stack_id values');
console.log('  - testAISummaryData() - Test AI summary data structure and API response');
console.log('  - testModalSummaryDisplay() - Test modal summary display functionality');
console.log('  - testStackContent(stackId) - Check specific stack content');
console.log('  - testBackendDebug() - Call backend debug endpoint');
console.log('  - testCreateAndVerify() - Create insight and verify stack_id immediately');
console.log('  - testApiDirectly() - Test API endpoints directly with different formats');
console.log('  - testBackendResponse() - Test backend API response format directly');
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
    
    // 使用动画事件监听器确保动画完成后再隐藏
    const handleTransitionEnd = () => {
        profileEditModal.style.display = 'none';
        profileEditModal.removeEventListener('transitionend', handleTransitionEnd);
    };
    
    profileEditModal.addEventListener('transitionend', handleTransitionEnd);
    
    // 备用超时（防止事件监听器失败）
    setTimeout(() => {
        if (profileEditModal.style.display !== 'none') {
            profileEditModal.style.display = 'none';
            profileEditModal.removeEventListener('transitionend', handleTransitionEnd);
        }
    }, 400); // 稍微长于CSS过渡时间
    
    // 使用滚动管理器恢复滚动
    scrollManager.enable();
    
    // 重置表单
    if (profileEditForm) {
        profileEditForm.reset();
    }
    
    // 重置头像预览
    if (avatarPreviewImg) {
        avatarPreviewImg.src = '';
        avatarPreviewImg.style.display = 'none';
    }
    
    // 重置头像上传
    const profileAvatarUpload = document.getElementById('profileAvatarUpload');
    if (profileAvatarUpload) {
        profileAvatarUpload.value = '';
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

    
    // Show loading state
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
    
    // 调试：打印insight数据结构
    console.log('🔍 DEBUG: populateModalContent called with insight:', insight);
    console.log('🔍 DEBUG: insight.insight_contents:', insight.insight_contents);
    if (insight.insight_contents && insight.insight_contents.length > 0) {
        console.log('🔍 DEBUG: First insight_contents item:', insight.insight_contents[0]);
        console.log('🔍 DEBUG: Summary from insight_contents:', insight.insight_contents[0].summary);
    }
    
    // 标题
    const titleElement = document.getElementById('modalContentTitle');
    if (titleElement) {
        titleElement.textContent = insight.title || new URL(insight.url).hostname;
    }
    
    // 图片处理
    const modalImage = document.getElementById('modalImage');
    const modalMedia = document.getElementById('modalMedia');
    
    if (modalImage && modalMedia) {
        if (insight.image_url) {
            modalImage.src = insight.image_url;
            modalImage.alt = insight.title || 'Content image';
            modalImage.style.display = 'block';
            modalMedia.classList.remove('no-image');
            
            modalImage.onerror = function() {
                modalImage.style.display = 'none';
                modalMedia.classList.add('no-image');
            };
        } else {
            modalImage.style.display = 'none';
            modalMedia.classList.add('no-image');
        }
    }
    
    // 用户评论 - 从insight_contents表中获取thought字段
    const commentElement = document.getElementById('commentDisplay');
    if (commentElement) {
        // 优先从insight_contents中获取thought，如果没有则使用insight.thought作为后备
        let thought = null;
        if (insight.insight_contents && insight.insight_contents.length > 0) {
            thought = insight.insight_contents[0].thought;
        }
        thought = thought || insight.thought; // 后备方案
        commentElement.textContent = thought || 'No comment added yet.';
    }
    
    // 填充评论编辑表单
    const commentTextarea = document.getElementById('commentTextarea');
    if (commentTextarea) {
        // 优先从insight_contents中获取thought，如果没有则使用insight.thought作为后备
        let thought = null;
        if (insight.insight_contents && insight.insight_contents.length > 0) {
            thought = insight.insight_contents[0].thought;
        }
        thought = thought || insight.thought; // 后备方案
        commentTextarea.value = thought || '';
    }
    
    // 填充AI摘要
    const summaryText = document.getElementById('summaryText');
    if (summaryText) {
        // 获取summary，优先从insight_contents中获取
        let summary = null;
        if (insight.insight_contents && insight.insight_contents.length > 0) {
            summary = insight.insight_contents[0].summary;
        }
        
        if (summary) {
            summaryText.textContent = summary;
        } else {
            summaryText.textContent = 'AI summary is being generated...';
        }
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
        // Check authentication status
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
            
            // Re-render页面以更新卡片标题
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
    
    // 设置标题编辑功能
    setupTitleEditing();
    
    // Note: Share button removed from user info section
    
    // 设置分享我的空间按钮
    const shareMySpaceBtn = document.querySelector('.share-my-space-btn');
    if (shareMySpaceBtn) {
        shareMySpaceBtn.onclick = () => {
            // TODO: Implement share my space functionality
            console.log('Share My Space clicked');
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
    const commentDisplay = document.getElementById('commentDisplay');
    const commentTextarea = document.getElementById('commentTextarea');
    
    if (!editCommentBtn || !commentDisplay || !commentTextarea) return;
    
    // 移除现有的事件监听器（防止重复添加）
    const newEditBtn = editCommentBtn.cloneNode(true);
    editCommentBtn.parentNode.replaceChild(newEditBtn, editCommentBtn);
    
    // 重新获取按钮引用
    const freshEditBtn = document.getElementById('editCommentBtn');
    
    // 编辑按钮点击事件
    freshEditBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // 如果当前是编辑模式，则保存
        if (freshEditBtn.textContent === 'Save') {
            saveComment();
            return;
        }
        
        // 防止重复进入编辑模式
        if (isCommentEditing) {
            console.log('⚠️ Already in editing mode, ignoring click');
            return;
        }
        
        console.log('🖱️ Entering edit mode...');
        
        // 进入编辑模式
        commentDisplay.style.display = 'none';
        commentTextarea.style.display = 'block';
        commentTextarea.focus();
        
        // 设置编辑模式标志
        isCommentEditing = true;
        
        // 更新按钮文本
        freshEditBtn.textContent = 'Save';
        
        // 添加取消按钮
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'ghost-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.marginLeft = '8px';
        cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            cancelComment();
        });
        freshEditBtn.parentNode.appendChild(cancelBtn);
    });
    
    // 保存评论函数
    async function saveComment() {
        // 防止重复保存
        if (isCommentEditing === false) {
            console.log('⚠️ Not in editing mode, ignoring save');
            return;
        }
        
        console.log('💾 Saving comment...');
        const newComment = commentTextarea.value.trim();
        
        try {
            // Check authentication status
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
            
            console.log('📡 Calling API to update comment...');
            
            // 调用API更新评论
            const response = await api.updateInsight(currentInsight.id, { 
                thought: newComment 
            });
            
            if (response.success) {
                console.log('✅ Comment saved successfully via API');
                
                // 更新显示的评论
                commentDisplay.textContent = newComment || 'No comment added yet.';
                
                // 更新本地数据 - 同时更新insight_contents和thought字段
                if (currentInsight) {
                    currentInsight.thought = newComment;
                    // 确保insight_contents数组存在
                    if (!currentInsight.insight_contents) {
                        currentInsight.insight_contents = [{}];
                    }
                    if (currentInsight.insight_contents.length === 0) {
                        currentInsight.insight_contents = [{}];
                    }
                    // 更新thought字段
                    currentInsight.insight_contents[0].thought = newComment;
                }
                
                // 更新全局insights数组
                if (window.currentInsights) {
                    const insightIndex = window.currentInsights.findIndex(i => i.id === currentInsight.id);
                    if (insightIndex !== -1) {
                        window.currentInsights[insightIndex].thought = newComment;
                        // 确保insight_contents数组存在
                        if (!window.currentInsights[insightIndex].insight_contents) {
                            window.currentInsights[insightIndex].insight_contents = [{}];
                        }
                        if (window.currentInsights[insightIndex].insight_contents.length === 0) {
                            window.currentInsights[insightIndex].insight_contents = [{}];
                        }
                        // 更新thought字段
                        window.currentInsights[insightIndex].insight_contents[0].thought = newComment;
                    }
                }
                
                // 更新stacks中的insight数据
                if (stacks) {
                    stacks.forEach(stack => {
                        const insightIndex = stack.cards.findIndex(card => card.id === currentInsight.id);
                        if (insightIndex !== -1) {
                            stack.cards[insightIndex].thought = newComment;
                            // 确保insight_contents数组存在
                            if (!stack.cards[insightIndex].insight_contents) {
                                stack.cards[insightIndex].insight_contents = [{}];
                            }
                            if (stack.cards[insightIndex].insight_contents.length === 0) {
                                stack.cards[insightIndex].insight_contents = [{}];
                            }
                            // 更新thought字段
                            stack.cards[insightIndex].insight_contents[0].thought = newComment;
                        }
                    });
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
        commentDisplay.style.display = 'block';
        commentTextarea.style.display = 'none';
        freshEditBtn.textContent = 'Edit';
        
        // 清除编辑模式标志
        isCommentEditing = false;
        
        // 移除取消按钮
        const cancelBtn = freshEditBtn.parentNode.querySelector('.ghost-btn:last-child');
        if (cancelBtn && cancelBtn.textContent === 'Cancel') {
            cancelBtn.remove();
        }
    }
    
    // 取消评论函数
    function cancelComment() {
        console.log('❌ Canceling comment edit...');
        
        // 恢复原始内容
        commentTextarea.value = commentDisplay.textContent;
        
        // 切换回显示模式
        commentDisplay.style.display = 'block';
        commentTextarea.style.display = 'none';
        freshEditBtn.textContent = 'Edit';
        
        // 清除编辑模式标志
        isCommentEditing = false;
        
        // 移除取消按钮
        const cancelBtn = freshEditBtn.parentNode.querySelector('.ghost-btn:last-child');
        if (cancelBtn && cancelBtn.textContent === 'Cancel') {
            cancelBtn.remove();
        }
    }
    
}

// 设置标题编辑功能
function setupTitleEditing() {
    const editTitleBtn = document.getElementById('editTitleBtn');
    const titleElement = document.getElementById('modalContentTitle');
    const titleContainer = document.querySelector('.title-with-edit');
    
    if (!editTitleBtn || !titleElement || !titleContainer) return;
    
    // 编辑按钮点击事件
    editTitleBtn.addEventListener('click', () => {
        enterTitleEditMode();
    });
    
    // 进入标题编辑模式
    function enterTitleEditMode() {
        const currentTitle = titleElement.textContent;
        
        // 添加编辑模式类
        titleContainer.classList.add('title-edit-mode');
        
        // 创建输入框
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'title-edit-input';
        input.value = currentTitle;
        input.id = 'titleEditInput';
        
        // 创建操作按钮容器
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'title-edit-actions';
        
        // 创建保存按钮
        const saveBtn = document.createElement('button');
        saveBtn.className = 'title-edit-save';
        saveBtn.innerHTML = '✓';
        saveBtn.title = 'Save';
        saveBtn.addEventListener('click', () => saveTitleEdit(input.value.trim()));
        
        // 创建取消按钮
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'title-edit-cancel';
        cancelBtn.innerHTML = '✕';
        cancelBtn.title = 'Cancel';
        cancelBtn.addEventListener('click', () => cancelTitleEdit());
        
        // 添加按钮到容器
        actionsContainer.appendChild(saveBtn);
        actionsContainer.appendChild(cancelBtn);
        
        // 插入输入框和按钮
        titleContainer.appendChild(input);
        titleContainer.appendChild(actionsContainer);
        
        // 聚焦并选中文本
        input.focus();
        input.select();
        
        // 添加键盘事件监听
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveTitleEdit(input.value.trim());
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelTitleEdit();
            }
        });
    }
    
    // 保存标题编辑
    async function saveTitleEdit(newTitle) {
        if (!newTitle) {
            showErrorMessage('Title cannot be empty');
            return;
        }
        
        try {
            // Check authentication status
            if (!auth.checkAuth()) {
                showErrorMessage('Please log in to update content');
                return;
            }
            
            // 获取当前洞察的ID
            const currentInsight = currentDetailInsight;
            if (!currentInsight || !currentInsight.id) {
                showErrorMessage('Unable to identify content to update');
                return;
            }
            
            // 调用API更新标题
            const response = await api.updateInsight(currentInsight.id, { 
                title: newTitle 
            });
            
            if (response.success) {
                // 更新显示的标题
                titleElement.textContent = newTitle;
                
                // 更新本地数据
                if (currentInsight) {
                    currentInsight.title = newTitle;
                }
                
                // 更新全局insights数组
                if (window.currentInsights) {
                    const insightIndex = window.currentInsights.findIndex(i => i.id === currentInsight.id);
                    if (insightIndex !== -1) {
                        window.currentInsights[insightIndex].title = newTitle;
                    }
                }
                
                // 更新页面缓存
                updatePageCacheWithInsight(currentInsight.id, { title: newTitle });
                
                // Re-render页面以更新卡片标题
                renderInsights();
                
                showSuccessMessage('Title updated successfully!');
            } else {
                showErrorMessage(response.message || 'Failed to update title');
            }
        } catch (error) {
            console.error('Error updating title:', error);
            showErrorMessage('Failed to update title. Please try again.');
        }
        
        // 退出编辑模式
        exitTitleEditMode();
    }
    
    // 取消标题编辑
    function cancelTitleEdit() {
        exitTitleEditMode();
    }
    
    // 退出标题编辑模式
    function exitTitleEditMode() {
        // 移除编辑模式类
        titleContainer.classList.remove('title-edit-mode');
        
        // 移除输入框和操作按钮
        const input = document.getElementById('titleEditInput');
        const actionsContainer = titleContainer.querySelector('.title-edit-actions');
        
        if (input) input.remove();
        if (actionsContainer) actionsContainer.remove();
    }
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
                <p>Click to add a new insight or create a stack</p>
                <div class="template-card-options">
                    <span class="template-option">📄 Insight</span>
                    <span class="template-option">📚 Stack</span>
                </div>
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
    const editModeBtn = document.getElementById('editModeBtn');
    const editBtnText = editModeBtn ? editModeBtn.querySelector('.edit-btn-text') : null;
    
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
        
        // Update button text and state
        if (editModeBtn && editBtnText) {
            editModeBtn.classList.add('active');
            editBtnText.textContent = 'Done';
        }
    } else {
        // Remove template card when not in edit mode
        const templateCard = document.querySelector('.template-card');
        if (templateCard) {
            templateCard.remove();
        }
        
        // Update button text and state
        if (editModeBtn && editBtnText) {
            editModeBtn.classList.remove('active');
            editBtnText.textContent = 'Edit';
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
            // Update the insight's stack_id to reflect it's now in a stack
            insight.stack_id = parseInt(stackId);
            
            // Also update the insight in allInsightsForFiltering if it exists
            if (window.allInsightsForFiltering) {
                const insightInGlobalArray = window.allInsightsForFiltering.find(i => i.id === insight.id);
                if (insightInGlobalArray) {
                    insightInGlobalArray.stack_id = parseInt(stackId);
                }
            }
            
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
            
            // Update the display to reflect the removed card
            // Only re-render if we're not in stack view mode
            if (viewMode !== 'stack') {
                // Force a complete re-render to ensure the card is properly removed
                renderInsights();
            }
            
            // Update stack actions if we're in stack view
            if (viewMode === 'stack' && activeStackId === stackId) {
                enhanceStackActions();
                bindEnhancedStackActions();
            }
            
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
    // DO NOT overwrite totalInsights or totalPages here; they come from backend pagination
    // This function should only update the UI, not recalculate pagination values
    
    // Ensure current page doesn't exceed total pages (safety check)
    if (currentPage > totalPages) {
        currentPage = totalPages;
    }
    
    // Update the UI with current pagination values
    updatePaginationUI();
}

// Test function for debugging pagination - can be called from browser console
window.testPagination = function() {
    console.log('🧪 PAGINATION TEST STARTED');
    console.log('🧪 Current state:');
    console.log('  - currentPage:', currentPage);
    console.log('  - totalPages:', totalPages);
    console.log('  - totalInsights:', totalInsights);
    console.log('  - insightsPerPage:', insightsPerPage);
    console.log('  - currentInsights.length:', currentInsights.length);
    console.log('  - pageCache size:', pageCache.size);
    console.log('  - loadedPages:', Array.from(loadedPages));
    
    console.log('🧪 Page cache contents:');
    for (const [pageNum, data] of pageCache) {
        console.log(`  Page ${pageNum}:`, {
            insightsCount: data.insights?.length || 0,
            hasMore: data.hasMore,
            timestamp: data.timestamp
        });
    }
    
    console.log('🧪 Testing page 2 navigation...');
    return goToPage(2, { force: true });
};

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
        // Skip auto-save if user is editing a comment
        if (isCommentEditing) {
            console.log('↩︎ skip auto-save: comment editing in progress');
            return;
        }
        
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
    
    // Use first card's image as preview, or random image if no image
    const firstCard = stackData.cards[0];
    const imageContainer = document.createElement('div');
    imageContainer.className = 'content-card-image-container';
    
    const img = document.createElement('img');
    img.src = (firstCard && firstCard.image_url) ? firstCard.image_url : getRandomImage();
    img.alt = firstCard ? (firstCard.title || 'Stack Preview') : 'Stack Preview';
    img.className = 'content-card-image';
    img.loading = 'lazy';
    
    // Image loading error handling
    img.onerror = function() {
        // If the original image fails to load and we haven't tried a random image yet, try a random one
        if (firstCard && firstCard.image_url && !this.dataset.randomImageUsed) {
            this.src = getRandomImage();
            this.dataset.randomImageUsed = 'true';
        } else {
            // If random image also fails, hide the image
            this.style.display = 'none';
            this.parentElement.classList.add('no-image');
        }
    };
    
    imageContainer.appendChild(img);
    card.appendChild(imageContainer);
    
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
    
    // Description (editable)
    const description = document.createElement('div');
    description.className = 'content-card-description stack-description';
    description.setAttribute('data-stack-id', stackData.id);
    description.innerHTML = `
        <span class="description-text">${stackData.description || 'A collection of related content'}</span>
        <button class="edit-description-btn" title="Edit description">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </button>
    `;
    
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
    
    // Add event listener for edit description button
    const editDescriptionBtn = description.querySelector('.edit-description-btn');
    if (editDescriptionBtn) {
        editDescriptionBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            startInlineDescriptionEdit(stackData.id, description);
        });
    }
    
    // Add event listener for description text click (also starts editing)
    const descriptionText = description.querySelector('.description-text');
    if (descriptionText) {
        descriptionText.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            startInlineDescriptionEdit(stackData.id, description);
        });
    }
    
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

// Start inline editing of stack description
function startInlineDescriptionEdit(stackId, descriptionElement) {
    const currentDescription = descriptionElement.querySelector('.description-text').textContent;
    
    // Create textarea element
    const textarea = document.createElement('textarea');
    textarea.value = currentDescription;
    textarea.className = 'stack-description-edit-input';
    textarea.style.cssText = `
        background: transparent;
        border: 2px solid var(--quest-purple);
        border-radius: 6px;
        padding: 8px 12px;
        font-size: 14px;
        font-family: inherit;
        color: var(--text-secondary);
        width: 100%;
        min-height: 60px;
        max-height: 120px;
        resize: vertical;
        outline: none;
        line-height: 1.4;
    `;
    
    // Replace the description content with textarea
    const container = descriptionElement;
    const descriptionText = container.querySelector('.description-text');
    const editBtn = container.querySelector('.edit-description-btn');
    
    // Hide the text and button
    if (descriptionText) descriptionText.style.display = 'none';
    if (editBtn) editBtn.style.display = 'none';
    
    container.appendChild(textarea);
    
    // Focus and select text
    textarea.focus();
    textarea.select();
    
    // Handle save on Enter (Ctrl+Enter) or blur
    const saveEdit = async () => {
        const newDescription = textarea.value.trim();
        const wasEdited = newDescription !== currentDescription;
        
        console.log('💾 Saving description edit:', { 
            stackId, 
            currentDescription, 
            newDescription, 
            wasEdited 
        });
        
        if (wasEdited) {
            try {
                await updateStackDescription(stackId, newDescription);
                // Update the stack data
                const stackData = stacks.get(stackId);
                if (stackData) {
                    stackData.description = newDescription;
                    stackData.modifiedAt = new Date().toISOString();
                    console.log('✅ Updated local stack data:', stackData);
                }
                
                // Update the display
                if (descriptionText) {
                    descriptionText.textContent = newDescription || 'A collection of related content';
                }
                
                showNotification('Stack description updated successfully', 'success');
            } catch (error) {
                console.error('❌ Error updating stack description:', error);
                showErrorMessage('Failed to update stack description');
            }
        } else {
            console.log('ℹ️ No changes to save');
        }
        
        // Restore the original display
        if (descriptionText) descriptionText.style.display = '';
        if (editBtn) editBtn.style.display = '';
        
        // Safely remove textarea if it exists
        if (textarea && textarea.parentNode) {
            textarea.parentNode.removeChild(textarea);
        }
    };
    
    // Handle cancel on Escape
    const cancelEdit = () => {
        // Restore the original display
        if (descriptionText) descriptionText.style.display = '';
        if (editBtn) editBtn.style.display = '';
        
        // Safely remove textarea if it exists
        if (textarea && textarea.parentNode) {
            textarea.parentNode.removeChild(textarea);
        }
    };
    
    // Save on Enter, cancel on Escape
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    });
    
    // Also save on blur as a fallback
    textarea.addEventListener('blur', saveEdit);
}

// Update stack description via API
async function updateStackDescription(stackId, newDescription) {
    try {
        console.log('🔄 Updating stack description:', { stackId, newDescription });
        console.log('🔍 Available stacks:', Array.from(stacks.keys()));
        console.log('🔍 Stack exists in memory:', stacks.has(stackId));
        
        const response = await api.updateStack(parseInt(stackId), { description: newDescription });
        console.log('✅ Stack description update response:', response);
        if (response && response.success) {
            showNotification('Stack description updated successfully', 'success');
            return response;
        } else {
            throw new Error('Failed to update stack description');
        }
    } catch (error) {
        console.error('❌ Error updating stack description:', error);
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
                        
                        // Re-render content based on current view mode
                        console.log('🔄 Re-rendering after item removal - viewMode:', viewMode, 'activeStackId:', activeStackId, 'stackId:', stackId);
                        if (viewMode === 'stack' && activeStackId === stackId) {
                            // We're in stack view and this is the active stack
                            const updatedStack = stacks.get(stackId);
                            console.log('📦 Updated stack from memory:', updatedStack);
                            console.log('📦 Stack cards count:', updatedStack ? updatedStack.cards.length : 'stack not found');
                            if (updatedStack && updatedStack.cards.length > 0) {
                                // Stack still has items - refresh with updated data
                                console.log('✅ Stack has items, refreshing with updated data');
                                console.log('📋 Cards to render:', updatedStack.cards.map(c => ({ id: c.id, title: c.title })));
                                renderStackInsights(updatedStack);
                            } else {
                                // Stack is now empty - show empty state
                                console.log('📭 Stack is empty, showing empty state');
                                const emptyStack = { id: stackId, cards: [], name: 'Empty Stack' };
                                renderStackInsights(emptyStack);
                            }
                        } else {
                            // We're in home view - render normally
                            console.log('🏠 In home view, rendering normally');
                            renderInsights();
                        }
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
    
    // Card image - always show an image (either original or random)
    const imageContainer = document.createElement('div');
    imageContainer.className = 'stack-card-image-container';
    
    const img = document.createElement('img');
    img.src = insight.image_url || getRandomImage();
    img.alt = insight.title || 'Content Image';
    img.className = 'stack-card-image';
    img.loading = 'lazy';
    
    // Image loading error handling
    img.onerror = function() {
        // If the original image fails to load and we haven't tried a random image yet, try a random one
        if (insight.image_url && !this.dataset.randomImageUsed) {
            this.src = getRandomImage();
            this.dataset.randomImageUsed = 'true';
        } else {
            // If random image also fails, hide the image
            this.style.display = 'none';
            this.parentElement.classList.add('no-image');
        }
    };
    
    imageContainer.appendChild(img);
    card.appendChild(imageContainer);
    
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
            
            // Re-render main view based on current view mode
            if (viewMode === 'stack' && activeStackId === stackId) {
                // We're in stack view and this is the active stack
                const updatedStack = stacks.get(stackId);
                if (updatedStack && updatedStack.cards.length > 0) {
                    // Stack still has items - refresh with updated data
                    renderStackInsights(updatedStack);
                } else {
                    // Stack is now empty - show empty state
                    const emptyStack = { id: stackId, cards: [], name: 'Empty Stack' };
                    renderStackInsights(emptyStack);
                }
            } else {
                // We're in home view - render normally
                renderInsights();
            }
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
    
    // Card image area (same as normal card) - always show an image (either original or random)
    const imageContainer = document.createElement('div');
    imageContainer.className = 'content-card-image-container';
    
    const image = document.createElement('img');
    image.className = 'content-card-image';
    image.src = insight.image_url || getRandomImage();
    image.alt = insight.title || 'Content image';
    image.loading = 'lazy';
    
    // Image loading error handling
    image.onerror = function() {
        // If the original image fails to load and we haven't tried a random image yet, try a random one
        if (insight.image_url && !this.dataset.randomImageUsed) {
            this.src = getRandomImage();
            this.dataset.randomImageUsed = 'true';
        } else {
            // If random image also fails, hide the image
            this.style.display = 'none';
            this.parentElement.classList.add('no-image');
        }
    };
    
    imageContainer.appendChild(image);
    card.appendChild(imageContainer);
    
    // Card content area (same as normal card)
    const cardContent = document.createElement('div');
    cardContent.className = 'content-card-content';
    
    // Card header - Top row with date and source info (same as normal card)
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
    
    // Card description (same as normal card)
    const description = document.createElement('div');
    description.className = 'content-card-description';
    description.textContent = insight.description || (insight.url ? `Content from ${new URL(insight.url).hostname}` : 'No description available');
    
    // Card footer (same as normal card)
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
    
    // Assemble card content (same as normal card)
    cardContent.appendChild(cardHeader);
    cardContent.appendChild(description);
    cardContent.appendChild(cardFooter);
    
    // Assemble complete card (same as normal card)
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
            
            clearPageCache(); // Clear cache because data has changed
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

// ===== INLINE TAG EDITOR =====

let currentEditingInsight = null;
let selectedTagIds = new Set();

// Show inline tag editor
function showInlineTagEditor(insight) {
    currentEditingInsight = insight;
    selectedTagIds.clear();
    
    // Add current tag to selected set (only one tag allowed)
    if (insight.tags && insight.tags.length > 0) {
        const firstTag = insight.tags[0]; // Only take the first tag
        const tagId = typeof firstTag === 'string' ? firstTag : (firstTag.id || firstTag.tag_id || firstTag.user_tag_id);
        if (tagId) {
            selectedTagIds.add(tagId);
        }
    }
    
    // Show the tag editing section
    const tagEditingSection = document.getElementById('tagEditingSection');
    if (tagEditingSection) {
        tagEditingSection.style.display = 'block';
        
        // Populate available tags
        populateAvailableTags();
        
        // Bind save and cancel events
        bindTagEditorEvents();
    }
}

// Populate available tags
function populateAvailableTags() {
    const availableTagsList = document.getElementById('availableTagsList');
    if (!availableTagsList) return;
    
    // Get all available tags (user tags + PARA tags)
    const allTags = [];
    
    // Add user tags
    if (window.userTags && window.userTags.length > 0) {
        window.userTags.forEach(tag => {
            allTags.push({
                id: tag.id,
                name: tag.name,
                color: tag.color,
                type: 'user'
            });
        });
    }
    
    // Add PARA tags
    const paraTags = [
        { id: 'project', name: 'Project', color: '#3B82F6', type: 'para' },
        { id: 'area', name: 'Area', color: '#10B981', type: 'para' },
        { id: 'resource', name: 'Resource', color: '#F59E0B', type: 'para' },
        { id: 'archive', name: 'Archive', color: '#6B7280', type: 'para' }
    ];
    
    allTags.push(...paraTags);
    
    // Clear existing content
    availableTagsList.innerHTML = '';
    
    // Add header
    const header = document.createElement('h4');
    header.textContent = 'Available Tags';
    availableTagsList.appendChild(header);
    
    // Create tags container
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'available-tags-list';
    
    // Add each tag
    allTags.forEach(tag => {
        const tagElement = document.createElement('div');
        tagElement.className = 'available-tag';
        tagElement.dataset.tagId = tag.id;
        tagElement.dataset.tagName = tag.name;
        tagElement.dataset.tagColor = tag.color;
        
        // Add color indicator
        const colorIndicator = document.createElement('div');
        colorIndicator.className = 'tag-color';
        colorIndicator.style.backgroundColor = tag.color;
        tagElement.appendChild(colorIndicator);
        
        // Add tag name
        const tagName = document.createElement('span');
        tagName.textContent = tag.name;
        tagElement.appendChild(tagName);
        
        // Add click handler
        tagElement.onclick = () => toggleTagSelection(tag.id, tag.name, tag.color);
        
        // Mark as selected if already selected
        if (selectedTagIds.has(tag.id)) {
            tagElement.classList.add('selected');
        }
        
        tagsContainer.appendChild(tagElement);
    });
    
    availableTagsList.appendChild(tagsContainer);
}

// Toggle tag selection (single tag only)
function toggleTagSelection(tagId, tagName, tagColor) {
    if (selectedTagIds.has(tagId)) {
        // If clicking the same tag, deselect it
        selectedTagIds.clear();
    } else {
        // Clear any existing selection and select the new tag
        selectedTagIds.clear();
        selectedTagIds.add(tagId);
    }
    
    // Update UI
    updateAvailableTagsUI();
}

// Update available tags UI to show selection state
function updateAvailableTagsUI() {
    const availableTags = document.querySelectorAll('.available-tag');
    availableTags.forEach(tag => {
        const tagId = tag.dataset.tagId;
        if (selectedTagIds.has(tagId)) {
            tag.classList.add('selected');
        } else {
            tag.classList.remove('selected');
        }
    });
}


// Bind tag editor events
function bindTagEditorEvents() {
    const saveBtn = document.getElementById('saveTagsBtn');
    const cancelBtn = document.getElementById('cancelTagsBtn');
    
    if (saveBtn) {
        saveBtn.onclick = saveTagChanges;
    }
    
    if (cancelBtn) {
        cancelBtn.onclick = cancelTagEditing;
    }
}

// Save tag changes
async function saveTagChanges() {
    if (!currentEditingInsight) return;
    
    try {
        // Convert selected tag IDs to tag objects
        const tagsToSave = Array.from(selectedTagIds).map(tagId => {
            // Check if it's a PARA tag
            const paraTags = ['project', 'area', 'resource', 'archive'];
            if (paraTags.includes(tagId)) {
                return { id: tagId, name: tagId.charAt(0).toUpperCase() + tagId.slice(1) };
            }
            
            // Find user tag
            if (window.userTags) {
                const userTag = window.userTags.find(tag => tag.id === tagId);
                if (userTag) {
                    return { id: userTag.id, name: userTag.name, color: userTag.color };
                }
            }
            
            return { id: tagId, name: tagId };
        });
        
        // Update the insight with new tags
        currentEditingInsight.tags = tagsToSave;
        
        // Update the primary tag display in modal
        updatePrimaryTagDisplay(tagsToSave[0]);
        
        // Hide the tag editor
        hideInlineTagEditor();
        
        // Show success message (optional)
        console.log('✅ Tags updated successfully');
        
    } catch (error) {
        console.error('❌ Error saving tags:', error);
    }
}

// Cancel tag editing
function cancelTagEditing() {
    hideInlineTagEditor();
}

// Hide inline tag editor
function hideInlineTagEditor() {
    const tagEditingSection = document.getElementById('tagEditingSection');
    if (tagEditingSection) {
        tagEditingSection.style.display = 'none';
    }
    
    currentEditingInsight = null;
    selectedTagIds.clear();
}

// Update primary tag display
function updatePrimaryTagDisplay(primaryTag) {
    const primaryTagElement = document.getElementById('primaryTag');
    if (primaryTagElement && primaryTag) {
        primaryTagElement.textContent = primaryTag.name;
    }
}

/* Optional: if your HTML includes a <div id="loadingSkeleton"> block from old code,
   you can keep it for first paint and then hide it gracefully once JS runs.
*/
(function hydrateInitialSkeleton() {
    const initial = document.getElementById('loadingSkeleton');
    if (initial) {
        initial.style.opacity = '1';
        initial.style.transition = 'opacity .18s ease';
        window.addEventListener('load', () => { 
            initial.style.opacity = '0'; 
            initial.remove(); 
        }, { once: true });
    }
})();

// ===== DEBUG AND TEST FUNCTIONS =====

// Test function to debug comment functionality
window.testCommentFunctionality = async function() {
    console.log('🧪 Starting comment functionality tests...');
    
    // Test 1: Check if modal elements exist
    console.log('\n📋 Test 1: Checking modal elements...');
    const commentElement = document.getElementById('commentDisplay');
    const commentTextarea = document.getElementById('commentTextarea');
    const commentDisplay = document.getElementById('commentDisplay');
    const editCommentBtn = document.getElementById('editCommentBtn');
    
    console.log('commentDisplay:', commentElement);
    console.log('commentTextarea:', commentTextarea);
    console.log('commentDisplay:', commentDisplay);
    console.log('editCommentBtn:', editCommentBtn);
    
    if (!commentElement || !commentTextarea || !commentDisplay || !editCommentBtn) {
        console.error('❌ Missing modal elements!');
        return;
    }
    
    // Test 2: Check current insight data
    console.log('\n📋 Test 2: Checking current insight data...');
    console.log('currentDetailInsight:', currentDetailInsight);
    
    if (currentDetailInsight) {
        console.log('insight.thought:', currentDetailInsight.thought);
        console.log('insight.insight_contents:', currentDetailInsight.insight_contents);
        
        if (currentDetailInsight.insight_contents && currentDetailInsight.insight_contents.length > 0) {
            console.log('insight.insight_contents[0].thought:', currentDetailInsight.insight_contents[0].thought);
        }
    } else {
        console.warn('⚠️ No current insight selected');
    }
    
    // Test 3: Check current display values
    console.log('\n📋 Test 3: Checking current display values...');
    console.log('commentElement.textContent:', commentElement.textContent);
    console.log('commentTextarea.value:', commentTextarea.value);
    console.log('commentDisplay.textContent:', commentDisplay.textContent);
    
    // Test 4: Test comment extraction logic
    console.log('\n📋 Test 4: Testing comment extraction logic...');
    if (currentDetailInsight) {
        let thought = null;
        if (currentDetailInsight.insight_contents && currentDetailInsight.insight_contents.length > 0) {
            thought = currentDetailInsight.insight_contents[0].thought;
        }
        thought = thought || currentDetailInsight.thought;
        console.log('Extracted thought:', thought);
    }
    
    // Test 5: Test API call
    console.log('\n📋 Test 5: Testing API call...');
    if (currentDetailInsight && currentDetailInsight.id) {
        try {
            const response = await api.getInsight(currentDetailInsight.id);
            console.log('API response:', response);
            
            if (response.success && response.data) {
                console.log('API data.thought:', response.data.thought);
                console.log('API data.insight_contents:', response.data.insight_contents);
            }
        } catch (error) {
            console.error('API call failed:', error);
        }
    }
    
    console.log('\n✅ Comment functionality tests completed!');
};

// Test function to debug edit button behavior
window.testEditButtonBehavior = function() {
    console.log('🧪 Testing edit button behavior...');
    
    const editCommentBtn = document.getElementById('editCommentBtn');
    const commentDisplay = document.getElementById('commentDisplay');
    const commentTextarea = document.getElementById('commentTextarea');
    
    if (!editCommentBtn || !commentDisplay || !commentTextarea) {
        console.error('❌ Missing elements for edit button test');
        return;
    }
    
    console.log('Initial state:');
    console.log('Button text:', editCommentBtn.textContent);
    console.log('isCommentEditing:', isCommentEditing);
    console.log('commentDisplay.style.display:', commentDisplay.style.display);
    console.log('commentTextarea.style.display:', commentTextarea.style.display);
    
    // Check for multiple event listeners
    console.log('Event listeners on button:', getEventListeners ? getEventListeners(editCommentBtn) : 'getEventListeners not available');
    
    // Simulate click
    console.log('\n🖱️ Simulating edit button click...');
    editCommentBtn.click();
    
    setTimeout(() => {
        console.log('After click:');
        console.log('Button text:', editCommentBtn.textContent);
        console.log('isCommentEditing:', isCommentEditing);
        console.log('commentDisplay.style.display:', commentDisplay.style.display);
        console.log('commentTextarea.style.display:', commentTextarea.style.display);
        console.log('commentTextarea.value:', commentTextarea.value);
    }, 100);
};

// Test function to force populate comment data
window.testPopulateComment = function(testComment = 'Test comment from console') {
    console.log('🧪 Testing comment population...');
    
    const commentElement = document.getElementById('commentDisplay');
    const commentTextarea = document.getElementById('commentTextarea');
    const commentDisplay = document.getElementById('commentDisplay');
    
    if (!commentElement || !commentTextarea || !commentDisplay) {
        console.error('❌ Missing elements for comment population test');
        return;
    }
    
    console.log('Setting comment to:', testComment);
    
    // Update all comment elements
    commentElement.textContent = testComment;
    commentTextarea.value = testComment;
    commentDisplay.textContent = testComment;
    
    console.log('Updated values:');
    console.log('commentElement.textContent:', commentElement.textContent);
    console.log('commentTextarea.value:', commentTextarea.value);
    console.log('commentDisplay.textContent:', commentDisplay.textContent);
};

// Test function to check all insights for thought data
window.testAllInsightsThoughts = function() {
    console.log('🧪 Testing all insights for thought data...');
    
    if (window.currentInsights) {
        console.log(`Found ${window.currentInsights.length} insights`);
        
        window.currentInsights.forEach((insight, index) => {
            console.log(`\nInsight ${index + 1} (${insight.id}):`);
            console.log('  title:', insight.title);
            console.log('  thought:', insight.thought);
            console.log('  insight_contents:', insight.insight_contents);
            
            if (insight.insight_contents && insight.insight_contents.length > 0) {
                console.log('  insight_contents[0].thought:', insight.insight_contents[0].thought);
            }
        });
    } else {
        console.warn('⚠️ No currentInsights found');
    }
    
    if (stacks && stacks.size > 0) {
        console.log(`\nFound ${stacks.size} stacks`);
        stacks.forEach((stackData, stackId) => {
            console.log(`\nStack ${stackId} (${stackData.name}):`);
            stackData.cards.forEach((card, index) => {
                console.log(`  Card ${index + 1} (${card.id}):`);
                console.log('    title:', card.title);
                console.log('    thought:', card.thought);
                console.log('    insight_contents:', card.insight_contents);
                
                if (card.insight_contents && card.insight_contents.length > 0) {
                    console.log('    insight_contents[0].thought:', card.insight_contents[0].thought);
                }
            });
        });
    }
};

// Test function to simulate API update
window.testCommentUpdate = async function(testComment = 'Updated comment from console test') {
    console.log('🧪 Testing comment update...');
    
    if (!currentDetailInsight || !currentDetailInsight.id) {
        console.error('❌ No current insight selected');
        return;
    }
    
    try {
        console.log('Updating insight:', currentDetailInsight.id, 'with comment:', testComment);
        
        const response = await api.updateInsight(currentDetailInsight.id, { 
            thought: testComment 
        });
        
        console.log('API response:', response);
        
        if (response.success) {
            console.log('✅ Update successful');
            // Refresh the modal to see the changes
            if (typeof showDetailModal === 'function') {
                showDetailModal(currentDetailInsight.id);
            }
        } else {
            console.error('❌ Update failed:', response.message);
        }
    } catch (error) {
        console.error('❌ Update error:', error);
    }
};

// Quick test runner
window.runAllCommentTests = async function() {
    console.log('🚀 Running all comment tests...');
    
    await window.testCommentFunctionality();
    window.testEditButtonBehavior();
    window.testAllInsightsThoughts();
    
    console.log('\n🎯 To test comment update, run: testCommentUpdate("Your test comment")');
    console.log('🎯 To test comment population, run: testPopulateComment("Your test comment")');
};


