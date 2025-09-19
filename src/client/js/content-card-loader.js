// Content Card Loading Placeholder
// 为添加Content Card时提供加载占位符功能

class ContentCardLoader {
    constructor() {
        this.loadingCards = new Map(); // 存储加载中的卡片
    }

    // 创建加载占位符卡片
    createLoadingCard(url, position = 'prepend') {
        const cardId = `loading-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const loadingCard = document.createElement('div');
        loadingCard.className = 'content-card loading-card';
        loadingCard.dataset.loadingId = cardId;
        loadingCard.dataset.url = url;
        
        loadingCard.innerHTML = `
            <button class="content-card-delete-btn" style="display: none;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12H19" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <div class="loading-card-image-container"></div>
            <div class="content-card-content">
                <div class="content-card-header">
                    <div class="content-card-top-row">
                        <div class="content-card-date"></div>
                        <div class="content-card-source">
                            <div class="content-card-source-logo"></div>
                            <span class="content-card-source-name"></span>
                        </div>
                    </div>
                    <div class="content-card-title"></div>
                </div>
                <div class="content-card-description">
                    <div class="loading-card-description-line"></div>
                    <div class="loading-card-description-line"></div>
                    <div class="loading-card-description-line"></div>
                </div>
                <div class="content-card-footer">
                    <div class="content-card-tag-main"></div>
                </div>
            </div>
            <div class="loading-card-overlay">
                <div class="loading-spinner">
                    <div class="spinner"></div>
                </div>
                <div class="loading-text">Loading content...</div>
            </div>
        `;
        
        // 插入到指定位置
        const contentCards = document.getElementById('contentCards');
        if (contentCards) {
            if (position === 'prepend') {
                contentCards.insertBefore(loadingCard, contentCards.firstChild);
            } else if (position === 'append') {
                contentCards.appendChild(loadingCard);
            } else {
                // 插入到指定位置
                const targetElement = document.querySelector(position);
                if (targetElement) {
                    contentCards.insertBefore(loadingCard, targetElement);
                } else {
                    contentCards.appendChild(loadingCard);
                }
            }
        }
        
        // 存储加载卡片信息
        this.loadingCards.set(cardId, {
            element: loadingCard,
            url: url,
            startTime: Date.now()
        });
        
        // 添加淡入动画
        setTimeout(() => {
            loadingCard.style.opacity = '1';
            loadingCard.style.transform = 'translateY(0)';
        }, 10);
        
        // 添加悬停效果支持
        loadingCard.addEventListener('mouseenter', () => {
            if (!loadingCard.classList.contains('updating')) {
                loadingCard.style.transform = 'translateY(-4px)';
                loadingCard.style.boxShadow = 'var(--shadow-medium)';
            }
        });
        
        loadingCard.addEventListener('mouseleave', () => {
            if (!loadingCard.classList.contains('updating')) {
                loadingCard.style.transform = 'translateY(0)';
                loadingCard.style.boxShadow = 'var(--shadow-light)';
            }
        });
        
        console.log('🔄 Created loading card:', cardId, 'for URL:', url);
        return cardId;
    }

    // 更新加载卡片为实际内容
    updateLoadingCard(cardId, insightData) {
        const loadingInfo = this.loadingCards.get(cardId);
        if (!loadingInfo) {
            console.warn('⚠️ Loading card not found:', cardId);
            return false;
        }

        const loadingCard = loadingInfo.element;
        const url = loadingInfo.url;
        
        console.log('✅ Updating loading card:', cardId, 'with insight data:', insightData);
        
        // 创建实际的insight卡片
        const actualCard = this.createActualCard(insightData);
        
        // 添加更新动画
        loadingCard.classList.add('updating');
        loadingCard.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        loadingCard.style.transform = 'scale(0.98)';
        loadingCard.style.opacity = '0.8';
        
        setTimeout(() => {
            // 替换加载卡片
            loadingCard.parentNode.replaceChild(actualCard, loadingCard);
            
            // 添加新卡片的淡入动画
            actualCard.style.opacity = '0';
            actualCard.style.transform = 'translateY(10px) scale(0.98)';
            
            setTimeout(() => {
                actualCard.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
                actualCard.style.opacity = '1';
                actualCard.style.transform = 'translateY(0) scale(1)';
                
                // 添加悬停效果
                actualCard.addEventListener('mouseenter', () => {
                    actualCard.style.transform = 'translateY(-4px) scale(1)';
                    actualCard.style.boxShadow = 'var(--shadow-medium)';
                });
                
                actualCard.addEventListener('mouseleave', () => {
                    actualCard.style.transform = 'translateY(0) scale(1)';
                    actualCard.style.boxShadow = 'var(--shadow-light)';
                });
            }, 50);
            
            // 清理加载卡片记录
            this.loadingCards.delete(cardId);
            
            console.log('✅ Successfully replaced loading card with actual content');
        }, 250);
        
        return true;
    }

    // 创建实际的insight卡片
    createActualCard(insightData) {
        // 使用现有的createInsightCard函数
        if (typeof createInsightCard === 'function') {
            return createInsightCard(insightData);
        }
        
        // 如果createInsightCard不可用，创建一个简化版本
        const card = document.createElement('div');
        card.className = 'content-card';
        card.dataset.insightId = insightData.id;
        
        card.innerHTML = `
            <div class="content-card-image-container">
                <img class="content-card-image" src="${insightData.image_url || '/public/logo.png'}" alt="${insightData.title || 'Content image'}" loading="lazy">
            </div>
            <div class="content-card-header">
                <div class="content-card-top-row">
                    <div class="content-card-source">${this.getSourceName(insightData.url)}</div>
                    <div class="content-card-date">${new Date().toLocaleDateString()}</div>
                </div>
                <div class="content-card-title">${insightData.title || 'Untitled'}</div>
            </div>
            <div class="content-card-description">${insightData.description || 'No description available'}</div>
            <div class="content-card-footer">
                <div class="content-card-tag-main">${insightData.tags?.[0]?.name || 'Archive'}</div>
            </div>
        `;
        
        return card;
    }

    // 移除加载卡片（用于错误情况）
    removeLoadingCard(cardId, showError = true) {
        const loadingInfo = this.loadingCards.get(cardId);
        if (!loadingInfo) {
            console.warn('⚠️ Loading card not found for removal:', cardId);
            return false;
        }

        const loadingCard = loadingInfo.element;
        
        if (showError) {
            // 显示错误状态
            loadingCard.innerHTML = `
                <button class="content-card-delete-btn" style="display: none;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M5 12H19" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <div class="loading-card-image-container"></div>
                <div class="content-card-content">
                    <div class="content-card-header">
                        <div class="content-card-top-row">
                            <div class="content-card-date"></div>
                            <div class="content-card-source">
                                <div class="content-card-source-logo"></div>
                                <span class="content-card-source-name"></span>
                            </div>
                        </div>
                        <div class="content-card-title"></div>
                    </div>
                    <div class="content-card-description">
                        <div class="loading-card-description-line"></div>
                        <div class="loading-card-description-line"></div>
                        <div class="loading-card-description-line"></div>
                    </div>
                    <div class="content-card-footer">
                        <div class="content-card-tag-main"></div>
                    </div>
                </div>
                <div class="error-state">
                    <div class="error-icon">❌</div>
                    <div class="error-text">Failed to load content</div>
                    <div class="error-details">${loadingInfo.url}</div>
                </div>
            `;
            
            // 添加错误动画
            loadingCard.style.transition = 'all 0.3s ease-out';
            loadingCard.style.borderColor = '#dc3545';
            loadingCard.style.boxShadow = '0 4px 12px rgba(220, 53, 69, 0.2)';
            
            // 3秒后移除
            setTimeout(() => {
                if (loadingCard.parentNode) {
                    loadingCard.style.transition = 'all 0.4s ease-out';
                    loadingCard.style.opacity = '0';
                    loadingCard.style.transform = 'translateY(-20px) scale(0.95)';
                    
                    setTimeout(() => {
                        loadingCard.remove();
                    }, 400);
                }
            }, 3000);
        } else {
            // 直接移除
            loadingCard.remove();
        }
        
        // 清理记录
        this.loadingCards.delete(cardId);
        
        console.log('🗑️ Removed loading card:', cardId);
        return true;
    }

    // 获取源网站名称
    getSourceName(url) {
        try {
            const hostname = new URL(url).hostname;
            return hostname.replace('www.', '');
        } catch {
            return 'Unknown';
        }
    }

    // 获取所有加载中的卡片
    getLoadingCards() {
        return Array.from(this.loadingCards.keys());
    }

    // 清理所有加载卡片
    clearAllLoadingCards() {
        this.loadingCards.forEach((info, cardId) => {
            this.removeLoadingCard(cardId, false);
        });
        this.loadingCards.clear();
        console.log('🧹 Cleared all loading cards');
    }

    // 检查是否有加载中的卡片
    hasLoadingCards() {
        return this.loadingCards.size > 0;
    }
}

// 创建全局实例
window.contentCardLoader = new ContentCardLoader();

// 添加便捷方法
window.createLoadingCard = (url, position) => window.contentCardLoader.createLoadingCard(url, position);
window.updateLoadingCard = (cardId, insightData) => window.contentCardLoader.updateLoadingCard(cardId, insightData);
window.removeLoadingCard = (cardId, showError) => window.contentCardLoader.removeLoadingCard(cardId, showError);

console.log('🔄 Content Card Loader initialized');
console.log('💡 Usage:');
console.log('  - createLoadingCard(url, position) - Create loading placeholder');
console.log('  - updateLoadingCard(cardId, insightData) - Update with actual content');
console.log('  - removeLoadingCard(cardId, showError) - Remove loading card');

export { ContentCardLoader };
