import { auth } from './auth.js';
import { api } from './api.js';

// DOM 元素
const profileAvatar = document.getElementById('profileAvatar');
const usernamePlaceholder = document.getElementById('usernamePlaceholder');
const contentCards = document.getElementById('contentCards');
const logoutBtn = document.getElementById('logoutBtn');
const addContentForm = document.getElementById('addContentForm');
const addContentModal = document.getElementById('addContentModal');
const closeAddModal = document.getElementById('closeAddModal');
const cancelAddBtn = document.getElementById('cancelAddBtn');
const searchInput = document.getElementById('searchInput');
const filterButtons = document.getElementById('filterButtons');

// 页面状态
let currentUser = null;
let currentInsights = [];
let currentFilter = 'latest';
let currentSearch = '';

// 页面初始化
async function initPage() {
    try {
        console.log('🚀 初始化My Space页面...');
        
        // 恢复会话状态
        auth.restoreSession();
        
        // 检查认证状态
        if (!auth.checkAuth()) {
            console.log('❌ 用户未认证，重定向到登录页面');
            window.location.href = '/pages/login.html';
            return;
        }
        
        // 检查token是否过期
        if (!(await auth.checkAndHandleTokenExpiration())) {
            console.log('⏰ Token已过期，重定向到登录页面');
            window.location.href = '/pages/login.html';
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
            window.location.href = '/pages/login.html';
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
        
        if (response.success && response.data && response.data.insights) {
            currentInsights = response.data.insights;
            console.log('✅ 用户insights加载成功:', currentInsights.length, '条');
            renderInsights();
        } else {
            console.warn('⚠️ API返回格式不正确:', response);
            currentInsights = [];
            renderInsights();
        }
    } catch (error) {
        console.error('❌ 加载用户insights失败:', error);
        showErrorMessage('加载insights失败，请刷新重试');
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
    
    // 标签
    const tags = document.createElement('div');
    tags.className = 'content-card-tags';
    
    if (insight.tags && insight.tags.length > 0) {
        insight.tags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.className = 'content-card-tag';
            tagElement.textContent = typeof tag === 'string' ? tag : (tag.name || tag);
            tagElement.style.backgroundColor = tag.color || '#667eea';
            tagElement.style.color = 'white';
            tags.appendChild(tagElement);
        });
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
    
    // 组装卡片
    card.appendChild(cardHeader);
    card.appendChild(description);
    card.appendChild(tags);
    card.appendChild(cardFooter);
    
    return card;
}

// 初始化筛选按钮
async function initFilterButtons() {
    if (!filterButtons) return;
    
    try {
        // 获取用户标签
        const response = await api.getUserTags();
        const userTags = response.success ? response.data : [];
        
        // 基础筛选选项
        const filterOptions = [
            { key: 'latest', label: 'Latest' },
            { key: 'oldest', label: 'Oldest' }
        ];
        
        // 添加标签筛选选项
        userTags.forEach(tag => {
            filterOptions.push({
                key: `tag_${tag.id || tag.name}`,
                label: tag.name || tag,
                tag: tag
            });
        });
        
        filterButtons.innerHTML = '';
        filterOptions.forEach(option => {
            const button = document.createElement('button');
            button.className = `FilterButton ${option.key === currentFilter ? 'active' : ''}`;
            button.textContent = option.label;
            button.dataset.filter = option.key;
            button.dataset.tag = option.tag ? JSON.stringify(option.tag) : '';
            button.onclick = () => setFilter(option.key);
            filterButtons.appendChild(button);
        });
        
        // 添加编辑标签按钮
        const editTagsBtn = document.createElement('button');
        editTagsBtn.className = 'FilterButton edit-tags-btn';
        editTagsBtn.textContent = 'Edit Tags';
        editTagsBtn.onclick = () => showEditTagsModal();
        filterButtons.appendChild(editTagsBtn);
        
    } catch (error) {
        console.error('初始化筛选按钮失败:', error);
        // 显示基础筛选选项
        const filterOptions = [
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
function setFilter(filter) {
    currentFilter = filter;
    
    // 更新按钮状态
    const buttons = filterButtons.querySelectorAll('.FilterButton');
    buttons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    
    // 重新渲染
    renderInsights();
}

// 获取当前筛选的文章
function getFilteredInsights() {
    let filteredInsights = [...currentInsights];
    
    console.log('🔍 当前筛选条件:', currentFilter);
    console.log('📚 当前文章数据:', currentInsights);
    
    // 根据筛选条件过滤
    if (currentFilter && currentFilter.startsWith('tag_')) {
        // 标签筛选
        const tagData = currentFilter.replace('tag_', '');
        console.log('🏷️ 筛选标签ID:', tagData);
        
        filteredInsights = currentInsights.filter(insight => {
            console.log('📖 检查文章:', insight.title, '标签:', insight.tags);
            if (insight.tags && insight.tags.length > 0) {
                const hasTag = insight.tags.some(tag => {
                    const tagId = typeof tag === 'string' ? tag : (tag.id || tag.name);
                    console.log('🏷️ 文章标签:', tag, '标签ID:', tagId, '匹配:', tagId === tagData);
                    return tagId === tagData;
                });
                console.log('✅ 文章是否包含标签:', hasTag);
                return hasTag;
            }
            return false;
        });
        
        console.log('🎯 筛选后的文章数量:', filteredInsights.length);
    } else if (currentFilter === 'latest') {
        // 最新排序
        filteredInsights.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (currentFilter === 'oldest') {
        // 最旧排序
        filteredInsights.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }
    
    return filteredInsights;
}

// 搜索功能
function performSearch() {
    currentSearch = searchInput.value.trim();
    loadUserInsights();
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
    if (addContentModal) {
        addContentModal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        // 加载用户标签
        loadUserTags();
        
        // 重置表单
        if (addContentForm) {
            addContentForm.reset();
        }
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
        logoutBtn.addEventListener('click', async () => {
            try {
                await auth.logout();
                window.location.href = '/pages/login.html';
            } catch (error) {
                console.error('登出失败:', error);
                // 即使API调用失败，也要清除本地状态并跳转
                auth.clearSession();
                window.location.href = '/pages/login.html';
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
                // 显示加载状态
                const submitBtn = document.getElementById('addContentBtn');
                const originalText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<svg class="loading-spinner" width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.416" stroke-dashoffset="31.416"><animate attributeName="stroke-dasharray" dur="2s" values="0 31.416;15.708 15.708;0 31.416" repeatCount="indefinite"/><animate attributeName="stroke-dashoffset" dur="2s" values="0;-15.708;-31.416" repeatCount="indefinite"/></circle></svg> Adding...';
                submitBtn.disabled = true;
                
                console.log('🔍 开始从URL创建insight...');
                
                // 获取选中的标签
                const selectedTags = tagSelector.querySelectorAll('.tag-option.selected');
                let tags = '';
                if (selectedTags.length > 0) {
                    tags = Array.from(selectedTags).map(tag => tag.textContent).join(',');
                }
                
                // 使用新的 create-insight API 端点（两步合一）
                const insightData = {
                    url: url,
                    tag_names: Array.from(selectedTags).map(tag => tag.textContent) // 使用新的字段名
                };
                
                console.log('📝 创建insight，数据:', insightData);
                
                // 使用新的 API 端点创建 insight
                const result = await api.createInsightFromUrl(url, insightData);
                console.log('✅ 创建见解成功:', result);
                
                // 等待一下再重新加载内容，确保后端处理完成
                setTimeout(async () => {
                    console.log('🔄 开始重新加载内容...');
                    await loadUserInsights();
                }, 1000);
                
                // 清空表单并隐藏模态框
                addContentForm.reset();
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
    
    // 搜索功能
    if (searchInput) {
        searchInput.addEventListener('input', debounce(performSearch, 500));
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
        renderTagSelector([]);
    }
}

// 渲染标签选择器
function renderTagSelector(tags) {
    const tagSelector = document.getElementById('tagSelector');
    if (!tagSelector) return;
    
    tagSelector.innerHTML = '';
    
    if (tags.length === 0) {
        tagSelector.innerHTML = '<p class="no-tags">No tags available. Create some tags first!</p>';
        return;
    }
    
    // 创建标签选择器
    tags.forEach(tag => {
        const tagOption = document.createElement('div');
        tagOption.className = 'tag-option';
        tagOption.innerHTML = `
            <input type="checkbox" id="tag_${tag.id}" value="${tag.id}" class="tag-checkbox">
            <label for="tag_${tag.id}" class="tag-label" style="--tag-color: ${tag.color || '#FF5733'}">
                <span class="tag-color-dot" style="background-color: ${tag.color || '#FF5733'}"></span>
                ${tag.name}
            </label>
        `;
        tagSelector.appendChild(tagOption);
    });
}

// 更新过滤器按钮
function updateFilterButtons(tags) {
    const filterButtons = document.getElementById('filterButtons');
    if (!filterButtons) return;
    
    // 保留默认的Latest按钮
    const latestButton = filterButtons.querySelector('[data-filter="latest"]');
    filterButtons.innerHTML = '';
    if (latestButton) {
        filterButtons.appendChild(latestButton);
    }
    
    // 添加标签过滤器按钮
    tags.forEach(tag => {
        const tagButton = document.createElement('button');
        tagButton.className = 'FilterButton';
        tagButton.setAttribute('data-filter', `tag_${tag.id}`);
        tagButton.setAttribute('data-tag-id', tag.id);
        tagButton.innerHTML = `
            <span class="tag-color-dot" style="background-color: ${tag.color || '#FF5733'}"></span>
            ${tag.name}
        `;
        filterButtons.appendChild(tagButton);
    });
    
    // 重新绑定事件
    initFilterButtons();
}

// 获取选中的标签
function getSelectedTags() {
    const selectedTags = [];
    const checkboxes = document.querySelectorAll('#tagSelector .tag-checkbox:checked');
    
    checkboxes.forEach(checkbox => {
        const tagId = checkbox.value;
        const tagLabel = checkbox.nextElementSibling;
        const tagName = tagLabel.textContent.trim();
        selectedTags.push({ id: tagId, name: tagName });
    });
    
    return selectedTags;
}

// 显示创建标签模态框
function showCreateTagModal() {
    const modal = document.getElementById('createTagModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('newTagName').focus();
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
        loadTagsForManagement();
    }
}

// 隐藏管理标签模态框
function hideManageTagsModal() {
    const modal = document.getElementById('manageTagsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 加载标签用于管理
async function loadTagsForManagement() {
    try {
        const response = await api.getUserTags();
        const tags = response.success ? response.data : [];
        
        const tagsList = document.getElementById('manageTagsList');
        const tagsStats = document.getElementById('tagsStats');
        
        if (!tagsList || !tagsStats) return;
        
        // 渲染标签列表
        tagsList.innerHTML = '';
        
        if (tags.length === 0) {
            tagsList.innerHTML = '<p class="no-tags">No tags created yet</p>';
            tagsStats.innerHTML = '<p class="no-stats">No tags to display statistics</p>';
            return;
        }
        
        tags.forEach(tag => {
            const tagItem = document.createElement('div');
            tagItem.className = 'manage-tag-item';
            tagItem.innerHTML = `
                <div class="tag-info">
                    <span class="tag-color-dot" style="background-color: ${tag.color || '#FF5733'}"></span>
                    <span class="tag-name">${tag.name}</span>
                </div>
                <div class="tag-actions">
                    <button class="action-btn edit-tag-btn" onclick="editTagInManagement('${tag.id}', '${tag.name}', '${tag.color}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <button class="action-btn delete-tag-btn" onclick="deleteTagInManagement('${tag.id}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
            `;
            tagsList.appendChild(tagItem);
        });
        
        // 显示标签统计
        try {
            const statsResponse = await api.getTagStats();
            if (statsResponse.success && statsResponse.data) {
                const stats = statsResponse.data;
                tagsStats.innerHTML = `
                    <div class="stats-summary">
                        <h3>Tag Statistics</h3>
                        <div class="stat-item">
                            <span class="stat-label">Total Tags:</span>
                            <span class="stat-value">${stats.total_tags || tags.length}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Total Insights:</span>
                            <span class="stat-value">${stats.total_insights || 0}</span>
                        </div>
                    </div>
                    ${stats.most_used_tags ? `
                        <div class="most-used-tags">
                            <h4>Most Used Tags</h4>
                            <div class="tag-stats-list">
                                ${stats.most_used_tags.map(tag => `
                                    <div class="tag-stat-item">
                                        <span class="tag-color-dot" style="background-color: ${tag.color}"></span>
                                        <span class="tag-name">${tag.name}</span>
                                        <span class="tag-count">${tag.count}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                `;
            } else {
                tagsStats.innerHTML = '<p class="no-stats">Unable to load tag statistics</p>';
            }
        } catch (error) {
            console.error('Failed to load tag statistics:', error);
            tagsStats.innerHTML = '<p class="no-stats">Failed to load tag statistics</p>';
        }
        
    } catch (error) {
        console.error('Failed to load tags for management:', error);
        const tagsList = document.getElementById('manageTagsList');
        if (tagsList) {
            tagsList.innerHTML = '<p class="error">Failed to load tags</p>';
        }
    }
}

// 在管理界面中编辑标签
async function editTagInManagement(tagId, currentName, currentColor) {
    const newName = prompt('Enter new tag name:', currentName);
    if (!newName || newName.trim() === currentName) return;
    
    try {
        const response = await api.updateTag(tagId, { 
            name: newName.trim(),
            color: currentColor 
        });
        
        if (response.success && response.data) {
            console.log('✅ 标签更新成功:', response.data);
            
            // 重新加载标签
            await loadTagsForManagement();
            await loadUserTags();
            
            showSuccessMessage('Tag updated successfully!');
        } else {
            throw new Error(response.message || 'Failed to update tag');
        }
    } catch (error) {
        console.error('❌ 更新标签失败:', error);
        showErrorMessage(`Failed to update tag: ${error.message}`);
    }
}

// 在管理界面中删除标签
async function deleteTagInManagement(tagId) {
    if (!confirm('Are you sure you want to delete this tag? This action cannot be undone.')) {
        return;
    }
    
    try {
        console.log('🗑️ 删除标签:', tagId);
        
        const response = await api.deleteTag(tagId);
        
        if (response.success) {
            console.log('✅ 标签删除成功');
            
            // 重新加载标签
            await loadTagsForManagement();
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

// 绑定标签相关事件
function bindTagEvents() {
    // 创建标签按钮
    const createTagBtn = document.getElementById('createTagBtn');
    if (createTagBtn) {
        createTagBtn.addEventListener('click', showCreateTagModal);
    }
    
    // 管理标签按钮
    const manageTagsBtn = document.getElementById('manageTagsBtn');
    if (manageTagsBtn) {
        manageTagsBtn.addEventListener('click', showManageTagsModal);
    }
    
    // 创建标签表单
    const createTagForm = document.getElementById('createTagForm');
    if (createTagForm) {
        createTagForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await createNewTag();
        });
    }
    
    // 关闭创建标签模态框
    const closeCreateTagModal = document.getElementById('closeCreateTagModal');
    if (closeCreateTagModal) {
        closeCreateTagModal.addEventListener('click', hideCreateTagModal);
    }
    
    const cancelCreateTagBtn = document.getElementById('cancelCreateTagBtn');
    if (cancelCreateTagBtn) {
        cancelCreateTagBtn.addEventListener('click', hideCreateTagModal);
    }
    
    // 关闭管理标签模态框
    const closeManageTagsModal = document.getElementById('closeManageTagsModal');
    if (closeManageTagsModal) {
        closeManageTagsModal.addEventListener('click', hideManageTagsModal);
    }
    
    const closeManageTagsBtn = document.getElementById('closeManageTagsBtn');
    if (closeManageTagsBtn) {
        closeManageTagsBtn.addEventListener('click', hideManageTagsModal);
    }
    
    // 颜色预设选择
    const colorPresets = document.querySelectorAll('.color-preset');
    colorPresets.forEach(preset => {
        preset.addEventListener('click', () => {
            const color = preset.getAttribute('data-color');
            document.getElementById('newTagColor').value = color;
        });
    });
    
    // 点击模态框外部关闭
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

// 创建新标签
async function createNewTag() {
    const tagName = document.getElementById('newTagName').value.trim();
    const tagColor = document.getElementById('newTagColor').value;
    
    if (!tagName) {
        showErrorMessage('Please enter a tag name');
        return;
    }
    
    try {
        console.log('🏷️ 创建新标签:', { name: tagName, color: tagColor });
        
        // 使用新的API方法创建标签
        const response = await api.createTag({
            name: tagName,
            color: tagColor
        });
        
        if (response.success && response.data) {
            console.log('✅ 标签创建成功:', response.data);
            
            // 关闭创建标签模态框
            const createTagModal = document.getElementById('createTagModal');
            if (createTagModal) {
                createTagModal.style.display = 'none';
            }
            
            // 清空表单
            document.getElementById('newTagName').value = '';
            document.getElementById('newTagColor').value = '#FF5733';
            
            // 重新加载标签
            await loadUserTags();
            
            showSuccessMessage('Tag created successfully!');
        } else {
            throw new Error(response.message || 'Failed to create tag');
        }
    } catch (error) {
        console.error('❌ 创建标签失败:', error);
        showErrorMessage(`Failed to create tag: ${error.message}`);
    }
}

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initPage);

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
                    <button class="action-btn edit-tag-btn" onclick="editTag('${tag.id || tag.name}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <button class="action-btn delete-tag-btn" onclick="deleteTag('${tag.id || tag.name}')">
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
async function editTag(tagId) {
    const newName = prompt('Please enter new tag name:');
    if (newName && newName.trim()) {
        updateTag(tagId, newName.trim());
    }
}

// 更新标签
async function updateTag(tagId, newName) {
    try {
        const response = await api.updateTag(tagId, { name: newName });
        
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
async function deleteTag(tagId) {
    if (!confirm('Are you sure you want to delete this tag?')) {
        return;
    }
    
    try {
        console.log('🗑️ 删除标签:', tagId);
        
        // 使用新的API方法删除标签
        const response = await api.deleteTag(tagId);
        
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
window.editTag = editTag;
window.updateTag = updateTag;
window.deleteTag = deleteTag;
window.editTagInManagement = editTagInManagement;
window.deleteTagInManagement = deleteTagInManagement;
