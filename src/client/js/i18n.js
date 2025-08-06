// 国际化语言配置
const translations = {
    en: {
        // Navigation
        'nav.home': 'Home',
        'nav.mySpace': 'My Space',
        'nav.signUp': 'Sign Up',
        'nav.logIn': 'Log In',
        'nav.logOut': 'Log out',
        
        // Hero Section
        'hero.title': 'Welcome to Quest',
        'hero.title.welcomeBack': 'Welcome back, {nickname}!',
        'hero.subtitle': 'MULTIMEDIA INSIGHT STACK',
        'hero.cta': 'Start Your Journey',
        'hero.cta.mySpace': 'Go to My Space',
        
        // Extension Showcase
        'showcase.title': 'Click Less. Remember More.',
        'showcase.description': 'With {highlight}Insight Collector{/highlight}, saving articles, tweets, and ideas takes just one click. Everything goes straight into your {highlight}Personal Knowledge Vault.{/highlight}',
        'showcase.cta': 'Get the Extension - It\'s Free!',
        
        // Features Section
        'features.title': 'DISCOVER. ORGANIZE. CONNECT.',
        'features.description': 'In a world overflowing with information, we empower you to cut through the noise and focus on what truly matters.',
        'features.knowledgeMap.title': 'YOUR PERSONAL KNOWLEDGE MAP',
        'features.knowledgeMap.text': 'Tired of juggling endless tabs and apps to track your favorite content? With Quest, your digital life finds its home. {highlight}Manage your Space — a visual, intuitive hub that organizes everything you read, save, and ponder across platforms.{/highlight} No more fragmentation; just a seamless, unified library that grows with your interests.',
        'features.learn.title': 'LEARN FROM THE BEST MINDS AROUND YOU',
        'features.learn.text': 'Ever wished you could peek into the reading lists of experts, creators, or inspiring peers? Explore Others\' Spaces and turn that wish into reality. {highlight}Follow thought leaders, dive into curated collections, and let their knowledge spark your next "aha" moment.{/highlight} Here, your profile isn\'t just a page—it\'s a living archive of your intellectual growth.',
        
        // CTA Section
        'cta.title': 'Ready to Transform Your Learning?',
        'cta.description': 'Transform scattered content into a cohesive intellectual journey. Curate your world, connect through knowledge.',
        'cta.button': 'Get Started for Free',
        
        // Footer
        'footer.quest': 'Quest',
        'footer.description': 'Your personal knowledge hub for discovering and sharing meaningful content across the web.',
        'footer.quickLinks': 'Quick Links',
        'footer.contact': 'Contact',
        'footer.copyright': '© 2024 Quest. All rights reserved.',
        'footer.email': 'Email: contact@myquestspace.com',
        
        // Language Switcher
        'language.en': 'English',
        'language.zh': '中文'
    },
    zh: {
        // Navigation
        'nav.home': '首页',
        'nav.mySpace': '我的空间',
        'nav.signUp': '注册',
        'nav.logIn': '登录',
        'nav.logOut': '退出登录',
        
        // Hero Section
        'hero.title': '欢迎来到 Quest',
        'hero.title.welcomeBack': '欢迎回来，{nickname}！',
        'hero.subtitle': '多媒体洞察平台',
        'hero.cta': '开始你的旅程',
        'hero.cta.mySpace': '进入我的空间',
        
        // Extension Showcase
        'showcase.title': '点击更少，记住更多。',
        'showcase.description': '通过{highlight}洞察收集器{/highlight}，保存文章、推文和想法只需一键点击。所有内容直接进入你的{highlight}个人知识库。{/highlight}',
        'showcase.cta': '获取扩展 - 完全免费！',
        
        // Features Section
        'features.title': '发现。整理。连接。',
        'features.description': '在信息泛滥的世界中，我们帮助你过滤噪音，专注于真正重要的事物。',
        'features.knowledgeMap.title': '你的个人知识地图',
        'features.knowledgeMap.text': '厌倦了在无数标签页和应用之间切换来跟踪你喜爱的内容？有了 Quest，你的数字生活找到了归宿。{highlight}管理你的空间 — 一个直观的可视化中心，整理你在各个平台上阅读、保存和思考的一切内容。{/highlight}不再碎片化；只有一个无缝的统一图书馆，随着你的兴趣而成长。',
        'features.learn.title': '向周围最优秀的人学习',
        'features.learn.text': '是否曾希望窥探专家、创作者或激励人心的同行的阅读清单？探索他人的空间，将这个愿望变为现实。{highlight}关注思想领袖，深入策划的收藏，让他们的知识激发你的下一个"顿悟"时刻。{/highlight}在这里，你的个人资料不仅仅是一个页面 — 它是你智力成长的活档案。',
        
        // CTA Section
        'cta.title': '准备好改变你的学习方式了吗？',
        'cta.description': '将分散的内容转化为连贯的智力旅程。策划你的世界，通过知识连接。',
        'cta.button': '免费开始使用',
        
        // Footer
        'footer.quest': 'Quest',
        'footer.description': '你的个人知识中心，用于发现和分享网络上有意义的内容。',
        'footer.quickLinks': '快速链接',
        'footer.contact': '联系我们',
        'footer.copyright': '© 2024 Quest。保留所有权利。',
        'footer.email': '邮箱：contact@myquestspace.com',
        
        // Language Switcher
        'language.en': 'English',
        'language.zh': '中文'
    }
};

