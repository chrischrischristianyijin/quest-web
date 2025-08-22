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
    
    // 标签
    const tags = document.createElement('div');
    tags.className = 'content-card-tags';
    
    console.log('🏷️ 渲染标签，insight:', insight.title || insight.url);
    console.log('🏷️ 标签数据:', insight.tags);
    
    if (insight.tags && insight.tags.length > 0) {
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
            
            // 处理标签颜色
            let tagColor = '#667eea'; // 默认颜色
            if (tag && typeof tag === 'object' && tag.color) {
                tagColor = tag.color;
            }
            
            tagElement.style.backgroundColor = tagColor;
            tagElement.style.color = 'white';
            
            console.log(`🏷️ 创建标签元素:`, { text: tagText, color: tagColor });
            
            tags.appendChild(tagElement);
        });
    } else {
        console.log('⚠️ 该insight没有标签数据');
        // 显示"无标签"提示
        const noTagElement = document.createElement('span');
        noTagElement.className = 'content-card-tag no-tag';
        noTagElement.textContent = '无标签';
        noTagElement.style.backgroundColor = '#e0e0e0';
        noTagElement.style.color = '#666';
        tags.appendChild(noTagElement);
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
    cardContent.appendChild(tags);
    cardContent.appendChild(cardFooter);
    
    // 组装完整卡片
    card.appendChild(cardContent);
    
    return card;
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
        
        // 基础筛选选项
        const filterOptions = [
            { key: 'all', label: 'All' },
            { key: 'latest', label: 'Latest' },
            { key: 'oldest', label: 'Oldest' }
        ];
        
        // 添加标签筛选选项
        userTags.forEach(tag => {
            console.log('🏷️ 处理用户标签:', tag);
            
            // 确保标签有有效的ID和名称
            if (tag && tag.id && tag.name) {
                const tagKey = `tag_${tag.id}`;
                filterOptions.push({
                    key: tagKey,
                    label: tag.name,
                    tag: tag
                });
                console.log('✅ 添加标签筛选选项:', tagKey, tag.name);
            } else {
                console.warn('⚠️ 跳过无效标签:', tag);
            }
        });
        
        // 清空现有按钮
        filterButtons.innerHTML = '';
        
        // 创建筛选按钮
        filterOptions.forEach(option => {
            const button = document.createElement('button');
            button.className = `FilterButton ${option.key === currentFilter ? 'active' : ''}`;
            button.textContent = option.label;
            button.dataset.filter = option.key;
            
            // 为标签按钮添加颜色标识
            if (option.key.startsWith('tag_') && option.tag) {
                button.style.borderLeft = `4px solid ${option.tag.color || '#667eea'}`;
                button.style.paddingLeft = '12px';
            }
            
            button.onclick = () => {
                console.log('🔍 用户点击筛选按钮:', option.key);
                setFilter(option.key);
            };
            
            filterButtons.appendChild(button);
            console.log('✅ 创建筛选按钮:', option.key, option.label);
        });
        
        // 添加清除筛选按钮（当有筛选条件时显示）
        if (currentFilter && currentFilter !== 'all') {
            const clearFilterBtn = document.createElement('button');
            clearFilterBtn.className = 'FilterButton clear-filter-btn';
            clearFilterBtn.textContent = 'Clear Filter';
            clearFilterBtn.onclick = () => {
                console.log('🧹 清除筛选条件');
                setFilter('all');
            };
            filterButtons.appendChild(clearFilterBtn);
        }
        
        // 添加编辑标签按钮
        const editTagsBtn = document.createElement('button');
        editTagsBtn.className = 'FilterButton edit-tags-btn';
        editTagsBtn.textContent = 'Edit Tags';
        editTagsBtn.onclick = () => showEditTagsModal();
        filterButtons.appendChild(editTagsBtn);
        
        console.log('✅ 筛选按钮初始化完成，共', filterOptions.length, '个选项');
        
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
function setFilter(filter) {
    currentFilter = filter;
    
    console.log('🔍 设置筛选条件:', filter);
    
    // 更新按钮状态
    const buttons = filterButtons.querySelectorAll('.FilterButton');
    buttons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    
    // 显示筛选状态
    showFilterStatus(filter);
    
    // 重新渲染
    renderInsights();
}

// 显示筛选状态
function showFilterStatus(filter) {
    let statusText = '';
    
    if (filter === 'all') {
        statusText = '显示所有内容';
    } else if (filter === 'latest') {
        statusText = '按最新时间排序';
    } else if (filter === 'oldest') {
        statusText = '按最旧时间排序';
    } else if (filter.startsWith('tag_')) {
        const tagId = filter.replace('tag_', '');
        // 查找标签名称
        const tagButton = document.querySelector(`[data-filter="${filter}"]`);
        const tagName = tagButton ? tagButton.textContent : '未知标签';
        statusText = `筛选标签: ${tagName}`;
    }
    
    console.log('📊 筛选状态:', statusText);
    
    // 可以在这里添加UI显示筛选状态
    // 比如在页面顶部显示一个小提示
}

// 获取当前筛选的文章
function getFilteredInsights() {
    let filteredInsights = [...currentInsights];
    
    console.log('🔍 当前筛选条件:', currentFilter);
    console.log('📚 当前文章数据:', currentInsights);
    
    // 根据筛选条件过滤
    if (currentFilter && currentFilter.startsWith('tag_')) {
        // 标签筛选
        const tagId = currentFilter.replace('tag_', '');
        console.log('🏷️ 筛选标签ID:', tagId);
        
        filteredInsights = currentInsights.filter(insight => {
            console.log('📖 检查文章:', insight.title || insight.url, '标签:', insight.tags);
            
            if (insight.tags && insight.tags.length > 0) {
                const hasTag = insight.tags.some(tag => {
                    console.log('🏷️ 检查单个标签:', tag);
                    
                    // 处理不同的标签格式
                    let tagIdToCheck = null;
                    
                    if (typeof tag === 'string') {
                        // 标签是字符串（可能是ID或名称）
                        tagIdToCheck = tag;
                    } else if (tag && typeof tag === 'object') {
                        // 标签是对象，尝试获取ID
                        tagIdToCheck = tag.id || tag.tag_id || tag.user_tag_id;
                        console.log('🏷️ 从对象中提取的ID:', tagIdToCheck);
                    }
                    
                    if (tagIdToCheck) {
                        const isMatch = tagIdToCheck === tagId;
                        console.log('🏷️ 标签ID比较:', tagIdToCheck, '===', tagId, '=', isMatch);
                        return isMatch;
                    } else {
                        console.log('⚠️ 无法提取标签ID:', tag);
                        return false;
                    }
                });
                console.log('✅ 文章是否包含标签:', hasTag);
                return hasTag;
            } else {
                console.log('⚠️ 文章没有标签数据');
                return false;
            }
        });
        
        console.log('🎯 筛选后的文章数量:', filteredInsights.length);
        
        // 如果没有找到匹配的文章，显示提示
        if (filteredInsights.length === 0) {
            console.log('⚠️ 没有找到包含该标签的文章');
        }
        
    } else if (currentFilter === 'latest') {
        // 最新排序
        filteredInsights.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        console.log('📅 按最新时间排序');
    } else if (currentFilter === 'oldest') {
        // 最旧排序
        filteredInsights.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        console.log('📅 按最旧时间排序');
    } else if (currentFilter === 'all') {
        // 显示所有文章
        console.log('📚 显示所有文章');
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
        logoutBtn.addEventListener('click', () => {
            console.log('🚪 用户点击登出...');
            
            // 直接清除本地状态
            auth.clearSession();
            
            // 立即跳转到登录页面
            window.location.href = PATHS.LOGIN;
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
    
    // 绑定标签选择器下拉事件
    bindTagSelectorEvents();
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
    const tagSelectorOptions = document.getElementById('tagSelectorOptions');
    if (!tagSelectorOptions) return;
    
    tagSelectorOptions.innerHTML = '';
    
    if (tags.length === 0) {
        tagSelectorOptions.innerHTML = '<div class="no-tags">No tags available. Create some tags first!</div>';
        return;
    }
    
    console.log('🏷️ 渲染标签选择器，标签数量:', tags.length);
    
    // 创建标签选项
    tags.forEach(tag => {
        const tagOption = document.createElement('div');
        tagOption.className = 'tag-option';
        tagOption.dataset.tagId = tag.id;
        tagOption.dataset.tagName = tag.name;
        tagOption.dataset.tagColor = tag.color || '#FF5733';
        
        tagOption.innerHTML = `
            <div class="tag-option-content">
                <span class="tag-color-dot" style="background-color: ${tag.color || '#FF5733'}"></span>
                <span class="tag-name">${tag.name}</span>
                <input type="checkbox" id="tag_${tag.id}" value="${tag.id}" class="tag-checkbox">
            </div>
        `;
        
        // 绑定点击事件
        tagOption.addEventListener('click', (e) => {
            // 防止点击checkbox时触发两次
            if (e.target.type === 'checkbox') return;
            
            const checkbox = tagOption.querySelector('.tag-checkbox');
            checkbox.checked = !checkbox.checked;
            
            if (checkbox.checked) {
                tagOption.classList.add('selected');
            } else {
                tagOption.classList.remove('selected');
            }
            
            updateSelectedTagsDisplay();
        });
        
        tagSelectorOptions.appendChild(tagOption);
    });
    
    console.log('🏷️ 标签选择器渲染完成');
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
        tagElement.style.backgroundColor = tag.color || '#667eea';
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

// 绑定标签选择器事件
function bindTagSelectorEvents() {
    const tagSelectorTrigger = document.getElementById('tagSelectorTrigger');
    const tagSelectorDropdown = document.getElementById('tagSelectorDropdown');
    
    if (!tagSelectorTrigger || !tagSelectorDropdown) return;
    
    // 点击触发器显示/隐藏下拉选项
    tagSelectorTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        tagSelectorDropdown.classList.toggle('open');
        
        // 更新箭头方向
        const arrow = tagSelectorTrigger.querySelector('.tag-selector-arrow');
        if (arrow) {
            arrow.style.transform = tagSelectorDropdown.classList.contains('open') ? 'rotate(180deg)' : 'rotate(0deg)';
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
    
    console.log('🔍 查找选中的标签，找到复选框数量:', checkboxes.length);
    
    checkboxes.forEach((checkbox, index) => {
        const tagId = checkbox.value;
        const tagLabel = checkbox.nextElementSibling;
        const tagName = tagLabel.textContent.trim();
        
        console.log(`🔍 标签 ${index + 1}:`, { id: tagId, name: tagName, label: tagLabel });
        
        selectedTags.push({ id: tagId, name: tagName });
    });
    
    console.log('✅ 最终选中的标签:', selectedTags);
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
            const statsResponse = await api.getUserTagStats();
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
async function editTagInManagement(userTagId, currentName, currentColor) {
    const newName = prompt('Enter new tag name:', currentName);
    if (!newName || newName.trim() === currentName) return;
    
    try {
        const response = await api.updateUserTag(userTagId, { 
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
async function deleteTagInManagement(userTagId) {
    if (!confirm('Are you sure you want to delete this tag? This action cannot be undone.')) {
        return;
    }
    
    try {
        console.log('🗑️ 删除标签:', userTagId);
        
        const response = await api.deleteUserTag(userTagId);
        
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
        const response = await api.createUserTag({
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
