import { auth } from './auth.js';
import { api } from './api.js';
import { API_CONFIG } from './config.js';
import { PATHS, navigateTo } from './paths.js';

// DOM 元素
const profileAvatar = document.getElementById('profileAvatar');
const usernamePlaceholder = document.getElementById('usernamePlaceholder');
const contentCards = document.getElementById('contentCards');
const headerLogout = document.getElementById('headerLogout');
const headerEditProfile = document.getElementById('headerEditProfile');
const headerAvatar = document.getElementById('headerAvatar');
const addContentForm = document.getElementById('addContentForm');
const addContentModal = document.getElementById('addContentModal');
const closeAddModal = document.getElementById('closeAddModal');
const cancelAddBtn = document.getElementById('cancelAddBtn');

const filterButtons = document.getElementById('filterButtons');

// 页面状态
let currentUser = null;
let currentInsights = [];
let currentFilters = {
    latest: 'latest',  // 时间排序
    tags: null,        // 标签筛选
    type: 'all'        // 内容类型
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
        const [profileResult, insightsResult, tagsResult] = await Promise.allSettled([
            loadUserProfile(),
            loadUserInsights(),
            loadUserTags()
        ]);
        
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
        
        const response = await api.getUserStacksWithInsights();
        
        if (response.success && response.data) {
            // 将API返回的stacks数据转换为本地格式
            const apiStacks = response.data;
            stacks.clear(); // 清空现有stacks
            
            apiStacks.forEach(apiStack => {
                const stackData = {
                    id: apiStack.id.toString(),
                    name: apiStack.name || 'Stack',
                    cards: apiStack.insights || [], // API直接返回insights数组
                    createdAt: apiStack.created_at,
                    modifiedAt: apiStack.modified_at,
                    isExpanded: false
                };
                
                stacks.set(stackData.id, stackData);
            });
            
            // 更新stackIdCounter
            if (apiStacks.length > 0) {
                const maxId = Math.max(...apiStacks.map(s => parseInt(s.id)));
                stackIdCounter = maxId + 1;
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
            
            console.log('✅ 用户stacks加载成功:', stacks.size, '个stacks');
        } else {
            console.warn('⚠️ 没有stacks数据或API返回格式错误');
        }
    } catch (error) {
        console.error('❌ 加载用户stacks失败:', error);
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
        
        console.log('👤 开始加载用户资料...');
        
        // 尝试从本地存储获取用户信息
        const localUser = auth.getCurrentUser();
        if (localUser) {
            currentUser = localUser;
            console.log('✅ 使用本地存储的用户信息:', currentUser);
            updateUserProfileUI();
            return;
        }
        
        // 如果本地没有，尝试从 API 获取
        try {
            const response = await api.getUserProfile();
            
            if (response.success && response.data) {
                currentUser = response.data;
                console.log('✅ 用户资料加载成功:', currentUser);
                updateUserProfileUI();
            } else {
                throw new Error('API 返回格式错误');
            }
        } catch (profileError) {
            console.warn('⚠️ Profile API 调用失败，使用默认用户信息:', profileError);
            // 使用默认用户信息
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
        }
        userAvatar.style.display = 'block';
    }
    
    // 更新用户名
    if (actualUsername) {
        actualUsername.textContent = currentUser.nickname || currentUser.email || 'User';
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
        const displayName = currentUser.nickname || currentUser.email || 'User';
        welcomeMessage.textContent = `Welcome, ${displayName}!`;
    }
    
    console.log('✅ 用户资料UI已更新');
}

// 加载用户见解
async function loadUserInsights() {
    try {
        console.log('📚 开始加载用户insights...');
        
        // 使用新的API方法获取insights
        const response = await api.getInsights();
        
        console.log('📡 API响应:', response);
        
        if (response.success && response.data && response.data.insights) {
            currentInsights = response.data.insights;
            console.log('✅ 用户insights加载成功:', currentInsights.length, '条');
            
            // 检查每个insight的标签数据
            currentInsights.forEach((insight, index) => {
                console.log(`📖 Insight ${index + 1}:`, {
                    title: insight.title || insight.url,
                    tags: insight.tags,
                    tagsType: typeof insight.tags,
                    tagsLength: insight.tags ? insight.tags.length : 'null/undefined'
                });
            });
            
            renderInsights();
        } else {
            console.warn('⚠️ API返回格式不正确:', response);
            console.log('🔍 响应数据结构:', {
                success: response.success,
                hasData: !!response.data,
                dataKeys: response.data ? Object.keys(response.data) : 'no data',
                insightsField: response.data ? response.data.insights : 'no insights field'
            });
            currentInsights = [];
            renderInsights();
        }
    } catch (error) {
        console.error('❌ 加载用户insights失败:', error);
        
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
        
        currentInsights = [];
        renderInsights();
    }
}