// 语言管理类
class I18n {
    constructor() {
        this.currentLanguage = localStorage.getItem('quest_language') || 'en';
        console.log('I18n initialized with language:', this.currentLanguage);
        this.init();
    }
    
    init() {
        console.log('Initializing I18n...');
        this.updateLanguage(this.currentLanguage);
        this.createLanguageSwitcher();
        console.log('I18n initialization complete');
    }
    
    // 获取翻译文本
    get(key, params = {}) {
        let text = translations[this.currentLanguage][key] || translations.en[key] || key;
        
        // 替换参数
        Object.keys(params).forEach(param => {
            text = text.replace(`{${param}}`, params[param]);
        });
        
        // 处理高亮文本
        text = text.replace(/\{highlight\}(.*?)\{\/highlight\}/g, '<span class="feature-highlight">$1</span>');
        
        return text;
    }
    
    // 更新语言
    updateLanguage(lang) {
        console.log('Updating language to:', lang);
        this.currentLanguage = lang;
        localStorage.setItem('quest_language', lang);
        this.updatePageContent();
    }
    
    // 创建语言切换器
    createLanguageSwitcher() {
        console.log('Creating language switcher...');
        const navbar = document.querySelector('.nav-container');
        if (!navbar) {
            console.warn('Navbar container not found');
            return;
        }
        
        // 检查是否已存在语言切换器
        if (document.querySelector('.language-switcher')) {
            console.log('Language switcher already exists');
            return;
        }
        
        const languageSwitcher = document.createElement('div');
        languageSwitcher.className = 'language-switcher';
        languageSwitcher.innerHTML = `
            <button class="lang-btn ${this.currentLanguage === 'en' ? 'active' : ''}" data-lang="en">
                ${this.get('language.en')}
            </button>
            <button class="lang-btn ${this.currentLanguage === 'zh' ? 'active' : ''}" data-lang="zh">
                ${this.get('language.zh')}
            </button>
        `;
        
        // 插入到导航栏
        const authButtons = navbar.querySelector('.auth-buttons');
        if (authButtons) {
            navbar.insertBefore(languageSwitcher, authButtons);
            console.log('Language switcher added to navbar');
        } else {
            navbar.appendChild(languageSwitcher);
            console.log('Language switcher added to navbar (fallback)');
        }
        
        // 添加事件监听
        languageSwitcher.addEventListener('click', (e) => {
            if (e.target.classList.contains('lang-btn')) {
                const lang = e.target.dataset.lang;
                console.log('Language button clicked:', lang);
                this.updateLanguage(lang);
                this.updateLanguageSwitcher();
            }
        });
    }
    
