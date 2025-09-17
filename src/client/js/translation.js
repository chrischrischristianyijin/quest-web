/**
 * Translation system for Quest
 * Handles English/Chinese text switching
 */

class TranslationManager {
    constructor() {
        this.currentLanguage = localStorage.getItem('quest_language') || 'en';
        this.translations = {
            en: {
                // Navigation
                'demo_chat': 'Demo Chat',
                'language': 'EN',
                'my_space': 'My Space',
                'email_preferences': 'Email Preferences',
                'edit_profile': 'Edit Profile',
                'log_out': 'Log Out',
                
                // My Space specific
                'search_insights': 'Search insights…',
                'edit': 'Edit',
                'last_added': 'Last Added',
                'tags': 'Tags',
                'all_tags': 'All Tags',
                'project': 'Project',
                'area': 'Area',
                'resource': 'Resource',
                'archive': 'Archive',
                'latest': 'Latest',
                'oldest': 'Oldest',
                'alphabetical': 'Alphabetical',
                'new_stack': 'New Stack',
                'new_stack_description': 'A new stack for organizing content',
                'stack': 'STACK',
                'items': 'items',
                'insights': 'insights',
                'no_insights_yet': 'No insights yet',
                'stack_is_empty': 'This stack is empty. Add some insights to get started!',
                'add_insight': 'Add Insight',
                'back_to_my_space': 'Back to My Space',
                'no_content_collected': 'No content collected yet',
                'start_adding_content': 'Start adding your favorite media content to your collection',
                'add_content': 'Add Content',
                'created': 'Created',
                'modified': 'Modified',
                
                // Modal translations
                'add_new_content': 'Add New Content',
                'content_url': 'Content URL',
                'custom_title_optional': 'Custom Title (Optional)',
                'enter_custom_title_placeholder': 'Enter custom title or leave empty to use webpage title',
                'your_thoughts_optional': 'Your Thoughts (Optional)',
                'share_thoughts_placeholder': 'Share your thoughts, insights, or notes about this content',
                'tag_optional': 'Tag (Optional)',
                'select_tag_placeholder': 'Select a tag...',
                'cancel': 'Cancel',
                'add_content': 'Add Content',
                'add': 'Add',
                'welcome': 'Welcome',
                'welcome_user': 'Welcome, {username}!',
                
                // Footer
                'footer_description': 'Your personal knowledge hub for discovering and organizing what matters.',
                'quick_links': 'Quick Links',
                'home': 'Home',
                'extension': 'Extension',
                'features': 'Features',
                'beta': 'Beta',
                'contact': 'Contact',
                'get_in_touch': 'Get in Touch',
                'privacy': 'Privacy',
                'terms': 'Terms',
                'all_rights_reserved': 'All rights reserved.',
                
                // Index page
                'hero_title': 'All Your Knowledge, One Private Space',
                'hero_subtitle': '— Your Second Brain with Quest —',
                'hero_description': 'Quest Private Space helps you capture fragmented notes, files, ideas, and turns them into modular, structured, and retrievable knowledge.',
                'signup_cta': 'Sign up — It\'s Free!',
                'extension_title': 'Save Anything, Anywhere — With One Click.',
                'extension_description': 'Quest\'s browser extension makes remembering effortless. Whether it\'s a lecture video, research article, or random inspiration, capture it instantly into your private space. No more scattered notes — just a unified, searchable context layer built for you.',
                'add_to_chrome': 'Add to Chrome',
                'key_features': 'Key Features',
                'features_subtitle': 'Your knowledge journey from capture to insights',
                'log_in': 'Log In',
                'sign_up': 'Sign Up',
                
                // Feature pipeline
                'capture': 'Capture',
                'one_click_save': 'One-Click Save',
                'capture_description': 'Save anything instantly — web pages, notes, or media — into your vault with just one click. No friction, no clutter.',
                'organize': 'Organize',
                'para_structured': 'PARA Structured Space',
                'organize_description': 'Your content is automatically organized into the PARA framework (Projects, Areas, Resources, Archives), giving you clarity from day one.',
                'manage': 'Manage',
                'build_your_space': 'Build Your Space',
                'manage_description': 'Easily create custom stacks, delete items, or classify articles — full control to keep your second brain tidy and personal.',
                'summarize': 'Summarize',
                'ai_insights': 'AI-Powered Insights',
                'summarize_description': 'Each stack comes with an AI-generated summary, helping you distill key takeaways without rereading everything.',
                'reflect': 'Reflect',
                'weekly_insights': 'Weekly Insights',
                'reflect_description': 'Get a personalized email digest of your saved content plus curated content cards — keeping you in sync with your own knowledge growth.',
                'retrieve': 'Retrieve',
                'chat_discover': 'Chat & Discover',
                'retrieve_description': 'Find anything fast and (optionally) chat with it — a natural bridge to your Knowledge Bot beta.',
                
                // Beta section
                'beta_features': 'Beta Features',
                'beta_description': 'Talk directly to your AI chatbot trained on your saved content. Retrieve notes, recall articles, and spark insights — all in conversation.',
                'try_beta': 'Try the Beta',
                
                // Contact section
                'talk_to_team': 'Talk to Our Team',
                'contact_description': 'Have questions about Quest? We\'d love to hear from you.',
                'send_email': '📧 Send Email',
                
                // Navigation (for dynamic content)
                'home': 'HOME',
                'extension': 'EXTENSION',
                'features': 'FEATURES',
                'beta': 'BETA',
                'contact': 'CONTACT',
                'go_to_my_space': 'Go to My Space',
                
                // Pagination
                'previous': 'Previous',
                'next': 'Next',
                'page': 'Page',
                'of': 'of',
                'insights_total': 'insights total',
                'cards': 'cards',
                'insights': 'insights',
                'stack': 'stack',
                'stacks': 'stacks',
                
                // Login page
                'welcome_back': 'Welcome Back!',
                'login_subtitle': 'Log in to your Quest space',
                'email_label': 'Email/Account Number',
                'email_placeholder': 'Registered Email / Account Number',
                'password_label': 'Password',
                'password_placeholder': 'Password',
                'forgot_password': 'Forgot Password?',
                'no_account': 'Don\'t have an account?',
                'reset_password': 'Reset Password',
                'reset_email_placeholder': 'Enter your email address',
                'send_reset_link': 'Send Reset Link',
                
                // Signup page
                'create_account': 'Create Your Account',
                'signup_subtitle': 'Join Quest and start your knowledge journey',
                'email_address': 'Email Address',
                'nickname': 'Nickname',
                'nickname_placeholder': 'Choose a nickname (2-20 characters)',
                'password_requirements': 'Password Requirements:',
                'password_req_1': 'At least 8 characters long',
                'password_req_2': 'Must contain both letters and numbers',
                'password_req_3': 'Special characters are recommended for better security',
                'confirm_password': 'Confirm Password',
                'confirm_password_placeholder': 'Re-enter your password',
                'agree_terms': 'I agree to the Terms of Service and Privacy Policy',
                'terms_of_service': 'Terms of Service',
                'privacy_policy': 'Privacy Policy',
                'create_account_btn': 'Create Account',
                'already_have_account': 'Already have an account?',
                'login_now': 'Login Now',
                
                // Privacy and Terms pages
                'last_updated': 'Last updated: December 2024',
                'privacy_intro': '1. Introduction',
                'privacy_intro_text': 'Welcome to Quest ("we," "our," or "us"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our web application and related services.',
                'privacy_info_collect': '2. Information We Collect',
                'privacy_personal_info': '2.1 Personal Information',
                'privacy_personal_info_text': 'We may collect the following personal information:',
                'terms_acceptance': '1. Acceptance of Terms',
                'terms_acceptance_text': 'By accessing and using Quest ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.',
                'back_to_previous': '← Back to Previous Page',
                
                // Email Preferences
                'manage_weekly_digest': 'Manage your weekly digest and delivery settings',
                'weekly_digest': 'Weekly Digest',
                'enable_weekly_digest': 'Enable weekly digest emails',
                'receive_weekly_summary': 'Receive a weekly summary of your insights and activity',
                'delivery_schedule': 'Delivery Schedule',
                'preferred_day': 'Preferred Day',
                'preferred_hour': 'Preferred Hour',
                'timezone': 'Timezone',
                'your_timezone': 'Your Timezone',
                'timezone_help': 'We\'ll send your digest at your preferred time in this timezone',
                'no_activity_policy': 'No Activity Policy',
                'no_activity_label': 'When you have no activity this week',
                'skip_sending': 'Skip sending (don\'t send email)',
                'brief_email': 'Send brief email with suggestions',
                'missed_content': 'Send email with "what you missed" content',
                'no_activity_help': 'Choose how to handle weeks when you haven\'t added any insights',
                'save_preferences': 'Save Preferences',
                'preview_digest': 'Preview Digest',
                'send_test_email': 'Send Test Email',
                'about_digest': 'About Your Digest',
                'weekly_summary': 'Weekly Summary: Get a curated overview of your insights from the past week',
                'personalized_content': 'Personalized Content: Highlights are chosen based on your engagement and recency',
                'stack_updates': 'Stack Updates: See what\'s new in your knowledge stacks',
                'smart_suggestions': 'Smart Suggestions: Get recommendations to improve your knowledge management',
                'privacy_first': 'Privacy First: Your data stays private and secure',
                'unsubscribe': 'Unsubscribe',
                'unsubscribe_help': 'You can unsubscribe at any time by:',
                'unsubscribe_link': 'Using the unsubscribe link in any digest email',
                'disable_option': 'Disabling the weekly digest option above',
                'contact_support': 'Contacting support at support@quest.example.com',
                
                // Days
                'sunday': 'Sunday',
                'monday': 'Monday',
                'tuesday': 'Tuesday',
                'wednesday': 'Wednesday',
                'thursday': 'Thursday',
                'friday': 'Friday',
                'saturday': 'Saturday',
                
                // Time zones
                'pacific_time': 'Pacific Time (Los Angeles)',
                'mountain_time': 'Mountain Time (Denver)',
                'central_time': 'Central Time (Chicago)',
                'eastern_time': 'Eastern Time (New York)',
                'london_gmt': 'London (GMT)',
                'paris_cet': 'Paris (CET)',
                'tokyo_jst': 'Tokyo (JST)',
                'shanghai_cst': 'Shanghai (CST)',
                'sydney_aest': 'Sydney (AEST)',
                'utc': 'UTC'
            },
            zh: {
                // Navigation
                'demo_chat': '演示聊天',
                'language': '中文',
                'my_space': '我的空间',
                'email_preferences': '邮件偏好设置',
                'edit_profile': '编辑资料',
                'log_out': '退出登录',
                
                // My Space specific
                'search_insights': '搜索见解…',
                'edit': '编辑',
                'last_added': '最近添加',
                'tags': '标签',
                'all_tags': '所有标签',
                'project': '项目',
                'area': '领域',
                'resource': '资源',
                'archive': '归档',
                'latest': '最新',
                'oldest': '最旧',
                'alphabetical': '字母顺序',
                'new_stack': '新堆栈',
                'new_stack_description': '用于组织内容的新堆栈',
                'stack': '堆栈',
                'items': '项',
                'insights': '见解',
                'no_insights_yet': '暂无见解',
                'stack_is_empty': '这个堆栈是空的。添加一些见解开始吧！',
                'add_insight': '添加见解',
                'back_to_my_space': '返回我的空间',
                'no_content_collected': '尚未收集任何内容',
                'start_adding_content': '开始添加您喜欢的媒体内容到您的收藏中',
                'add_content': '添加内容',
                'created': '创建于',
                'modified': '修改于',
                
                // Modal translations
                'add_new_content': '添加新内容',
                'content_url': '内容链接',
                'custom_title_optional': '自定义标题（可选）',
                'enter_custom_title_placeholder': '输入自定义标题或留空使用网页标题',
                'your_thoughts_optional': '您的想法（可选）',
                'share_thoughts_placeholder': '分享您对此内容的想法、见解或笔记',
                'tag_optional': '标签（可选）',
                'select_tag_placeholder': '选择标签...',
                'cancel': '取消',
                'add_content': '添加内容',
                'add': '添加',
                'welcome': '欢迎',
                'welcome_user': '欢迎，{username}！',
                
                // Footer
                'footer_description': '您的个人知识中心，用于发现和组织重要内容。',
                'quick_links': '快速链接',
                'home': '首页',
                'extension': '扩展',
                'features': '功能',
                'beta': '测试版',
                'contact': '联系',
                'get_in_touch': '联系我们',
                'privacy': '隐私',
                'terms': '条款',
                'all_rights_reserved': '版权所有。',
                
                // Index page
                'hero_title': '所有知识，一个私人空间',
                'hero_subtitle': '— 您的第二大脑，Quest —',
                'hero_description': 'Quest 私人空间帮助您捕获零散的笔记、文件和想法，并将它们转化为模块化、结构化且可检索的知识。',
                'signup_cta': '立即注册 — 免费！',
                'extension_title': '一键保存任何内容，任何地方。',
                'extension_description': 'Quest 浏览器扩展让记忆变得毫不费力。无论是讲座视频、研究文章还是随机灵感，都能立即捕获到您的私人空间。不再有零散的笔记——只有为您构建的统一、可搜索的上下文层。',
                'add_to_chrome': '添加到 Chrome',
                'key_features': '核心功能',
                'features_subtitle': '从捕获到洞察的知识之旅',
                'log_in': '登录',
                'sign_up': '注册',
                
                // Feature pipeline
                'capture': '捕获',
                'one_click_save': '一键保存',
                'capture_description': '一键保存任何内容——网页、笔记或媒体——到您的保险库。无摩擦，无混乱。',
                'organize': '整理',
                'para_structured': 'PARA结构化空间',
                'organize_description': '您的内容会自动组织到PARA框架（项目、领域、资源、归档）中，从一开始就给您清晰的结构。',
                'manage': '管理',
                'build_your_space': '构建您的空间',
                'manage_description': '轻松创建自定义堆栈、删除项目或分类文章——完全控制保持您的第二大脑整洁和个人化。',
                'summarize': '总结',
                'ai_insights': 'AI驱动的洞察',
                'summarize_description': '每个堆栈都配有AI生成的摘要，帮助您提炼关键要点而无需重新阅读所有内容。',
                'reflect': '反思',
                'weekly_insights': '每周洞察',
                'reflect_description': '获取您保存内容的个性化邮件摘要以及精选内容卡片——与您自己的知识增长保持同步。',
                'retrieve': '检索',
                'chat_discover': '聊天与发现',
                'retrieve_description': '快速找到任何内容并可选择与其聊天——这是通往您知识机器人测试版的自然桥梁。',
                
                // Beta section
                'beta_features': '测试版功能',
                'beta_description': '直接与基于您保存内容训练的AI聊天机器人对话。检索笔记、回忆文章、激发洞察——全部通过对话完成。',
                'try_beta': '尝试测试版',
                
                // Contact section
                'talk_to_team': '与我们的团队交流',
                'contact_description': '对Quest有疑问？我们很乐意听取您的意见。',
                'send_email': '📧 发送邮件',
                
                // Navigation (for dynamic content)
                'home': '首页',
                'extension': '扩展',
                'features': '功能',
                'beta': '测试版',
                'contact': '联系',
                'go_to_my_space': '前往我的空间',
                
                // Pagination
                'previous': '上一页',
                'next': '下一页',
                'page': '第',
                'of': '页，共',
                'insights_total': '个见解',
                'cards': '张卡片',
                'insights': '个见解',
                'stack': '个堆栈',
                'stacks': '个堆栈',
                
                // Login page
                'welcome_back': '欢迎回来！',
                'login_subtitle': '登录到您的 Quest 空间',
                'email_label': '邮箱/账号',
                'email_placeholder': '注册邮箱 / 账号',
                'password_label': '密码',
                'password_placeholder': '密码',
                'forgot_password': '忘记密码？',
                'no_account': '没有账号？',
                'reset_password': '重置密码',
                'reset_email_placeholder': '输入您的邮箱地址',
                'send_reset_link': '发送重置链接',
                
                // Signup page
                'create_account': '创建您的账号',
                'signup_subtitle': '加入 Quest，开始您的知识之旅',
                'email_address': '邮箱地址',
                'nickname': '昵称',
                'nickname_placeholder': '选择一个昵称（2-20个字符）',
                'password_requirements': '密码要求：',
                'password_req_1': '至少8个字符',
                'password_req_2': '必须包含字母和数字',
                'password_req_3': '建议使用特殊字符以提高安全性',
                'confirm_password': '确认密码',
                'confirm_password_placeholder': '重新输入您的密码',
                'agree_terms': '我同意服务条款和隐私政策',
                'terms_of_service': '服务条款',
                'privacy_policy': '隐私政策',
                'create_account_btn': '创建账号',
                'already_have_account': '已有账号？',
                'login_now': '立即登录',
                
                // Privacy and Terms pages
                'last_updated': '最后更新：2024年12月',
                'privacy_intro': '1. 介绍',
                'privacy_intro_text': '欢迎使用 Quest（"我们"、"我们的"或"我们"）。本隐私政策解释了当您使用我们的网络应用程序和相关服务时，我们如何收集、使用、披露和保护您的信息。',
                'privacy_info_collect': '2. 我们收集的信息',
                'privacy_personal_info': '2.1 个人信息',
                'privacy_personal_info_text': '我们可能收集以下个人信息：',
                'terms_acceptance': '1. 条款接受',
                'terms_acceptance_text': '通过访问和使用 Quest（"服务"），您接受并同意受本协议条款和规定的约束。如果您不同意遵守上述条款，请不要使用此服务。',
                'back_to_previous': '← 返回上一页',
                
                // Email Preferences
                'manage_weekly_digest': '管理您的每周摘要和发送设置',
                'weekly_digest': '每周摘要',
                'enable_weekly_digest': '启用每周摘要邮件',
                'receive_weekly_summary': '接收您见解和活动的每周摘要',
                'delivery_schedule': '发送时间表',
                'preferred_day': '首选日期',
                'preferred_hour': '首选时间',
                'timezone': '时区',
                'your_timezone': '您的时区',
                'timezone_help': '我们将在您首选的时区时间发送摘要',
                'no_activity_policy': '无活动政策',
                'no_activity_label': '当您本周没有活动时',
                'skip_sending': '跳过发送（不发送邮件）',
                'brief_email': '发送包含建议的简短邮件',
                'missed_content': '发送包含"您错过的内容"的邮件',
                'no_activity_help': '选择如何处理您没有添加任何见解的周',
                'save_preferences': '保存设置',
                'preview_digest': '预览摘要',
                'send_test_email': '发送测试邮件',
                'about_digest': '关于您的摘要',
                'weekly_summary': '每周摘要：获取过去一周见解的精选概览',
                'personalized_content': '个性化内容：根据您的参与度和时效性选择亮点',
                'stack_updates': '堆栈更新：查看您知识堆栈中的新内容',
                'smart_suggestions': '智能建议：获取改善知识管理的建议',
                'privacy_first': '隐私优先：您的数据保持私密和安全',
                'unsubscribe': '取消订阅',
                'unsubscribe_help': '您可以随时通过以下方式取消订阅：',
                'unsubscribe_link': '使用任何摘要邮件中的取消订阅链接',
                'disable_option': '禁用上面的每周摘要选项',
                'contact_support': '联系支持 support@quest.example.com',
                
                // Days
                'sunday': '星期日',
                'monday': '星期一',
                'tuesday': '星期二',
                'wednesday': '星期三',
                'thursday': '星期四',
                'friday': '星期五',
                'saturday': '星期六',
                
                // Time zones
                'pacific_time': '太平洋时间（洛杉矶）',
                'mountain_time': '山地时间（丹佛）',
                'central_time': '中部时间（芝加哥）',
                'eastern_time': '东部时间（纽约）',
                'london_gmt': '伦敦（GMT）',
                'paris_cet': '巴黎（CET）',
                'tokyo_jst': '东京（JST）',
                'shanghai_cst': '上海（CST）',
                'sydney_aest': '悉尼（AEST）',
                'utc': 'UTC'
            }
        };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.applyTranslations();
        this.updateLanguageButton();
    }

