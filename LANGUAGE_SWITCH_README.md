# 🌐 Quest 语言切换功能

## 功能概述

Quest 网页端现在支持中英文双语切换功能，用户可以在英文和中文之间自由切换，获得更好的本地化体验。

## 🎯 功能特性

### 支持的语言
- **English (英文)** - 默认语言
- **中文 (Chinese)** - 完整的中文翻译

### 切换的内容
- 导航栏文本
- 英雄区域标题和按钮
- 扩展展示区域
- 特性介绍区域
- 行动号召区域
- 页脚信息

## 🚀 使用方法

### 1. 语言切换器位置
语言切换器位于网页右上角导航栏中，在登录/注册按钮的左侧。

### 2. 切换语言
- 点击 "English" 按钮切换到英文
- 点击 "中文" 按钮切换到中文
- 语言选择会自动保存到本地存储

### 3. 语言记忆
- 用户的语言选择会保存在浏览器本地存储中
- 下次访问网站时会自动应用上次选择的语言

## 📁 文件结构

```
src/client/
├── js/
│   └── i18n.js              # 国际化核心文件
├── pages/
│   └── AboutUs.html         # 主页面（已集成语言切换）
└── language_test.html       # 语言切换测试页面
```

## 🔧 技术实现

### 1. 翻译数据
所有翻译文本存储在 `i18n.js` 文件中的 `translations` 对象中：

```javascript
const translations = {
    en: {
        'nav.home': 'Home',
        'hero.title': 'Welcome to Quest',
        // ... 更多翻译
    },
    zh: {
        'nav.home': '首页',
        'hero.title': '欢迎来到 Quest',
        // ... 更多翻译
    }
};
```

### 2. 语言切换器
- 使用 CSS 样式化的按钮组件
- 响应式设计，适配移动端
- 支持悬停和激活状态

### 3. 动态内容更新
- 页面加载时自动应用保存的语言设置
- 点击语言切换器时实时更新页面内容
- 支持 HTML 标签和特殊格式（如高亮文本）

## 🎨 样式设计

### 语言切换器样式
```css
.language-switcher {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-right: 20px;
}

.lang-btn {
    padding: 6px 12px;
    border: 1px solid rgba(75, 38, 79, 0.3);
    background: rgba(255, 255, 255, 0.8);
    color: var(--quest-purple);
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
}

.lang-btn.active {
    background: var(--quest-purple);
    color: white;
    border-color: var(--quest-purple);
}
```

## 📱 响应式支持

### 桌面端
- 语言切换器显示在导航栏右侧
- 按钮大小适中，易于点击

### 移动端
- 语言切换器适配小屏幕
- 按钮尺寸适当缩小
- 保持良好的触摸体验

## 🧪 测试

### 测试页面
创建了 `language_test.html` 文件用于测试语言切换功能：

1. 打开测试页面
2. 点击语言切换按钮
3. 验证所有文本是否正确切换
4. 检查特殊格式（如高亮文本）是否正确显示

### 测试要点
- [ ] 语言切换器正确显示
- [ ] 点击切换按钮响应正常
- [ ] 所有文本内容正确翻译
- [ ] 高亮文本格式保持正确
- [ ] 语言选择正确保存
- [ ] 页面刷新后语言设置保持

## 🔄 扩展其他页面

要将语言切换功能添加到其他页面，需要：

1. **引入样式**：复制语言切换器的 CSS 样式
2. **添加切换器**：在导航栏中添加语言切换按钮
3. **应用翻译**：使用 `applyChineseTranslation()` 函数
4. **保存设置**：使用 `localStorage` 保存语言选择

### 示例代码
```javascript
// 初始化语言切换器
function initLanguageSwitcher() {
    // ... 切换器初始化代码
}

// 应用中文翻译
function applyChineseTranslation() {
    // ... 翻译应用代码
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    initLanguageSwitcher();
    
    const currentLanguage = localStorage.getItem('quest_language') || 'en';
    if (currentLanguage === 'zh') {
        applyChineseTranslation();
    }
});
```

## 🐛 故障排除

### 常见问题

1. **语言切换器不显示**
   - 检查导航栏容器是否存在
   - 确认 CSS 样式正确加载

2. **翻译不生效**
   - 检查翻译数据是否正确
   - 确认元素 ID 匹配

3. **语言设置不保存**
   - 检查浏览器本地存储是否可用
   - 确认 localStorage 权限

### 调试方法
- 打开浏览器开发者工具
- 查看控制台错误信息
- 检查 localStorage 中的语言设置
- 验证 DOM 元素是否正确更新

## 📈 未来改进

1. **更多语言支持**
   - 添加日语、韩语等更多语言
   - 支持语言包动态加载

2. **高级功能**
   - 自动检测用户浏览器语言
   - 支持语言偏好设置
   - 添加语言切换动画效果

3. **内容扩展**
   - 翻译更多页面内容
   - 支持动态内容翻译
   - 添加图片和媒体资源的本地化

## 📞 支持

如果在使用过程中遇到问题，请：

1. 检查浏览器控制台是否有错误信息
2. 确认网络连接正常
3. 尝试清除浏览器缓存
4. 联系技术支持团队

---

**版本**: 1.0  
**更新日期**: 2024年  
**兼容性**: Chrome, Firefox, Safari, Edge 