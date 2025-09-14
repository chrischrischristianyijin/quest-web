// 认证过期弹窗组件
class AuthExpiredModal {
    constructor() {
        this.modal = null;
        this.isShowing = false;
        this.init();
    }

    init() {
        // 创建弹窗HTML结构
        this.createModal();
        // 添加全局样式
        this.addStyles();
    }

    createModal() {
        // 创建弹窗容器
        this.modal = document.createElement('div');
        this.modal.id = 'auth-expired-modal';
        this.modal.className = 'auth-modal-overlay';
        
        this.modal.innerHTML = `
            <div class="auth-modal-container">
                <div class="auth-modal-header">
                    <div class="auth-modal-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <h3 class="auth-modal-title">Session Expired</h3>
                </div>
                <div class="auth-modal-body">
                    <p class="auth-modal-message">
                        Your session has expired. Please log in again to continue using Quest.
                    </p>
                </div>
                <div class="auth-modal-footer">
                    <button class="auth-modal-btn auth-modal-btn-primary" id="authModalLoginBtn">
                        Go to Login
                    </button>
                </div>
            </div>
        `;

        // 添加到页面
        document.body.appendChild(this.modal);

        // 绑定事件
        this.bindEvents();
    }

    bindEvents() {
        const loginBtn = this.modal.querySelector('#authModalLoginBtn');
        const overlay = this.modal.querySelector('.auth-modal-overlay');

        // 登录按钮点击事件
        loginBtn.addEventListener('click', () => {
            this.hide();
            // 跳转到登录页面
            window.location.href = '/src/client/pages/login.html';
        });

        // 点击遮罩层关闭（这里不允许关闭，必须登录）
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                // 不允许通过点击遮罩关闭
                e.preventDefault();
                e.stopPropagation();
            }
        });

        // 阻止ESC键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isShowing) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
    }

    show() {
        if (this.isShowing) return;
        
        this.isShowing = true;
        this.modal.style.display = 'flex';
        
        // 添加动画效果
        setTimeout(() => {
            this.modal.classList.add('show');
        }, 10);

        // 阻止页面滚动
        document.body.style.overflow = 'hidden';
    }

    hide() {
        if (!this.isShowing) return;
        
        this.isShowing = false;
        this.modal.classList.remove('show');
        
        setTimeout(() => {
            this.modal.style.display = 'none';
            document.body.style.overflow = '';
        }, 300);
    }

    addStyles() {
        // 检查是否已经添加过样式
        if (document.getElementById('auth-modal-styles')) return;

        const style = document.createElement('style');
        style.id = 'auth-modal-styles';
        style.textContent = `
            .auth-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(10px);
                display: none;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                opacity: 0;
                transition: opacity 0.3s ease;
            }

            .auth-modal-overlay.show {
                opacity: 1;
            }

            .auth-modal-container {
                background: white;
                border-radius: 16px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                max-width: 400px;
                width: 90%;
                max-height: 90vh;
                overflow: hidden;
                transform: scale(0.9) translateY(20px);
                transition: transform 0.3s ease;
            }

            .auth-modal-overlay.show .auth-modal-container {
                transform: scale(1) translateY(0);
            }

            .auth-modal-header {
                padding: 24px 24px 16px;
                text-align: center;
                border-bottom: 1px solid #f0f0f0;
            }

            .auth-modal-icon {
                width: 48px;
                height: 48px;
                margin: 0 auto 16px;
                background: linear-gradient(135deg, #ff6b6b, #ff8e8e);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
            }

            .auth-modal-title {
                margin: 0;
                font-size: 20px;
                font-weight: 600;
                color: #1a1a1a;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .auth-modal-body {
                padding: 20px 24px;
                text-align: center;
            }

            .auth-modal-message {
                margin: 0;
                font-size: 16px;
                line-height: 1.5;
                color: #666;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .auth-modal-footer {
                padding: 16px 24px 24px;
                display: flex;
                justify-content: center;
                gap: 12px;
            }

            .auth-modal-btn {
                padding: 12px 24px;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                min-width: 120px;
            }

            .auth-modal-btn-primary {
                background: linear-gradient(135deg, #8B5FBF, #C77DFF);
                color: white;
                box-shadow: 0 4px 12px rgba(139, 95, 191, 0.3);
            }

            .auth-modal-btn-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(139, 95, 191, 0.4);
            }

            .auth-modal-btn-primary:active {
                transform: translateY(0);
            }

            /* 移动端适配 */
            @media (max-width: 480px) {
                .auth-modal-container {
                    margin: 20px;
                    width: calc(100% - 40px);
                }

                .auth-modal-header,
                .auth-modal-body,
                .auth-modal-footer {
                    padding-left: 20px;
                    padding-right: 20px;
                }

                .auth-modal-title {
                    font-size: 18px;
                }

                .auth-modal-message {
                    font-size: 15px;
                }

                .auth-modal-btn {
                    font-size: 15px;
                    padding: 10px 20px;
                }
            }
        `;

        document.head.appendChild(style);
    }

    // 销毁弹窗
    destroy() {
        if (this.modal && this.modal.parentNode) {
            this.modal.parentNode.removeChild(this.modal);
        }
        
        const style = document.getElementById('auth-modal-styles');
        if (style && style.parentNode) {
            style.parentNode.removeChild(style);
        }
        
        document.body.style.overflow = '';
        this.isShowing = false;
    }
}

// 创建全局实例
export const authExpiredModal = new AuthExpiredModal();

// 全局认证过期处理函数
export function handleAuthExpired() {
    console.log('🔒 Showing auth expired modal...');
    authExpiredModal.show();
}