    setupEventListeners() {
        // Translation toggle button
        const toggleBtn = document.getElementById('translationToggle');
        if (toggleBtn && !toggleBtn.hasAttribute('data-listener-attached')) {
            toggleBtn.addEventListener('click', () => this.toggleLanguage());
            toggleBtn.setAttribute('data-listener-attached', 'true');
        }
    }

    toggleLanguage() {
        this.currentLanguage = this.currentLanguage === 'en' ? 'zh' : 'en';
        localStorage.setItem('quest_language', this.currentLanguage);
        this.applyTranslations();
        this.updateLanguageButton();
    }

    applyTranslations() {
        // Find all elements with data-translate attribute
        const elements = document.querySelectorAll('[data-translate]');
        
        elements.forEach(element => {
            const key = element.getAttribute('data-translate');
            const translation = this.translations[this.currentLanguage][key];
            
            if (translation) {
                // Handle special case for welcome text with username
                if (key === 'welcome_user') {
                    const username = element.getAttribute('data-username') || 'User';
                    element.textContent = translation.replace('{username}', username);
                } else {
                    element.textContent = translation;
                }
            }
        });

        // Handle placeholder attributes
        const placeholderElements = document.querySelectorAll('[data-translate-placeholder]');
        placeholderElements.forEach(element => {
            const key = element.getAttribute('data-translate-placeholder');
            const translation = this.translations[this.currentLanguage][key];
            
            if (translation) {
                element.placeholder = translation;
            }
        });

        // Update page title based on current page
        const isEmailPrefs = window.location.pathname.includes('email-preferences');
        if (isEmailPrefs) {
            document.title = this.currentLanguage === 'zh' ? '邮件偏好设置 - Quest' : 'Email Preferences - Quest';
        } else {
            document.title = this.currentLanguage === 'zh' ? '我的空间 - Quest' : 'My Space - Quest';
        }
        
        // Update body class for CSS adjustments
        document.body.className = document.body.className.replace(/language-\w+/g, '');
        document.body.classList.add(`language-${this.currentLanguage}`);
        
        // Update dynamic content that uses translation system
        this.updateDynamicContent();
    }