    // 更新语言切换器状态
    updateLanguageSwitcher() {
        const switcher = document.querySelector('.language-switcher');
        if (!switcher) return;
        
        switcher.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === this.currentLanguage);
        });
    }
    
    // 更新页面内容
    updatePageContent() {
        console.log('Updating page content for language:', this.currentLanguage);
        
        // 更新导航栏
        this.updateNavigation();
        
        // 更新英雄区域
        this.updateHeroSection();
        
        // 更新扩展展示区域
        this.updateShowcaseSection();
        
        // 更新特性区域
        this.updateFeaturesSection();
        
        // 更新CTA区域
        this.updateCTASection();
        
        // 更新页脚
        this.updateFooter();
        
        // 更新语言切换器
        this.updateLanguageSwitcher();
        
        console.log('Page content update complete');
    }
    
    // 更新导航栏
    updateNavigation() {
        console.log('Updating navigation...');
        const navLinks = document.getElementById('navLinks');
        const authButtons = document.getElementById('authButtons');
        
        if (navLinks) {
            const email = localStorage.getItem('userEmail') || (new URLSearchParams(window.location.search)).get('email');
            if (email) {
                navLinks.innerHTML = `
                    <a href="/spaces/my-space.html?email=${encodeURIComponent(email)}" class="nav-link">${this.get('nav.mySpace')}</a>
                `;
            } else {
                navLinks.innerHTML = '';
            }
        }
        
        if (authButtons) {
            const email = localStorage.getItem('userEmail') || (new URLSearchParams(window.location.search)).get('email');
            if (email) {
                authButtons.innerHTML = `
                    <a href="/spaces/my-space.html?email=${encodeURIComponent(email)}" class="btn btn-outline">${this.get('nav.mySpace')}</a>
                    <button class="btn btn-primary" id="logoutBtn">${this.get('nav.logOut')}</button>
                `;
            } else {
                authButtons.innerHTML = `
                    <a href="/signup" class="btn btn-outline">${this.get('nav.signUp')}</a>
                    <a href="/login" class="btn btn-primary">${this.get('nav.logIn')}</a>
                `;
            }
        }
    }
    
    // 更新英雄区域
    updateHeroSection() {
        console.log('Updating hero section...');
        const welcomeTitle = document.getElementById('welcomeTitle');
        const tryButton = document.getElementById('tryButton');
        const ctaButton = document.getElementById('ctaButton');
        
        if (welcomeTitle) {
            const email = localStorage.getItem('userEmail') || (new URLSearchParams(window.location.search)).get('email');
            if (email) {
                // 获取用户昵称
                this.getUserNickname(email).then(nickname => {
                    if (nickname) {
                        welcomeTitle.innerHTML = this.get('hero.title.welcomeBack', { nickname });
                    } else {
                        welcomeTitle.innerHTML = this.get('hero.title');
                    }
                });
            } else {
                welcomeTitle.innerHTML = this.get('hero.title');
            }
        }
        
        if (tryButton) {
            const email = localStorage.getItem('userEmail') || (new URLSearchParams(window.location.search)).get('email');
            if (email) {
                tryButton.innerHTML = `
                    ${this.get('hero.cta.mySpace')}
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                `;
                tryButton.href = `/spaces/my-space.html?email=${encodeURIComponent(email)}`;
            } else {
                tryButton.innerHTML = `
                    ${this.get('hero.cta')}
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                `;
                tryButton.href = '/signup';
            }
        }
        
        if (ctaButton) {
            const email = localStorage.getItem('userEmail') || (new URLSearchParams(window.location.search)).get('email');
            if (email) {
                ctaButton.innerHTML = `
                    ${this.get('hero.cta.mySpace')}
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                `;
                ctaButton.href = `/spaces/my-space.html?email=${encodeURIComponent(email)}`;
            } else {
                ctaButton.innerHTML = `
                    ${this.get('cta.button')}
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                `;
                ctaButton.href = '/signup';
            }
        }
    }
    
    // 更新扩展展示区域
    updateShowcaseSection() {
        console.log('Updating showcase section...');
        const showcaseTitle = document.querySelector('.showcase-title');
        const showcaseDescription = document.querySelector('.showcase-description');
        const showcaseCta = document.querySelector('.showcase-cta');
        
        if (showcaseTitle) {
            showcaseTitle.innerHTML = this.get('showcase.title');
        }
        
        if (showcaseDescription) {
            showcaseDescription.innerHTML = this.get('showcase.description');
        }
        
        if (showcaseCta) {
            showcaseCta.innerHTML = `
                ${this.get('showcase.cta')}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
        }
    }
    
    // 更新特性区域
    updateFeaturesSection() {
        console.log('Updating features section...');
        const sectionTitle = document.querySelector('.section-title');
        const sectionDescription = document.querySelector('.section-description');
        const featureTitles = document.querySelectorAll('.feature-title');
        const featureTexts = document.querySelectorAll('.feature-text');
        
        if (sectionTitle) {
            sectionTitle.innerHTML = this.get('features.title');
        }
        
        if (sectionDescription) {
            sectionDescription.innerHTML = this.get('features.description');
        }
        
        if (featureTitles.length >= 2) {
            featureTitles[0].innerHTML = this.get('features.knowledgeMap.title');
            featureTitles[1].innerHTML = this.get('features.learn.title');
        }
        
        if (featureTexts.length >= 2) {
            featureTexts[0].innerHTML = this.get('features.knowledgeMap.text');
            featureTexts[1].innerHTML = this.get('features.learn.text');
        }
    }
    
    // 更新CTA区域
    updateCTASection() {
        console.log('Updating CTA section...');
        const ctaTitle = document.querySelector('.cta-title');
        const ctaDescription = document.querySelector('.cta-description');
        
        if (ctaTitle) {
            ctaTitle.innerHTML = this.get('cta.title');
        }
        
        if (ctaDescription) {
            ctaDescription.innerHTML = this.get('cta.description');
        }
    }
    
    // 更新页脚
    updateFooter() {
        console.log('Updating footer...');
        const footerSections = document.querySelectorAll('.footer-section h3');
        const footerTexts = document.querySelectorAll('.footer-text');
        const footerLinks = document.querySelectorAll('.footer-links a');
        const footerBottom = document.querySelector('.footer-bottom p');
        
        if (footerSections.length >= 3) {
            footerSections[0].innerHTML = this.get('footer.quest');
            footerSections[1].innerHTML = this.get('footer.quickLinks');
            footerSections[2].innerHTML = this.get('footer.contact');
        }
        
        if (footerTexts.length >= 2) {
            footerTexts[0].innerHTML = this.get('footer.description');
            footerTexts[1].innerHTML = this.get('footer.email');
        }
        
        if (footerLinks.length >= 3) {
            footerLinks[0].innerHTML = this.get('nav.home');
            footerLinks[1].innerHTML = this.get('nav.signUp');
            footerLinks[2].innerHTML = this.get('nav.logIn');
        }
        
        if (footerBottom) {
            footerBottom.innerHTML = this.get('footer.copyright');
        }
    }
    
    // 获取用户昵称
    async getUserNickname(email) {
        try {
            const response = await fetch(`/api/v1/users?email=${encodeURIComponent(email)}`);
            if (response.ok) {
                const data = await response.json();
                return data.user?.nickname || null;
            }
            return null;
        } catch (error) {
            console.error('Error fetching user nickname:', error);
            return null;
        }
    }
}

// 等待DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing I18n...');
    window.i18n = new I18n();
});

// 导出国际化实例（用于调试）
if (typeof window !== 'undefined') {
    window.I18n = I18n;
} 