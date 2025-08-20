import { auth } from './auth.js';

// 初始化语言切换器
function initLanguageSwitcher() {
    const navbar = document.querySelector('.nav-container');
    if (!navbar) {
        console.warn('Navbar container not found');
        return;
    }
    
    // 检查是否已存在语言切换器
    if (document.querySelector('.language-switcher')) {
        return;
    }
    
    const currentLanguage = localStorage.getItem('quest_language') || 'en';
    
    const languageSwitcher = document.createElement('div');
    languageSwitcher.className = 'language-switcher';
    languageSwitcher.innerHTML = `
        <button class="lang-btn ${currentLanguage === 'en' ? 'active' : ''}" data-lang="en">
            English
        </button>
        <button class="lang-btn ${currentLanguage === 'zh' ? 'active' : ''}" data-lang="zh">
            中文
        </button>
    `;
    
    // 插入到导航栏
    const authButtons = navbar.querySelector('.auth-buttons');
    if (authButtons) {
        navbar.insertBefore(languageSwitcher, authButtons);
    } else {
        navbar.appendChild(languageSwitcher);
    }
    
    // 添加事件监听
    languageSwitcher.addEventListener('click', (e) => {
        if (e.target.classList.contains('lang-btn')) {
            const lang = e.target.dataset.lang;
            localStorage.setItem('quest_language', lang);
            
            // 更新按钮状态
            languageSwitcher.querySelectorAll('.lang-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.lang === lang);
            });
            
            // 重新加载页面以应用新语言
            window.location.reload();
        }
    });
}

// Function to update UI based on login status
function updateUIForLoginStatus(isLoggedIn, user = null) {
    const navLinks = document.getElementById('navLinks');
    const authButtons = document.getElementById('authButtons');
    const welcomeTitle = document.getElementById('welcomeTitle');
    const tryButton = document.getElementById('tryButton');
    const ctaButton = document.getElementById('ctaButton');

    if (isLoggedIn && user) {
        navLinks.innerHTML = `
            <a href="/my-space" class="nav-link">My Space</a>
        `;
        authButtons.innerHTML = `
            <a href="/my-space" class="btn btn-outline">My Space</a>
            <button class="btn btn-primary" id="logoutBtn">Log out</button>
        `;
        tryButton.textContent = 'Go to My Space';
        tryButton.href = '/my-space';
        ctaButton.textContent = 'Go to My Space';
        ctaButton.href = '/my-space';

        // Display nickname
        if (user.nickname) {
            welcomeTitle.textContent = `Welcome back, ${user.nickname}!`;
        } else {
            welcomeTitle.textContent = 'Welcome back to Quest!';
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
            <a href="/signup" class="btn btn-outline">Sign Up</a>
            <a href="/login" class="btn btn-primary">Log In</a>
        `;
        welcomeTitle.textContent = 'Welcome to Quest';
        tryButton.innerHTML = `
            Start Your Journey
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        tryButton.href = '/signup';
        ctaButton.innerHTML = `
            Get Started for Free
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        ctaButton.href = '/signup';
    }
}

// Handle logout
async function handleLogout() {
    try {
        await auth.logout();
        updateUIForLoginStatus(false);
        window.location.href = '/';
    } catch (error) {
        console.error('Logout error:', error);
        // 即使 API 调用失败，也清除本地状态
        updateUIForLoginStatus(false);
        window.location.href = '/';
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

// 应用中文翻译
function applyChineseTranslation() {
    const translations = {
        // Hero Section
        'welcomeTitle': '欢迎来到 Quest',
        'hero-subtitle': '多媒体洞察平台',
        'tryButton': '开始你的旅程',
        'ctaButton': '免费开始使用',
        
        // Extension Showcase
        'showcase-title': '点击更少，记住更多。',
        'showcase-description': '通过<span class="showcase-highlight">洞察收集器</span>，保存文章、推文和想法只需一键点击。所有内容直接进入你的<span class="showcase-highlight">个人知识库。</span>',
        'showcase-cta': '获取扩展 - 完全免费！',
        
        // Features Section
        'section-title': '发现。整理。连接。',
        'section-description': '在信息泛滥的世界中，我们帮助你过滤噪音，专注于真正重要的事物。',
        'feature-title-1': '你的个人知识地图',
        'feature-text-1': '厌倦了在无数标签页和应用之间切换来跟踪你喜爱的内容？有了 Quest，你的数字生活找到了归宿。<span class="feature-highlight">管理你的空间 — 一个直观的可视化中心，整理你在各个平台上阅读、保存和思考的一切内容。</span>不再碎片化；只有一个无缝的统一图书馆，随着你的兴趣而成长。',
        'feature-title-2': '向周围最优秀的人学习',
        'feature-text-2': '是否曾希望窥探专家、创作者或激励人心的同行的阅读清单？探索他人的空间，将这个愿望变为现实。<span class="feature-highlight">关注思想领袖，深入策划的收藏，让他们的知识激发你的下一个"顿悟"时刻。</span>在这里，你的个人资料不仅仅是一个页面 — 它是你智力成长的活档案。',
        
        // CTA Section
        'cta-title': '准备好改变你的学习方式了吗？',
        'cta-description': '将分散的内容转化为连贯的智力旅程。策划你的世界，通过知识连接。',
        
        // Navigation
        'nav-mySpace': '我的空间',
        'nav-signUp': '注册',
        'nav-logIn': '登录',
        'nav-logOut': '退出登录',
        
        // Footer
        'footer-quest': 'Quest',
        'footer-description': '你的个人知识中心，用于发现和分享网络上有意义的内容。',
        'footer-quickLinks': '快速链接',
        'footer-contact': '联系我们',
        'footer-copyright': '© 2024 Quest。保留所有权利。',
        'footer-email': '邮箱：contact@myquestspace.com'
    };
    
    // 更新页面内容
    Object.keys(translations).forEach(key => {
        const element = document.getElementById(key) || document.querySelector(`[data-translate="${key}"]`);
        if (element) {
            element.innerHTML = translations[key];
        }
    });
    
    // 更新导航栏
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        if (link.textContent === 'My Space') {
            link.textContent = translations['nav-mySpace'];
        }
    });
    
    const authButtons = document.querySelectorAll('.btn');
    authButtons.forEach(btn => {
        if (btn.textContent === 'Sign Up') {
            btn.textContent = translations['nav-signUp'];
        } else if (btn.textContent === 'Log In') {
            btn.textContent = translations['nav-logIn'];
        } else if (btn.textContent === 'Log out') {
            btn.textContent = translations['nav-logOut'];
        }
    });
    
    // 更新页脚
    const footerSections = document.querySelectorAll('.footer-section h3');
    if (footerSections.length >= 3) {
        footerSections[0].textContent = translations['footer-quest'];
        footerSections[1].textContent = translations['footer-quickLinks'];
        footerSections[2].textContent = translations['footer-contact'];
    }
    
    const footerTexts = document.querySelectorAll('.footer-text');
    if (footerTexts.length >= 2) {
        footerTexts[0].textContent = translations['footer-description'];
        footerTexts[1].textContent = translations['footer-email'];
    }
    
    const footerBottom = document.querySelector('.footer-bottom p');
    if (footerBottom) {
        footerBottom.textContent = translations['footer-copyright'];
    }
}

// Check login status on page load
document.addEventListener('DOMContentLoaded', async function() {
    // 初始化语言切换器
    initLanguageSwitcher();
    
    // 应用当前语言
    const currentLanguage = localStorage.getItem('quest_language') || 'en';
    if (currentLanguage === 'zh') {
        applyChineseTranslation();
    }
    
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