// 渲染见解列表
function renderInsights() {
    if (!contentCards) return;
    
    // Hide loading skeleton
    const loadingSkeleton = document.getElementById('loadingSkeleton');
    if (loadingSkeleton) {
        loadingSkeleton.style.display = 'none';
    }
    
    // Mark content as loaded
    contentCards.classList.add('content-loaded');
    
    // Clear existing content cards (but keep skeleton for next time)
    const existingCards = contentCards.querySelectorAll('.content-card, .empty-state');
    existingCards.forEach(card => card.remove());
    
    if (currentInsights.length === 0) {
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
    
    // 根据筛选条件排序
    let sortedInsights = getFilteredInsights();
    
    sortedInsights.forEach(insight => {
        const card = createInsightCard(insight);
        contentCards.appendChild(card);
    });
    
    // 渲染stacks
    stacks.forEach(stackData => {
        const stackCard = createStackCard(stackData);
        contentCards.appendChild(stackCard);
    });
    
    // Update edit mode state after rendering cards
    updateEditModeState();
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
    editDeleteBtn.onclick = (e) => {
        e.stopPropagation();
        deleteInsight(insight.id);
    };
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
    
    // Debug: 检查title数据
    console.log('🔍 创建卡片标题:', {
        insightTitle: insight.title,
        insightUrl: insight.url,
        hostname: new URL(insight.url).hostname,
        finalTitle: insight.title || new URL(insight.url).hostname
    });
    
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
        console.log('🔍 开始为标签筛选器加载用户标签...');
        const response = await api.getUserTags();
        const tags = response.success ? response.data : [];
        
        console.log('🏷️ 获取到用户标签:', tags);
        console.log('🏷️ 标签数量:', tags.length);
        
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
                console.log(`✅ 添加标签选项: ${tag.name} (ID: ${tag.id})`);
            });
            console.log('✅ 标签筛选器选项加载完成');
        } else {
            console.log('🔍 没有用户标签可用');
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
        const response = await api.getUserTags();
        const userTags = response.success ? response.data : [];
        
        console.log('🏷️ 获取到用户标签:', userTags);
        
        // 清空现有按钮
        filterButtons.innerHTML = '';
        
        // 创建三个主要筛选按钮
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
                key: 'type',
                label: 'Type',
                type: 'dropdown',
                options: [
                    { key: 'all', label: 'All Content' },
                    { key: 'none', label: 'No Type' },
                    { key: 'articles', label: 'Articles' },
                    { key: 'videos', label: 'Videos' },
                    { key: 'images', label: 'Images' }
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
                        const filterType = filterConfig.key; // latest, tags, type
                        const optionLabel = option.querySelector('.filter-option-label').textContent;
                        console.log('🔍 用户选择筛选选项:', filterKey, '类型:', filterType, '标签:', optionLabel);
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
                        const filterType = filterConfig.key; // latest, tags, type
                        const optionLabel = option.querySelector('.filter-option-label').textContent;
                        console.log('🔍 用户选择筛选选项:', filterKey, '类型:', filterType, '标签:', optionLabel);
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
            
            console.log('✅ 创建筛选按钮:', filterConfig.key, filterConfig.label);
        });
        
        // Edit Tags按钮已移到标签选择器旁边，不再需要在这里添加
        

        
        console.log('✅ 筛选按钮初始化完成，共', mainFilterButtons.length, '个主要按钮');
        
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
    
    console.log('🔍 设置筛选条件:', filterType, '=', filterValue, '标签:', optionLabel);
    console.log('🔍 当前所有筛选条件:', currentFilters);
    
    // 更新按钮显示文本
    updateFilterButtonDisplay(filterType, filterValue, optionLabel);
    
    // 更新按钮状态
    updateFilterButtonStates();
    
    // 显示筛选状态
    showFilterStatus();
    
    // 重新渲染
    renderInsights();
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
    } else if (filterType === 'type') {
        // 内容类型：显示选中的类型
        if (optionLabel && filterValue !== 'all') {
            button.textContent = optionLabel;
        } else {
            button.textContent = 'Type';
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
    
    // 内容类型状态
    if (currentFilters.type && currentFilters.type !== 'all') {
        const typeButton = document.querySelector(`[data-filter="type"]`);
        if (typeButton) {
            const typeOption = typeButton.closest('.filter-button-container').querySelector(`[data-filter="${currentFilters.type}"]`);
            if (typeOption) {
                if (currentFilters.type === 'none') {
                    statusParts.push('无类型内容');
                } else {
                    statusParts.push(`类型: ${typeOption.textContent.trim()}`);
                }
            }
        }
    } else if (currentFilters.type === 'all') {
        statusParts.push('所有类型');
    }
    
    const statusText = statusParts.length > 0 ? statusParts.join(' | ') : '显示所有内容';
    console.log('📊 筛选状态:', statusText);
    
    // 可以在这里添加UI显示筛选状态
    // 比如在页面顶部显示一个小提示
}

// 获取当前筛选的文章
function getFilteredInsights() {
    let filteredInsights = [...currentInsights];
    
    console.log('🔍 当前筛选条件:', currentFilters);
    console.log('📚 当前文章数据:', currentInsights);
    
    // 1. 排序逻辑（始终应用）
    if (currentFilters.latest === 'latest') {
        // 按最新时间排序
        filteredInsights.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        console.log('📅 按最新时间排序');
    } else if (currentFilters.latest === 'oldest') {
        // 按最旧时间排序
        filteredInsights.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        console.log('📅 按最旧时间排序');
    } else if (currentFilters.latest === 'alphabetical') {
        // 按标题首字母A-Z排序
        filteredInsights.sort((a, b) => {
            const titleA = (a.title || a.url || '').toLowerCase();
            const titleB = (b.title || b.url || '').toLowerCase();
            return titleA.localeCompare(titleB);
        });
        console.log('🔤 按标题首字母A-Z排序');
    } else {
        // 默认按最新时间排序
        filteredInsights.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        console.log('📅 默认按最新时间排序');
    }
    
    // 2. 标签筛选
    if (currentFilters.tags && currentFilters.tags !== 'all') {
        if (currentFilters.tags.startsWith('tag_')) {
            const tagId = currentFilters.tags.replace('tag_', '');
            console.log('🏷️ 筛选标签ID:', tagId);
            
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
            
            console.log('🎯 标签筛选后的文章数量:', filteredInsights.length);
        }
    } else {
        console.log('🏷️ 显示所有标签的内容');
    }
    
    // 3. 内容类型筛选
    if (currentFilters.type && currentFilters.type !== 'all') {
        console.log('📚 筛选内容类型:', currentFilters.type);
        
        if (currentFilters.type === 'none') {
            // 筛选没有类型的内容
            filteredInsights = filteredInsights.filter(insight => {
                // 这里可以根据实际的数据结构来判断内容类型
                // 暂时先返回true，等有具体需求再实现
                return true;
            });
            console.log('🎯 筛选无类型内容后的文章数量:', filteredInsights.length);
        } else {
            // 筛选特定类型的内容
            filteredInsights = filteredInsights.filter(insight => {
                // 这里可以根据实际的数据结构来判断内容类型
                // 暂时先返回true，等有具体需求再实现
                return true;
            });
            console.log('🎯 类型筛选后的文章数量:', filteredInsights.length);
        }
    } else {
        console.log('📚 显示所有类型的内容');
    }
    
    console.log('🎯 最终筛选后的文章数量:', filteredInsights.length);
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
        await loadUserInsights();
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
    console.log('🔍 显示添加内容模态框...');
    console.log('🔍 弹窗元素:', addContentModal);
    
    if (addContentModal) {
        // 确保弹窗可见
        addContentModal.style.display = 'flex';
        addContentModal.style.alignItems = 'center';
        addContentModal.style.justifyContent = 'center';
        
        // 添加show类
        addContentModal.classList.add('show');
        
        // 使用滚动管理器禁用滚动
        scrollManager.disable();
        
        console.log('✅ 弹窗样式已设置');
        console.log('🔍 弹窗当前样式:', {
            display: addContentModal.style.display,
            alignItems: addContentModal.style.alignItems,
            justifyContent: addContentModal.style.justifyContent,
            classList: addContentModal.classList.toString()
        });
        
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
        
        console.log('✅ 模态框已关闭，页面滚动已恢复');
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
                
                // 调试token状态
                console.log('🔍 当前认证状态:', {
                    isAuthenticated: auth.checkAuth(),
                    hasUser: !!auth.getCurrentUser(),
                    sessionToken: !!localStorage.getItem('quest_user_session')
                });
                
                // 验证token是否有效
                const tokenValid = await auth.validateToken();
                if (!tokenValid) {
                    showErrorMessage('Your session has expired. Please log in again.');
                    return;
                }
                
                console.log('✅ Token验证通过，开始添加内容...');
                
                // 显示加载状态
                const submitBtn = document.getElementById('addContentBtn');
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<svg class="loading-spinner" width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.416" stroke-dashoffset="31.416"><animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/><animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/></circle></svg> Adding...';
                submitBtn.disabled = true;
                
                console.log('🔍 开始从URL创建insight...');
                
                // 获取选中的标签
                const selectedTags = getSelectedTags();
                console.log('🏷️ 选中的标签:', selectedTags);
                
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
                
                console.log('📝 创建insight，数据:', insightData);
                console.log('🔍 tag_ids类型:', typeof insightData.tag_ids, '长度:', insightData.tag_ids ? insightData.tag_ids.length : 0);
                
                // 使用正确的API端点创建insight
                const result = await api.createInsight(insightData);
                console.log('✅ 创建见解成功:', result);
                console.log('🔍 检查返回的insight数据:', {
                    title: result.data?.title,
                    customTitle: customTitle,
                    url: result.data?.url,
                    fullData: result.data
                });
                
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
                    console.log('🔄 开始重新加载内容...');
                    try {
                        await loadUserInsights();
                        console.log('✅ 内容重新加载完成');
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

// 加载用户标签
async function loadUserTags() {
    try {
        console.log('🏷️ 开始加载用户标签...');
        
        // 使用新的API方法获取标签
        const response = await api.getUserTags();
        
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
    console.log('🔍 开始渲染标签选择器...');
    
    const tagSelectorOptions = document.getElementById('tagSelectorOptions');
    if (!tagSelectorOptions) {
        console.error('❌ 标签选择器选项容器未找到');
        return;
    }
    
    tagSelectorOptions.innerHTML = '';
    
    if (tags.length === 0) {
        console.log('🔍 没有标签可用');
        tagSelectorOptions.innerHTML = '<div class="no-tags">No tags available. Create some tags first!</div>';
        return;
    }
    
    console.log('🏷️ 渲染标签选择器，标签数量:', tags.length);
    console.log('🏷️ 标签数据:', tags);
    
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
        
        console.log(`🔍 创建标签选项 ${index + 1}:`, {
            id: tag.id,
            name: tag.name,
            color: tag.color,
            element: tagOption
        });
        
        // 绑定点击事件
        tagOption.addEventListener('click', (e) => {
            console.log('🔍 标签选项被点击:', {
                tagId: tag.id,
                tagName: tag.name,
                target: e.target
            });
            
            // 防止点击radio时触发两次
            if (e.target.type === 'radio') {
                console.log('🔍 点击的是单选按钮，跳过处理');
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
            
            console.log('✅ 标签已选中:', tag.name);
            
            updateSelectedTagsDisplay();
        });
        
        tagSelectorOptions.appendChild(tagOption);
    });
    
    console.log('✅ 标签选择器渲染完成');
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
    console.log('🔍 开始绑定标签选择器事件...');
    
    const tagSelectorTrigger = document.getElementById('tagSelectorTrigger');
    const tagSelectorDropdown = document.getElementById('tagSelectorDropdown');
    
    console.log('🔍 标签选择器元素:', {
        trigger: tagSelectorTrigger,
        dropdown: tagSelectorDropdown
    });
    
    if (!tagSelectorTrigger || !tagSelectorDropdown) {
        console.error('❌ 标签选择器元素未找到');
        return;
    }
    
    // 点击触发器显示/隐藏下拉选项
    tagSelectorTrigger.addEventListener('click', (e) => {
        console.log('🔍 标签选择器触发器被点击');
        e.stopPropagation();
        tagSelectorDropdown.classList.toggle('open');
        
        const isOpen = tagSelectorDropdown.classList.contains('open');
        console.log('🔍 下拉框状态:', isOpen ? '展开' : '收缩');
        
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
            console.log('🔍 标签选项被点击:', e.target);
            e.stopPropagation();
        });
    }
    
    console.log('✅ 标签选择器事件绑定完成');
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
    
    console.log('🔍 查找选中的标签，找到单选按钮:', radio ? '是' : '否');
    
    if (radio) {
        const tagId = radio.value;
        const tagOption = radio.closest('.tag-option');
        
        if (tagOption) {
            const tagName = tagOption.dataset.tagName || 'Unknown Tag';
            const tagColor = tagOption.dataset.tagColor || '#667eea';
            
            console.log(`🔍 选中的标签:`, { id: tagId, name: tagName, color: tagColor });
            
            selectedTags.push({ 
                id: tagId, 
                name: tagName, 
                color: tagColor 
            });
        }
    }
    
    console.log('✅ 最终选中的标签:', selectedTags);
    return selectedTags;
}

// 显示创建标签模态框
function showCreateTagModal() {
    console.log('🔍 显示创建标签模态框...');
    
    const modal = document.getElementById('createTagModal');
    console.log('🔍 创建标签模态框元素:', modal);
    
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
        
        console.log('✅ 创建标签模态框已显示');
        
        // 聚焦到输入框
        const tagNameInput = document.getElementById('newTagName');
        if (tagNameInput) {
            tagNameInput.focus();
            console.log('✅ 标签名称输入框已聚焦');
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
    console.log('🔍 开始创建新标签...');
    
    const tagNameInput = document.getElementById('newTagName');
    console.log('🔍 标签名称输入框:', tagNameInput);
    
    if (!tagNameInput) {
        console.error('❌ 找不到标签名称输入框');
        showErrorMessage('Tag name input not found');
        return;
    }
    
    const tagName = tagNameInput.value.trim();
    console.log('🔍 标签名称值:', `"${tagName}"`);
    
    if (!tagName) {
        console.log('❌ 标签名称为空');
        showErrorMessage('Please enter a tag name');
        return;
    }
    
    const defaultColor = '#8B5CF6'; // 默认紫色
    
    try {
        console.log('🏷️ Creating new tag:', { name: tagName, color: defaultColor });
        
        // 使用API方法创建标签
        const response = await api.createUserTag({
            name: tagName,
            color: defaultColor
        });
        
        if (response.success && response.data) {
            console.log('✅ Tag created successfully:', response.data);
            
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
        const response = await api.getUserTags();
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

// 测试insight数据格式
function testInsightDataFormat() {
    console.log('🧪 测试insight数据格式...');
    
    // 模拟数据（使用新的API格式）
    const testData = {
        url: 'https://example.com/article',
        thought: '测试想法',
        tag_ids: ['550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002']
    };
    
    console.log('📝 测试数据:', testData);
    console.log('🔍 数据验证:');
    console.log('- URL长度:', testData.url.length, '<= 500:', testData.url.length <= 500);
    console.log('- 想法长度:', testData.thought.length, '<= 2000:', testData.thought.length <= 2000);
    console.log('- 标签ID数量:', testData.tag_ids.length);
    console.log('- 标签ID格式:', Array.isArray(testData.tag_ids) ? '正确' : '错误');
    console.log('📝 注意: title和description由后端自动从网页提取，无需前端传递');
    
    return testData;
}

// 将测试函数暴露到全局，方便在控制台调用
window.testInsightDataFormat = testInsightDataFormat;

// 测试标签筛选功能
function testTagFiltering() {
    console.log('🧪 测试标签筛选功能...');
    
    console.log('🔍 当前筛选条件:', currentFilter);
    console.log('📚 当前insights数量:', currentInsights.length);
    console.log('🏷️ 当前标签数据:', currentInsights.map(insight => ({
        title: insight.title || insight.url,
        tags: insight.tags
    })));
    
    // 测试筛选逻辑
    const filtered = getFilteredInsights();
    console.log('🎯 筛选后的insights数量:', filtered.length);
    
    return {
        currentFilter,
        totalInsights: currentInsights.length,
        filteredInsights: filtered.length,
        filterLogic: 'working'
    };
}

// 将测试函数暴露到全局
window.testTagFiltering = testTagFiltering;

// 测试图片显示功能
function testImageDisplay() {
    console.log('🖼️ 测试图片显示功能...');
    
    // 检查当前insights的图片数据
    const insightsWithImages = currentInsights.filter(insight => insight.image_url);
    const insightsWithoutImages = currentInsights.filter(insight => !insight.image_url);
    
    console.log('📊 图片数据统计:');
    console.log('- 有图片的insights:', insightsWithImages.length);
    console.log('- 无图片的insights:', insightsWithoutImages.length);
    
    if (insightsWithImages.length > 0) {
        console.log('🖼️ 有图片的insights示例:');
        insightsWithImages.slice(0, 3).forEach((insight, index) => {
            console.log(`${index + 1}. ${insight.title || insight.url}`);
            console.log(`   图片URL: ${insight.image_url}`);
        });
    }
    
    if (insightsWithoutImages.length > 0) {
        console.log('📷 无图片的insights示例:');
        insightsWithoutImages.slice(0, 3).forEach((insight, index) => {
            console.log(`${index + 1}. ${insight.title || insight.url}`);
            console.log(`   图片URL: ${insight.image_url || '无'}`);
        });
    }
    
    return {
        totalInsights: currentInsights.length,
        withImages: insightsWithImages.length,
        withoutImages: insightsWithoutImages.length,
        imageDisplay: 'working'
    };
}

// 将测试函数暴露到全局
window.testImageDisplay = testImageDisplay;

// 调试标签功能
function debugTags() {
    console.log('🔍 调试标签功能...');
    
    console.log('📊 当前insights数据:');
    currentInsights.forEach((insight, index) => {
        console.log(`${index + 1}. ${insight.title || insight.url}`);
        console.log(`   标签数据:`, insight.tags);
        console.log(`   标签类型:`, typeof insight.tags);
        console.log(`   标签长度:`, insight.tags ? insight.tags.length : 'null/undefined');
        if (insight.tags && insight.tags.length > 0) {
            insight.tags.forEach((tag, tagIndex) => {
                console.log(`     - 标签${tagIndex + 1}:`, tag);
                console.log(`       类型:`, typeof tag);
                console.log(`       内容:`, tag);
            });
        }
        console.log('---');
    });
    
    // 检查筛选按钮
    if (filterButtons) {
        const tagButtons = filterButtons.querySelectorAll('[data-filter^="tag_"]');
        console.log('🏷️ 标签筛选按钮数量:', tagButtons.length);
        tagButtons.forEach((btn, index) => {
            console.log(`   按钮${index + 1}:`, {
                filter: btn.dataset.filter,
                text: btn.textContent,
                tag: btn.dataset.tag
            });
        });
    }
    
    return {
        insightsCount: currentInsights.length,
        insightsWithTags: currentInsights.filter(i => i.tags && i.tags.length > 0).length,
        insightsWithoutTags: currentInsights.filter(i => !i.tags || i.tags.length === 0).length,
        tagButtonsCount: filterButtons ? filterButtons.querySelectorAll('[data-filter^="tag_"]').length : 0
    };
}

// 将调试函数暴露到全局
window.debugTags = debugTags;

// 分析标签数据结构
function analyzeTagStructure() {
    console.log('🔬 分析标签数据结构...');
    
    if (currentInsights.length === 0) {
        console.log('⚠️ 没有insights数据可分析');
        return;
    }
    
    // 分析第一个有标签的insight
    const insightWithTags = currentInsights.find(insight => insight.tags && insight.tags.length > 0);
    
    if (insightWithTags) {
        console.log('📖 分析有标签的insight:', insightWithTags.title || insightWithTags.url);
        console.log('🏷️ 标签数组:', insightWithTags.tags);
        console.log('🏷️ 标签数组类型:', Array.isArray(insightWithTags.tags) ? 'Array' : typeof insightWithTags.tags);
        console.log('🏷️ 标签数组长度:', insightWithTags.tags.length);
        
        insightWithTags.tags.forEach((tag, index) => {
            console.log(`🏷️ 标签${index + 1}详细分析:`);
            console.log(`   类型:`, typeof tag);
            console.log(`   值:`, tag);
            console.log(`   是否为对象:`, tag && typeof tag === 'object');
            if (tag && typeof tag === 'object') {
                console.log(`   对象键:`, Object.keys(tag));
                console.log(`   对象值:`, Object.values(tag));
                console.log(`   id字段:`, tag.id);
                console.log(`   tag_id字段:`, tag.tag_id);
                console.log(`   user_tag_id字段:`, tag.user_tag_id);
                console.log(`   name字段:`, tag.name);
                console.log(`   color字段:`, tag.color);
            }
            console.log('   ---');
        });
    } else {
        console.log('⚠️ 没有找到包含标签的insight');
    }
    
    // 分析筛选按钮的标签数据
    if (filterButtons) {
        const tagButtons = filterButtons.querySelectorAll('[data-filter^="tag_"]');
        console.log('🏷️ 筛选按钮标签数据:');
        tagButtons.forEach((btn, index) => {
            const filterKey = btn.dataset.filter;
            const tagId = filterKey.replace('tag_', '');
            console.log(`   按钮${index + 1}:`, {
                filter: filterKey,
                tagId: tagId,
                text: btn.textContent,
                buttonElement: btn
            });
        });
    }
    
    return {
        insightsWithTags: currentInsights.filter(i => i.tags && i.tags.length > 0).length,
        totalInsights: currentInsights.length,
        tagButtonsCount: filterButtons ? filterButtons.querySelectorAll('[data-filter^="tag_"]').length : 0
    };
}

// 将分析函数暴露到全局
window.analyzeTagStructure = analyzeTagStructure;

// 测试收缩框功能
function testTagSelector() {
    console.log('🧪 测试标签选择器收缩框功能...');
    
    const tagSelectorTrigger = document.getElementById('tagSelectorTrigger');
    const tagSelectorDropdown = document.getElementById('tagSelectorDropdown');
    const tagSelectorOptions = document.getElementById('tagSelectorOptions');
    
    console.log('🔍 标签选择器元素检查:');
    console.log('- 触发器:', tagSelectorTrigger ? '✅ 存在' : '❌ 不存在');
    console.log('- 下拉框:', tagSelectorDropdown ? '✅ 存在' : '❌ 不存在');
    console.log('- 选项容器:', tagSelectorOptions ? '✅ 存在' : '❌ 不存在');
    
    if (tagSelectorTrigger && tagSelectorDropdown) {
        console.log('🔍 当前状态:', tagSelectorDropdown.classList.contains('open') ? '展开' : '收缩');
        
        // 测试点击事件
        console.log('🖱️ 测试点击事件绑定...');
        const clickEvent = new Event('click');
        tagSelectorTrigger.dispatchEvent(clickEvent);
        
        setTimeout(() => {
            console.log('🔍 点击后状态:', tagSelectorDropdown.classList.contains('open') ? '展开' : '收缩');
            
            // 再次点击关闭
            tagSelectorTrigger.dispatchEvent(clickEvent);
            setTimeout(() => {
                console.log('🔍 再次点击后状态:', tagSelectorDropdown.classList.contains('open') ? '展开' : '收缩');
            }, 100);
        }, 100);
    }
    
    // 检查标签选项
    if (tagSelectorOptions) {
        const tagOptions = tagSelectorOptions.querySelectorAll('.tag-option');
        console.log('🏷️ 标签选项数量:', tagOptions.length);
        
        tagOptions.forEach((option, index) => {
            const checkbox = option.querySelector('.tag-checkbox');
            const tagName = option.dataset.tagName;
            const tagColor = option.dataset.tagColor;
            
            console.log(`   标签${index + 1}:`, {
                name: tagName,
                color: tagColor,
                hasCheckbox: !!checkbox,
                checkboxChecked: checkbox ? checkbox.checked : 'N/A'
            });
        });
    }
    
    return {
        triggerExists: !!tagSelectorTrigger,
        dropdownExists: !!tagSelectorDropdown,
        optionsExist: !!tagSelectorOptions,
        isOpen: tagSelectorDropdown ? tagSelectorDropdown.classList.contains('open') : false,
        tagOptionsCount: tagSelectorOptions ? tagSelectorOptions.querySelectorAll('.tag-option').length : 0
    };
}

// 将测试函数暴露到全局
window.testTagSelector = testTagSelector;

// 测试insight卡片渲染
function testInsightCardRendering() {
    console.log('🧪 测试insight卡片渲染...');
    
    if (currentInsights.length === 0) {
        console.log('⚠️ 没有insights数据可测试');
        return;
    }
    
    // 测试第一个insight的标签渲染
    const firstInsight = currentInsights[0];
    console.log('📖 测试insight:', firstInsight.title || firstInsight.url);
    console.log('🏷️ 标签数据:', firstInsight.tags);
    
    try {
        // 尝试创建卡片
        const card = createInsightCard(firstInsight);
        console.log('✅ 卡片创建成功:', card);
        
        // 检查标签元素
        const tags = card.querySelector('.content-card-tags');
        if (tags) {
            const tagElements = tags.querySelectorAll('.content-card-tag');
            console.log('🏷️ 渲染的标签数量:', tagElements.length);
            
            tagElements.forEach((tagEl, index) => {
                console.log(`   标签${index + 1}:`, {
                    text: tagEl.textContent,
                    className: tagEl.className,
                    hasColor: !!tagEl.style.backgroundColor
                });
            });
        }
        
        return { success: true, card: card };
    } catch (error) {
        console.error('❌ 卡片创建失败:', error);
        return { success: false, error: error.message };
    }
}

// 将测试函数暴露到全局
window.testInsightCardRendering = testInsightCardRendering;

// 测试insight卡片标签渲染
function testInsightCardTags() {
    console.log('🧪 测试insight卡片标签渲染...');
    
    if (currentInsights.length === 0) {
        console.log('⚠️ 没有insights数据可测试');
        return;
    }
    
    // 检查每个insight的标签状态
    currentInsights.forEach((insight, index) => {
        console.log(`📖 Insight ${index + 1}:`, insight.title || insight.url);
        console.log(`🏷️ 标签数据:`, insight.tags);
        console.log(`🔍 是否有标签:`, insight.tags && insight.tags.length > 0 ? '是' : '否');
        
        try {
            // 尝试创建卡片
            const card = createInsightCard(insight);
            const tagsContainer = card.querySelector('.content-card-tags');
            
            if (tagsContainer) {
                console.log(`✅ 标签容器存在，标签数量:`, tagsContainer.querySelectorAll('.content-card-tag').length);
            } else {
                console.log(`✅ 无标签容器（正确，因为没有标签）`);
            }
            
            console.log('---');
        } catch (error) {
            console.error(`❌ Insight ${index + 1} 卡片创建失败:`, error);
        }
    });
    
    return {
        totalInsights: currentInsights.length,
        withTags: currentInsights.filter(i => i.tags && i.tags.length > 0).length,
        withoutTags: currentInsights.filter(i => !i.tags || i.tags.length === 0).length
    };
}

// 将测试函数暴露到全局
window.testInsightCardTags = testInsightCardTags;

// 测试筛选功能
function testFiltering() {
    console.log('🧪 测试筛选功能...');
    console.log('当前筛选条件:', currentFilters);
    
    // 测试各种排序方式
    console.log('测试排序功能...');
    
    // 测试字母排序
    setFilter('latest', 'alphabetical', 'Alphabetical');
    
    setTimeout(() => {
        console.log('测试最旧优先...');
        setFilter('latest', 'oldest', 'Oldest');
    }, 1000);
    
    setTimeout(() => {
        console.log('测试最新优先...');
        setFilter('latest', 'latest', 'Latest');
    }, 2000);
    
    setTimeout(() => {
        console.log('测试所有类型...');
        setFilter('type', 'all', 'All Content');
    }, 3000);
    
    setTimeout(() => {
        console.log('测试所有标签...');
        setFilter('tags', 'all', 'All Tags');
    }, 4000);
}

// 测试排序功能
function testSorting() {
    console.log('🔤 测试排序功能...');
    console.log('当前排序方式:', currentFilters.latest);
    
    const insights = [...currentInsights];
    console.log('原始文章顺序:', insights.map(i => i.title || i.url).slice(0, 5));
    
    // 测试字母排序
    const alphabetical = [...insights].sort((a, b) => {
        const titleA = (a.title || a.url || '').toLowerCase();
        const titleB = (b.title || b.url || '').toLowerCase();
        return titleA.localeCompare(titleB);
    });
    console.log('字母排序后:', alphabetical.map(i => i.title || i.url).slice(0, 5));
}

// 将测试函数暴露到全局
window.testFiltering = testFiltering;
window.testSorting = testSorting;

// 测试标签选择器功能
function testTagSelectorFunctionality() {
    console.log('🧪 测试标签选择器功能...');
    
    // 检查DOM元素
    const trigger = document.getElementById('tagSelectorTrigger');
    const dropdown = document.getElementById('tagSelectorDropdown');
    const options = document.getElementById('tagSelectorOptions');
    
    console.log('🔍 DOM元素检查:', {
        trigger: trigger ? '✅ 存在' : '❌ 不存在',
        dropdown: dropdown ? '✅ 存在' : '❌ 不存在',
        options: options ? '✅ 存在' : '❌ 不存在'
    });
    
    // 检查CSS类
    if (dropdown) {
        console.log('🔍 下拉框CSS类:', dropdown.classList.toString());
        console.log('🔍 是否展开:', dropdown.classList.contains('open'));
    }
    
    // 检查标签数据
    const tagOptions = options ? options.querySelectorAll('.tag-option') : [];
    console.log('🔍 标签选项数量:', tagOptions.length);
    
    // 检查复选框
    const checkboxes = options ? options.querySelectorAll('.tag-checkbox') : [];
    console.log('🔍 复选框数量:', checkboxes.length);
    
    // 测试点击事件
    if (trigger) {
        console.log('🔍 测试点击触发器...');
        trigger.click();
        
        setTimeout(() => {
            console.log('🔍 点击后状态:', dropdown.classList.contains('open') ? '展开' : '收缩');
            
            // 再次点击关闭
            trigger.click();
            setTimeout(() => {
                console.log('🔍 再次点击后状态:', dropdown.classList.contains('open') ? '展开' : '收缩');
            }, 100);
        }, 100);
    }
    
    return {
        elementsExist: {
            trigger: !!trigger,
            dropdown: !!dropdown,
            options: !!options
        },
        tagOptionsCount: tagOptions.length,
        checkboxesCount: checkboxes.length,
        isOpen: dropdown ? dropdown.classList.contains('open') : false
    };
}

// 将测试函数暴露到全局
window.testTagSelectorFunctionality = testTagSelectorFunctionality;

// 更新标签选择UI
function updateTagSelectionUI(tagItem, isSelected) {
    if (isSelected) {
        tagItem.classList.add('selected');
    } else {
        tagItem.classList.remove('selected');
    }
    
    // 更新选中标签数量
    updateSelectedTagsCount();
    
    // 更新批量操作按钮状态
    updateBulkActionsState();
}

// 更新选中标签数量
function updateSelectedTagsCount() {
    const selectedCount = document.querySelectorAll('.manage-tag-checkbox:checked').length;
    const selectedTagsCountElement = document.getElementById('selectedTagsCount');
    if (selectedTagsCountElement) {
        selectedTagsCountElement.textContent = selectedCount;
    }
}

// 更新批量操作按钮状态
function updateBulkActionsState() {
    const selectedCount = document.querySelectorAll('.manage-tag-checkbox:checked').length;
    const bulkEditBtn = document.querySelector('.bulk-edit-btn');
    const bulkDeleteBtn = document.querySelector('.bulk-delete-btn');
    
    if (bulkEditBtn) {
        bulkEditBtn.disabled = selectedCount === 0;
    }
    if (bulkDeleteBtn) {
        bulkDeleteBtn.disabled = selectedCount === 0;
    }
}

// 全选标签
function selectAllTags() {
    const checkboxes = document.querySelectorAll('.manage-tag-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
        const tagItem = checkbox.closest('.manage-tag-item');
        if (tagItem) {
            updateTagSelectionUI(tagItem, true);
        }
    });
}

// 取消全选标签
function deselectAllTags() {
    const checkboxes = document.querySelectorAll('.manage-tag-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
        const tagItem = checkbox.closest('.manage-tag-item');
        if (tagItem) {
            updateTagSelectionUI(tagItem, false);
        }
    });
}

// 批量编辑标签
function bulkEditTags() {
    const selectedTags = getSelectedTagsForManagement();
    if (selectedTags.length === 0) {
        showErrorMessage('Please select tags to edit');
        return;
    }
    
    if (selectedTags.length === 1) {
        // 单个标签编辑
        const tag = selectedTags[0];
        editTagInManagement(tag.id, tag.name, tag.color);
    } else {
        // 多个标签编辑
        showErrorMessage('Bulk edit for multiple tags is not yet implemented');
    }
}

// 批量删除标签
function bulkDeleteTags() {
    const selectedTags = getSelectedTagsForManagement();
    if (selectedTags.length === 0) {
        showErrorMessage('Please select tags to delete');
        return;
    }
    
    const tagNames = selectedTags.map(tag => tag.name).join(', ');
    if (confirm(`Are you sure you want to delete these tags: ${tagNames}?`)) {
        // 执行批量删除
        Promise.all(selectedTags.map(tag => deleteTagInManagement(tag.id)))
            .then(() => {
                showSuccessMessage(`Successfully deleted ${selectedTags.length} tags`);
            })
            .catch(error => {
                showErrorMessage(`Failed to delete some tags: ${error.message}`);
            });
    }
}

// 获取选中的标签（用于管理）
function getSelectedTagsForManagement() {
    const selectedTags = [];
    const checkboxes = document.querySelectorAll('.manage-tag-checkbox:checked');
    
    checkboxes.forEach(checkbox => {
        const tagItem = checkbox.closest('.manage-tag-item');
        if (tagItem) {
            selectedTags.push({
                id: tagItem.dataset.tagId,
                name: tagItem.dataset.tagName,
                color: tagItem.dataset.tagColor
            });
        }
    });
    
    return selectedTags;
}

// 标签选择统计函数已删除

// 标签筛选函数已删除

// 测试标签选择功能已删除

// testTagSelection 已删除

// 测试弹窗功能已删除

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
        usernameInput.value = currentUser.nickname || currentUser.email || '';
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
    
    console.log('✅ 用户资料编辑模态框已打开');
}

// 关闭用户资料编辑模态框
function closeProfileEditModal() {
    console.log('❌ 关闭用户资料编辑模态框...');
    
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
    
    console.log('✅ 用户资料编辑模态框已关闭');
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
        
        console.log('📡 发送用户资料更新请求:', profileData);
        
        const response = await api.updateUserProfile(profileData);
        
        if (response.success) {
            // 更新本地用户数据
            currentUser = { ...currentUser, ...profileData };
            
            // 更新本地存储
            if (auth.getCurrentUser()) {
                // Store updated user info in local storage
                localStorage.setItem('quest_user_session', JSON.stringify(currentUser));
            }
            
            // 刷新UI显示
            updateUserProfileUI();
            
            // 关闭模态框
            closeProfileEditModal();
            
            // 显示成功消息
            showSuccessMessage('Profile updated successfully!');
            
            console.log('✅ 用户资料更新成功');
        } else {
            throw new Error(response.message || 'Failed to update profile');
        }
        
    } catch (error) {
        console.error('❌ 用户资料更新失败:', error);
        
        let errorMessage = 'Failed to update profile. Please try again.';
        
        if (error.message.includes('401') || error.message.includes('unauthorized')) {
            errorMessage = 'Please log in again to update your profile.';
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
    
    try {
        // Get insight data for both cards
        const insight1 = getInsightById(card1.dataset.insightId);
        const insight2 = getInsightById(card2.dataset.insightId);
        
        if (!insight1 || !insight2) {
            console.error('❌ Cannot find insight data for cards');
            return;
        }
        
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
        
        // Create stack via API (one-to-one relationship)
        const stackData = {
            name: 'Stack'
        };
        
        const response = await api.createStack(stackData);
        
        if (response.success && response.data) {
            const apiStack = response.data;
            const stackId = apiStack.id.toString();
            
            // Add insights to the stack via API
            await Promise.all([
                api.addItemToStack(stackId, insight1.id),
                api.addItemToStack(stackId, insight2.id)
            ]);
            
            // Create local stack data
            const localStackData = {
                id: stackId,
                name: apiStack.name || 'Stack',
                cards: [insight1, insight2],
                createdAt: apiStack.created_at || new Date().toISOString(),
                modifiedAt: apiStack.modified_at || new Date().toISOString(),
                isExpanded: false
            };
            
            // Add to local stacks collection
            stacks.set(stackId, localStackData);
            
            // Remove cards from currentInsights to avoid duplicates
            // (This is safe because of one-to-one constraint)
            currentInsights = currentInsights.filter(insight => 
                insight.id !== card1.dataset.insightId && 
                insight.id !== card2.dataset.insightId
            );
            
            // Update stackIdCounter
            stackIdCounter = Math.max(stackIdCounter, parseInt(stackId) + 1);
            
            // Re-render content
            renderInsights();
            
            showSuccessMessage('Stack created successfully!');
        } else {
            throw new Error(response.message || 'Failed to create stack');
        }
    } catch (error) {
        console.error('❌ Failed to create stack via API:', error);
        showErrorMessage('Failed to create stack. Please try again.');
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

// Delete a stack
async function deleteStack(stackId) {
    if (confirm('Are you sure you want to delete this stack? All items will be moved back to your space.')) {
        try {
            const stackData = stacks.get(stackId);
            if (stackData) {
                // Delete stack via API
                const response = await api.deleteStack(stackId);
                
                if (response.success) {
                    // Move all cards back to insights
                    currentInsights.push(...stackData.cards);
                    stacks.delete(stackId);
                    
                    // Re-render content
                    renderInsights();
                    showSuccessMessage('Stack deleted and items restored.');
                } else {
                    throw new Error(response.message || 'Failed to delete stack');
                }
            }
        } catch (error) {
            console.error('❌ Failed to delete stack via API:', error);
            showErrorMessage('Failed to delete stack. Please try again.');
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
        showErrorMessage('Failed to move card. Please try again.');
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
            
            // If stack has only one card left, dissolve the stack
            if (stackData.cards.length <= 1) {
                if (stackData.cards.length === 1) {
                    // Remove the last card from stack
                    const lastCard = stackData.cards[0];
                    await api.removeItemFromStack(stackId, lastCard.id);
                    currentInsights.push(lastCard);
                }
                stacks.delete(stackId);
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
        showErrorMessage('Failed to remove card from stack. Please try again.');
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
            showErrorMessage('Failed to update stack name. Please try again.');
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
        
        // Remove shake from cards
        stackCard.querySelectorAll('.stack-horizontal-card').forEach(card => {
            card.classList.remove('shake');
        });
    } else {
        // Enter edit mode
        stackCard.classList.add('stack-edit-mode-horizontal');
        editBtn.classList.add('active');
        editBtnText.textContent = 'Done';
        
        // Add shake to cards
        stackCard.querySelectorAll('.stack-horizontal-card').forEach(card => {
            card.classList.add('shake');
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
    editDeleteBtn.title = 'Delete';
    editDeleteBtn.onclick = (e) => {
        e.stopPropagation();
        deleteInsight(insight.id);
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
        const response = await api.getUserTags();
        const allTags = response.success ? response.data : [];
        
        // Get current tags for this insight
        const currentTags = insight.tags || [];
        
        // Create modal HTML
        const modal = document.createElement('div');
        modal.className = 'tag-edit-modal';
        modal.innerHTML = `
            <div class="tag-edit-modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">Edit Tags</h2>
                    <button class="modal-close" id="closeTagEditModal">&times;</button>
                </div>
                <div class="modal-body">
                    <p class="modal-description">Select tags for: <strong>${insight.title || 'Content'}</strong></p>
                    <div class="tag-options">
                        ${allTags.map(tag => `
                            <label class="tag-option">
                                <input type="checkbox" value="${tag.id}" 
                                    ${currentTags.some(ct => (ct.id || ct) === (tag.id || tag.name)) ? 'checked' : ''}
                                    data-tag-name="${tag.name}">
                                <span class="tag-option-label" style="background-color: ${tag.color || '#8B5CF6'}">${tag.name}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
                <div class="modal-actions">
                    <button type="button" class="modal-btn modal-btn-secondary" id="cancelTagEdit">Cancel</button>
                    <button type="button" class="modal-btn modal-btn-primary" id="saveTagEdit">Save Tags</button>
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
        const checkboxes = modal.querySelectorAll('input[type="checkbox"]:checked');
        const selectedTags = Array.from(checkboxes).map(cb => ({
            id: cb.value,
            name: cb.dataset.tagName
        }));
        
        console.log('💾 Saving tags for insight:', insight.id, selectedTags);
        
        // Update insight with new tags (you may need to adjust this API call based on your backend)
        const response = await api.updateInsight(insight.id, {
            ...insight,
            tags: selectedTags
        });
        
        if (response.success) {
            console.log('✅ Tags updated successfully');
            
            // Update the insight in memory
            const insightIndex = currentInsights.findIndex(i => i.id === insight.id);
            if (insightIndex !== -1) {
                currentInsights[insightIndex].tags = selectedTags;
            }
            
            // Re-render the insights to show updated tags
            renderInsights();
            
            closeTagEditModal(modal);
            showSuccessMessage('Tags updated successfully!');
        } else {
            throw new Error(response.message || 'Failed to update tags');
        }
        
    } catch (error) {
        console.error('❌ Failed to save tags:', error);
        showErrorMessage(`Failed to save tags: ${error.message}`);
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
        const response = await api.getUserTags();
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


