import { auth } from './auth.js';
import { api } from './api.js';

// DOM 元素
const welcomeTitle = document.getElementById('welcomeTitle');
const contentGrid = document.getElementById('contentGrid');
const emptyState = document.getElementById('emptyState');
const logoutBtn = document.getElementById('logoutBtn');
const addContentForm = document.getElementById('addContentForm');

// 页面初始化
async function initPage() {
    // 检查认证状态
    if (!auth.checkAuth()) {
        window.location.href = '/login';
        return;
    }
    
    // 更新欢迎信息
    updateWelcomeMessage();
    
    // 加载用户内容
    await loadUserContent();
    
    // 绑定事件
    bindEvents();
}

// 更新欢迎信息
function updateWelcomeMessage() {
    const user = auth.getCurrentUser();
    if (user && user.nickname) {
        welcomeTitle.textContent = `欢迎回来，${user.nickname}！`;
    } else {
        welcomeTitle.textContent = '欢迎回来！';
    }
}

// 加载用户内容
async function loadUserContent() {
    try {
        const insights = await api.getInsights();
        
        if (insights && insights.length > 0) {
            renderContent(insights);
            emptyState.style.display = 'none';
        } else {
            showEmptyState();
        }
    } catch (error) {
        console.error('加载内容失败:', error);
        showEmptyState();
    }
}

// 渲染内容
function renderContent(insights) {
    contentGrid.innerHTML = '';
    
    insights.forEach(insight => {
        const card = createContentCard(insight);
        contentGrid.appendChild(card);
    });
}

// 创建内容卡片
function createContentCard(insight) {
    const card = document.createElement('div');
    card.className = 'content-card';
    
    const image = document.createElement('div');
    image.className = 'content-image';
    image.innerHTML = '🔗';
    
    const body = document.createElement('div');
    body.className = 'content-body';
    
    const title = document.createElement('h3');
    title.className = 'content-title';
    title.textContent = insight.title || new URL(insight.url).hostname;
    
    const description = document.createElement('p');
    description.className = 'content-description';
    description.textContent = insight.description || `来自 ${new URL(insight.url).hostname} 的内容`;
    
    const meta = document.createElement('div');
    meta.className = 'content-meta';
    
    const date = document.createElement('span');
    date.textContent = new Date(insight.created_at || Date.now()).toLocaleDateString();
    
    const actions = document.createElement('div');
    actions.innerHTML = `
        <button class="btn btn-secondary" onclick="deleteContent('${insight.id}')" style="padding: 4px 8px; font-size: 12px;">
            删除
        </button>
    `;
    
    meta.appendChild(date);
    meta.appendChild(actions);
    
    body.appendChild(title);
    body.appendChild(description);
    body.appendChild(meta);
    
    card.appendChild(image);
    card.appendChild(body);
    
    return card;
}

// 显示空状态
function showEmptyState() {
    contentGrid.style.display = 'none';
    emptyState.style.display = 'block';
}

// 绑定事件
function bindEvents() {
    // 登出按钮
    logoutBtn.addEventListener('click', async () => {
        try {
            await auth.logout();
            window.location.href = '/login';
        } catch (error) {
            console.error('登出失败:', error);
            // 即使API调用失败，也清除本地状态并跳转
            window.location.href = '/login';
        }
    });
    
    // 添加内容表单
    addContentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const url = document.getElementById('contentUrl').value.trim();
        const tags = document.getElementById('contentTags').value.trim();
        
        if (!url) {
            alert('请输入内容链接');
            return;
        }
        
        try {
            const insightData = { url };
            if (tags) {
                insightData.tags = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
            }
            
            await api.createInsight(insightData);
            
            // 重新加载内容
            await loadUserContent();
            
            // 清空表单并隐藏模态框
            addContentForm.reset();
            hideAddContentModal();
            
            alert('内容添加成功！');
        } catch (error) {
            console.error('添加内容失败:', error);
            alert(error.message || '添加内容失败，请重试');
        }
    });
}

// 删除内容
async function deleteContent(id) {
    if (!confirm('确定要删除这个内容吗？')) {
        return;
    }
    
    try {
        await api.deleteInsight(id);
        await loadUserContent();
        alert('内容删除成功！');
    } catch (error) {
        console.error('删除内容失败:', error);
        alert(error.message || '删除内容失败，请重试');
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initPage);

// 暴露全局函数
window.deleteContent = deleteContent;
window.showAddContentModal = showAddContentModal;
window.hideAddContentModal = hideAddContentModal;
