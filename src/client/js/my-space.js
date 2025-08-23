import { auth } from './auth.js';
import { api } from './api.js';
import { PATHS, navigateTo } from './paths.js';

// DOM 元素
const profileAvatar = document.getElementById('profileAvatar');
const usernamePlaceholder = document.getElementById('usernamePlaceholder');
const contentCards = document.getElementById('contentCards');
const logoutBtn = document.getElementById('logoutBtn');
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


// 页面初始化
async function initPage() {
    try {
        console.log('🚀 初始化My Space页面...');
        
        // 恢复会话状态
        auth.restoreSession();
        
        // 检查认证状态
        if (!auth.checkAuth()) {
            console.log('❌ 用户未认证，重定向到登录页面');
            window.location.href = PATHS.LOGIN;
            return;
        }
        
        // 检查token是否过期
        if (!(await auth.checkAndHandleTokenExpiration())) {
            console.log('⏰ Token已过期，重定向到登录页面');
            window.location.href = PATHS.LOGIN;
            return;
        }
        
        console.log('✅ 认证状态正常，继续初始化...');
        
        // 加载用户资料
        await loadUserProfile();
        
        // 加载用户insights
        await loadUserInsights();
        
        // 加载用户标签
        await loadUserTags();
        
        // 初始化过滤器按钮
        initFilterButtons();
        
        // 绑定事件
        bindEvents();
        
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
    
    // 更新头像
    if (currentUser.avatar_url && profileAvatar) {
        profileAvatar.querySelector('img').src = currentUser.avatar_url;
    }
    
    // 更新用户名
    if (usernamePlaceholder) {
        usernamePlaceholder.textContent = currentUser.nickname || currentUser.email || 'User';
    }
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
    
    contentCards.innerHTML = '';
    
    if (currentInsights.length === 0) {
        contentCards.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📚</div>
                <h3>No content collected yet</h3>
                <p>Start adding your favorite media content to your collection</p>
                <button class="btn btn-primary add-content-btn" onclick="showAddContentModal()">
                    Add Content
                </button>
            </div>
        `;
        return;
    }
    
    // 根据筛选条件排序
    let sortedInsights = getFilteredInsights();
    
    sortedInsights.forEach(insight => {
        const card = createInsightCard(insight);
        contentCards.appendChild(card);
    });
}

// 创建见解卡片
function createInsightCard(insight) {
    const card = document.createElement('div');
    card.className = 'content-card';
    
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
    
    // 卡片头部
    const cardHeader = document.createElement('div');
    cardHeader.className = 'content-card-header';
    
    const title = document.createElement('div');
    title.className = 'content-card-title';
    title.textContent = insight.title || new URL(insight.url).hostname;
    
    const actions = document.createElement('div');
    actions.className = 'content-card-actions';
    
    const shareBtn = document.createElement('button');
    shareBtn.className = 'action-btn';
    shareBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    shareBtn.title = 'Share';
    shareBtn.onclick = () => shareInsight(insight);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn';
    deleteBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    deleteBtn.title = 'Delete';
    deleteBtn.onclick = () => deleteInsight(insight.id);
    
    actions.appendChild(shareBtn);
    actions.appendChild(deleteBtn);
    
    cardHeader.appendChild(title);
    cardHeader.appendChild(actions);
    
    // 卡片描述
    const description = document.createElement('div');
    description.className = 'content-card-description';
    description.textContent = insight.description || `Content from ${new URL(insight.url).hostname}`;
    
    // 标签 - 只有当有标签时才显示
    if (insight.tags && insight.tags.length > 0) {
        const tags = document.createElement('div');
        tags.className = 'content-card-tags';
        
        console.log('🏷️ 渲染标签，insight:', insight.title || insight.url);
        console.log('🏷️ 标签数据:', insight.tags);
        
        insight.tags.forEach((tag, index) => {
            console.log(`🏷️ 处理标签 ${index + 1}:`, tag);
            
            const tagElement = document.createElement('span');
            tagElement.className = 'content-card-tag';
            
            // 处理标签文本
            let tagText = '';
            if (typeof tag === 'string') {
                tagText = tag;
            } else if (tag && typeof tag === 'object') {
                tagText = tag.name || tag.id || 'Unknown Tag';
            } else {
                tagText = 'Invalid Tag';
            }
            
            tagElement.textContent = tagText;
            
            console.log(`🏷️ 创建标签元素:`, { text: tagText });
            
            tags.appendChild(tagElement);
        });
        
        cardContent.appendChild(tags);
    } else {
        console.log('⚠️ 该insight没有标签数据，不显示标签区域');
    }
    
    // 卡片底部
    const cardFooter = document.createElement('div');
    cardFooter.className = 'content-card-footer';
    
    const url = document.createElement('a');
    url.className = 'content-card-url';
    url.href = insight.url;
    url.target = '_blank';
    url.textContent = new URL(insight.url).hostname;
    
    const date = document.createElement('div');
    date.className = 'content-card-date';
    date.textContent = new Date(insight.created_at).toLocaleDateString('en-US');
    
    cardFooter.appendChild(url);
    cardFooter.appendChild(date);
    
    // 组装卡片内容
    cardContent.appendChild(cardHeader);
    cardContent.appendChild(description);
    // 标签区域只在有标签时才添加
    cardContent.appendChild(cardFooter);
    
    // 组装完整卡片
    card.appendChild(cardContent);
    
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
        const filterType = btn.dataset.filter;
        if (filterType && currentFilters[filterType]) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
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
        
        // 隐藏body滚动
        document.body.style.overflow = 'hidden';
        
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
        document.body.style.overflow = '';
    }
}

// 绑定事件
function bindEvents() {
    // 登出按钮
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            console.log('🚪 用户点击登出...');
            
            // 直接清除本地状态
            auth.clearSession();
            
            // 立即跳转到首页
            window.location.href = PATHS.HOME;
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
                
                // 等待一下再重新加载内容，确保后端处理完成
                setTimeout(async () => {
                    console.log('🔄 开始重新加载内容...');
                    await loadUserInsights();
                }, 1000);
                
                // 清空表单并隐藏模态框
                addContentForm.reset();
                // 手动清空自定义字段
                document.getElementById('customTitle').value = '';
                document.getElementById('customThought').value = '';
                hideAddContentModal();
                
                // 显示成功消息
                showSuccessMessage('Content added successfully!');
                
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
                <input type="checkbox" id="tag_${tag.id}" value="${tag.id}" class="tag-checkbox">
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
            
            // 防止点击checkbox时触发两次
            if (e.target.type === 'checkbox') {
                console.log('🔍 点击的是复选框，跳过处理');
                return;
            }
            
            const checkbox = tagOption.querySelector('.tag-checkbox');
            checkbox.checked = !checkbox.checked;
            
            if (checkbox.checked) {
                tagOption.classList.add('selected');
                console.log('✅ 标签已选中:', tag.name);
            } else {
                tagOption.classList.remove('selected');
                console.log('❌ 标签已取消选中:', tag.name);
            }
            
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
        selectedTagsDisplay.innerHTML = '<span class="no-selected-tags">No tags selected</span>';
        return;
    }
    
    selectedTags.forEach(tag => {
        const tagElement = document.createElement('span');
        tagElement.className = 'selected-tag';
        tagElement.innerHTML = `
            ${tag.name}
            <button class="remove-tag-btn" onclick="removeSelectedTag('${tag.id}')">&times;</button>
        `;
        selectedTagsDisplay.appendChild(tagElement);
    });
}

// 移除已选标签
function removeSelectedTag(tagId) {
    const checkbox = document.getElementById(`tag_${tagId}`);
    if (checkbox) {
        checkbox.checked = false;
        const tagOption = checkbox.closest('.tag-option');
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
    const checkboxes = document.querySelectorAll('#tagSelectorOptions .tag-checkbox:checked');
    
    console.log('🔍 查找选中的标签，找到复选框数量:', checkboxes.length);
    
    checkboxes.forEach((checkbox, index) => {
        const tagId = checkbox.value;
        const tagOption = checkbox.closest('.tag-option');
        
        if (tagOption) {
            const tagName = tagOption.dataset.tagName || 'Unknown Tag';
            const tagColor = tagOption.dataset.tagColor || '#667eea';
            
            console.log(`🔍 标签 ${index + 1}:`, { id: tagId, name: tagName, color: tagColor });
            
            selectedTags.push({ 
                id: tagId, 
                name: tagName, 
                color: tagColor 
            });
        }
    });
    
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


