# Quest Extension - 简洁版本

## 🎯 功能特性

- **用户认证**: 登录/注册系统
- **洞察保存**: 保存网页洞察到Quest空间
- **会话管理**: 自动记住登录状态
- **简洁界面**: 现代化UI设计

## 📁 文件结构

```
src/extension/
├── manifest.json      # 扩展配置文件
├── popup.html         # 弹出窗口界面
├── popup.js           # 弹出窗口逻辑
├── background.js      # 后台服务
└── icons/             # 图标文件
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 🚀 安装使用

### 1. 启动后端服务
```bash
cd src/server
npm start
```

### 2. 加载扩展
1. 打开 `chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `src/extension` 文件夹

### 3. 使用扩展
1. 点击扩展图标
2. 注册或登录账户
3. 输入洞察内容
4. 点击"保存洞察"

## 🔧 技术栈

- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **后端**: Node.js, Express
- **数据库**: Supabase
- **认证**: 自定义JWT系统

## 🌐 API端点

- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/login` - 用户登录
- `POST /api/v1/insights` - 保存洞察

## 💡 开发说明

- 扩展使用网站认证系统，与网站保持一致
- 会话信息存储在Chrome本地存储中
- 支持自动获取当前页面URL
- 响应式设计，适配不同屏幕尺寸 