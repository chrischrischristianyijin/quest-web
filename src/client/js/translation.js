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
                'stack': 'STACK',
                'items': 'items',
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
                'stack': '堆栈',
                'items': '项',
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
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleLanguage());
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
}

// Initialize translation manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.translationManager = new TranslationManager();
});

// Export for use in other modules
export { TranslationManager };
