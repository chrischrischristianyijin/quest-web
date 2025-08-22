import { auth } from './auth.js';
import { PATHS, navigateTo } from './paths.js';

// Function to update UI based on login status
function updateUIForLoginStatus(isLoggedIn, user = null) {
    const navLinks = document.getElementById('navLinks');
    const authButtons = document.getElementById('authButtons');
    const welcomeTitle = document.getElementById('welcomeTitle');
    const tryButton = document.getElementById('tryButton');
    const ctaButton = document.getElementById('ctaButton');
    const welcomeBackSection = document.getElementById('welcomeBackSection');
    const welcomeBackTitle = document.getElementById('welcomeBackTitle');

    if (isLoggedIn && user) {
        navLinks.innerHTML = '';
        authButtons.innerHTML = `
            <a href="${PATHS.MY_SPACE}" class="btn btn-outline">My Space</a>
            <button class="btn btn-primary" id="logoutBtn">Log out</button>
        `;
        tryButton.textContent = 'Go to My Space';
        tryButton.href = PATHS.MY_SPACE;
        ctaButton.textContent = 'Go to My Space';
        ctaButton.href = PATHS.MY_SPACE;

        // 显示欢迎回来区域
        if (welcomeBackSection) {
            welcomeBackSection.style.display = 'block';
        }
        
        // 更新欢迎回来标题
        if (welcomeBackTitle) {
            if (user.nickname) {
                welcomeBackTitle.textContent = `欢迎回来，${user.nickname}！`;
            } else {
                welcomeBackTitle.textContent = '欢迎回来，Quest！';
            }
        }
        
        // 隐藏 Hero Section 的欢迎信息
        if (welcomeTitle) {
            welcomeTitle.style.display = 'none';
        }

        // Bind logout event
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.onclick = function(e) {
                e.preventDefault();
                handleLogout();
            };
        }
    } else {
        navLinks.innerHTML = '';
        authButtons.innerHTML = `
            <a href="${PATHS.SIGNUP}" class="btn btn-outline">Sign Up</a>
            <a href="${PATHS.LOGIN}" class="btn btn-primary">Log In</a>
        `;
        
        // 隐藏欢迎回来区域
        if (welcomeBackSection) {
            welcomeBackSection.style.display = 'none';
        }
        
        // 显示 Hero Section 的欢迎信息
        if (welcomeTitle) {
            welcomeTitle.style.display = 'block';
            welcomeTitle.textContent = 'Welcome to Quest';
        }
        
        tryButton.innerHTML = `
            Start Your Journey
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        tryButton.href = PATHS.SIGNUP;
        ctaButton.innerHTML = `
            Get Started for Free
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        ctaButton.href = PATHS.SIGNUP;
    }
}

// Handle logout
async function handleLogout() {
    console.log('🚪 用户点击登出...');
    
    try {
        // 直接清除本地状态
        await auth.logout();
        
        // 更新UI状态
        updateUIForLoginStatus(false);
        
        // 立即跳转到首页
        window.location.href = PATHS.HOME;
        
    } catch (error) {
        console.error('❌ 登出失败:', error);
        
        // 即使出错，也清除本地状态并跳转
        updateUIForLoginStatus(false);
        window.location.href = PATHS.HOME;
    }
}

// 显示登出消息
function showLogoutMessage(message, type = 'info') {
    // 移除现有消息
    const existingMessage = document.querySelector('.logout-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    const messageElement = document.createElement('div');
    messageElement.className = `logout-message logout-message-${type}`;
    messageElement.innerHTML = `
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
    
    // 添加样式
    messageElement.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        font-size: 14px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 8px;
        max-width: 300px;
        animation: slideInRight 0.3s ease-out;
    `;
    
    document.body.appendChild(messageElement);
    
    // 自动隐藏
    setTimeout(() => {
        if (messageElement.parentNode) {
            messageElement.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.remove();
                }
            }, 300);
        }
    }, 3000);
    
    // 添加CSS动画
    if (!document.querySelector('#logout-message-styles')) {
        const style = document.createElement('style');
        style.id = 'logout-message-styles';
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Extension Carousel Functionality
function initExtensionCarousel() {
    const slides = document.querySelectorAll('.carousel-slide');
    const indicators = document.querySelectorAll('.carousel-indicator');
    
    if (!slides.length || !indicators.length) return;
    
    let currentSlide = 0;
    let interval;

    function showSlide(index) {
        // Remove all classes from slides
        slides.forEach(slide => {
            slide.classList.remove('active');
        });
        indicators.forEach(indicator => indicator.classList.remove('active'));
        
        // Add active class to current slide
        slides[index].classList.add('active');
        indicators[index].classList.add('active');
    }

    function nextSlide() {
        currentSlide = (currentSlide + 1) % slides.length;
        showSlide(currentSlide);
    }

    function startCarousel() {
        interval = setInterval(nextSlide, 4000); // Switch every 4 seconds
    }

    function stopCarousel() {
        clearInterval(interval);
    }

    // Add click handlers to indicators
    indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => {
            currentSlide = index;
            showSlide(currentSlide);
            stopCarousel();
            startCarousel(); // Restart the timer
        });
    });

    // Initialize with first slide
    showSlide(0);
    
    // Start the carousel
    startCarousel();

    // Pause on hover
    const carousel = document.querySelector('.extension-carousel');
    if (carousel) {
        carousel.addEventListener('mouseenter', stopCarousel);
        carousel.addEventListener('mouseleave', startCarousel);
    }

    // Add keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            currentSlide = (currentSlide - 1 + slides.length) % slides.length;
            showSlide(currentSlide);
            stopCarousel();
            startCarousel();
        } else if (e.key === 'ArrowRight') {
            currentSlide = (currentSlide + 1) % slides.length;
            showSlide(currentSlide);
            stopCarousel();
            startCarousel();
        }
    });
}

// Navbar scroll effect
function initNavbarScrollEffect() {
    window.addEventListener('scroll', function() {
        const navbar = document.querySelector('.navbar');
        if (!navbar) return;
        
        if (window.scrollY > 50) {
            navbar.style.background = 'rgba(255, 255, 255, 0.99)';
            navbar.style.borderBottom = '1px solid rgba(75, 38, 79, 0.12)';
            navbar.style.boxShadow = '0 4px 24px rgba(0, 0, 0, 0.06)';
        } else {
            navbar.style.background = 'rgba(255, 255, 255, 0.98)';
            navbar.style.borderBottom = '1px solid rgba(75, 38, 79, 0.08)';
            navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.02)';
        }
    });
}

// Check login status on page load
document.addEventListener('DOMContentLoaded', async function() {
    // 检查认证状态
    try {
        if (auth.checkAuth()) {
            const user = auth.getCurrentUser();
            updateUIForLoginStatus(true, user);
        } else {
            updateUIForLoginStatus(false);
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
        updateUIForLoginStatus(false);
    }
    
    // 初始化其他功能
    initExtensionCarousel();
    initNavbarScrollEffect();
});

// Smooth scrolling for anchor links
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});