    updateLanguageButton() {
        const toggleBtn = document.getElementById('translationToggle');
        if (toggleBtn) {
            const flag = toggleBtn.querySelector('.translation-flag');
            const text = toggleBtn.querySelector('.translation-text');
            
            if (this.currentLanguage === 'zh') {
                flag.textContent = '🇨🇳';
                text.textContent = '中文';
            } else {
                flag.textContent = '🌐';
                text.textContent = 'EN';
            }
        }
    }

    // Helper method to get translation for JavaScript-generated content
    t(key) {
        return this.translations[this.currentLanguage][key] || key;
    }
    
    // Update dynamic content that uses translation system
    updateDynamicContent() {
        // Update pagination info if it exists
        if (typeof updatePaginationUI === 'function') {
            updatePaginationUI();
        }
        
        // Update filter buttons if they exist and have translation attributes
        const filterButtons = document.querySelectorAll('.filter-label[data-translate]');
        filterButtons.forEach(button => {
            const key = button.getAttribute('data-translate');
            const translation = this.translations[this.currentLanguage][key];
            if (translation) {
                button.textContent = translation;
            }
        });
        
        // Update stack item counts
        const itemCountElements = document.querySelectorAll('.content-card-source-name, .stack-count');
        itemCountElements.forEach(element => {
            const text = element.textContent;
            if (text.includes(' items')) {
                const count = text.match(/(\d+)/)?.[1];
                if (count) {
                    const itemsText = this.translations[this.currentLanguage]['items'];
                    element.textContent = `${count} ${itemsText}`;
                }
            }
        });
        
        // Update stack names and descriptions
        const stackTitles = document.querySelectorAll('.content-card-title, .stack-name-horizontal, .stack-name, #stackBreadcrumbName');
        stackTitles.forEach(title => {
            const originalText = title.textContent;
            if (originalText === 'New Stack' || originalText === '新堆栈') {
                title.textContent = this.translations[this.currentLanguage]['new_stack'];
            }
        });
        
        const stackDescriptions = document.querySelectorAll('.stack-description .description-text');
        stackDescriptions.forEach(description => {
            const originalText = description.textContent;
            if (originalText === 'A new stack for organizing content' || originalText === '用于组织内容的新堆栈') {
                description.textContent = this.translations[this.currentLanguage]['new_stack_description'];
            }
        });
        
        // Update stack context bar insights count
        const stackCountElements = document.querySelectorAll('#stackCount');
        stackCountElements.forEach(element => {
            const text = element.textContent;
            if (text.includes(' insights') || text.includes(' 见解')) {
                const count = text.match(/(\d+)/)?.[1];
                if (count) {
                    const insightsText = this.translations[this.currentLanguage]['insights'];
                    element.textContent = `${count} ${insightsText}`;
                }
            }
        });
        
        // Update stack context bar dates
        const stackDatesElements = document.querySelectorAll('#stackDates');
        stackDatesElements.forEach(element => {
            let text = element.textContent;
            // Only update if the text doesn't match the current language
            const currentCreatedText = this.translations[this.currentLanguage]['created'];
            const currentModifiedText = this.translations[this.currentLanguage]['modified'];
            
            // Check if text needs updating - only if it contains text from the opposite language
            const hasEnglishText = text.includes('Created') || text.includes('Modified');
            const hasChineseText = text.includes('创建于') || text.includes('修改于');
            
            if ((this.currentLanguage === 'zh' && hasEnglishText) || 
                (this.currentLanguage === 'en' && hasChineseText)) {
                // Replace both English and Chinese versions with the current language
                text = text.replace(/Created/g, currentCreatedText)
                          .replace(/创建于/g, currentCreatedText)
                          .replace(/Modified/g, currentModifiedText)
                          .replace(/修改于/g, currentModifiedText);
                element.textContent = text;
            }
        });
        
        // Update empty stack state elements
        const emptyStackTitles = document.querySelectorAll('.empty-stack-state h3');
        emptyStackTitles.forEach(title => {
            const originalText = title.textContent;
            if (originalText === 'No insights yet' || originalText === '暂无见解') {
                title.textContent = this.translations[this.currentLanguage]['no_insights_yet'];
            }
        });
        
        const emptyStackDescriptions = document.querySelectorAll('.empty-stack-state p');
        emptyStackDescriptions.forEach(description => {
            const originalText = description.textContent;
            if (originalText === 'This stack is empty. Add some insights to get started!' || originalText === '这个堆栈是空的。添加一些见解开始吧！') {
                description.textContent = this.translations[this.currentLanguage]['stack_is_empty'];
            }
        });
        
        const addInsightButtons = document.querySelectorAll('#emptyStackAddInsightBtn');
        addInsightButtons.forEach(button => {
            const originalText = button.textContent.trim();
            if (originalText === 'Add Insight' || originalText === '添加见解') {
                button.innerHTML = button.innerHTML.replace(originalText, this.translations[this.currentLanguage]['add_insight']);
            }
        });
        
        const backToHomeButtons = document.querySelectorAll('#emptyStackBackToHomeBtn');
        backToHomeButtons.forEach(button => {
            const originalText = button.textContent.trim();
            if (originalText === 'Back to My Space' || originalText === '返回我的空间') {
                button.innerHTML = button.innerHTML.replace(originalText, this.translations[this.currentLanguage]['back_to_my_space']);
            }
        });
        
        // Update general empty state elements
        const emptyStateTitles = document.querySelectorAll('.empty-state h3');
        emptyStateTitles.forEach(title => {
            const originalText = title.textContent;
            if (originalText === 'No content collected yet' || originalText === '尚未收集任何内容') {
                title.textContent = this.translations[this.currentLanguage]['no_content_collected'];
            }
        });
        
        const emptyStateDescriptions = document.querySelectorAll('.empty-state p');
        emptyStateDescriptions.forEach(description => {
            const originalText = description.textContent;
            if (originalText === 'Start adding your favorite media content to your collection' || originalText === '开始添加您喜欢的媒体内容到您的收藏中') {
                description.textContent = this.translations[this.currentLanguage]['start_adding_content'];
            }
        });
        
        const addContentButtons = document.querySelectorAll('.add-content-btn');
        addContentButtons.forEach(button => {
            const originalText = button.textContent.trim();
            if (originalText === 'Add Content' || originalText === '添加内容') {
                button.textContent = this.translations[this.currentLanguage]['add_content'];
            }
        });
        
        // Update "Add" button in stack context bar
        const stackAddButtons = document.querySelectorAll('#stackAddBtn');
        stackAddButtons.forEach(button => {
            const originalText = button.textContent.trim();
            if (originalText === 'Add' || originalText === '添加') {
                button.textContent = this.translations[this.currentLanguage]['add'];
            }
        });
    }
}

// Initialize translation manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.translationManager = new TranslationManager();
});

// Export for use in other modules
export { TranslationManager };
