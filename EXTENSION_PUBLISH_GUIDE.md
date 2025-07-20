# 🚀 Quest 扩展发布指南

## 📋 发布方案选择

### 方案一：Chrome Web Store（推荐）
- ✅ 任何人都可以轻松安装
- ✅ 自动更新
- ✅ 专业可信
- ❌ 需要开发者账号（$5 一次性费用）

### 方案二：GitHub Releases
- ✅ 免费
- ✅ 开源友好
- ❌ 需要手动安装
- ❌ 更新需要重新下载

### 方案三：直接分享代码
- ✅ 完全免费
- ❌ 需要技术知识
- ❌ 安装复杂

## 🎯 推荐方案：Chrome Web Store

### 第一步：准备扩展文件

1. **创建生产版本**
   ```bash
   # 运行配置脚本设置你的域名
   node configure-extension.js YOUR-VERCEL-DOMAIN
   ```

2. **打包扩展**
   ```bash
   # 创建 zip 文件
   cd src/extension
   zip -r quest-extension.zip . -x "*.DS_Store"
   ```

### 第二步：注册 Chrome 开发者账号

1. 访问 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
2. 支付 $5 注册费
3. 填写开发者信息

### 第三步：上传扩展

1. 点击"添加新项目"
2. 上传 `quest-extension.zip`
3. 填写扩展信息：
   - 名称：Quest Insight Collector
   - 描述：Save insights from web pages to your Quest space
   - 图标：使用 `icons/icon128.png`
   - 截图：添加扩展界面截图

4. 设置权限说明
5. 提交审核

### 第四步：分享给用户

审核通过后，用户可以通过以下方式安装：
1. 访问 Chrome Web Store
2. 搜索"Quest Insight Collector"
3. 点击"添加至 Chrome"

## 🔧 替代方案：GitHub Releases

### 第一步：创建发布版本

1. **配置扩展**
   ```bash
   node configure-extension.js YOUR-VERCEL-DOMAIN
   ```

2. **创建发布包**
   ```bash
   # 创建发布文件夹
   mkdir quest-extension-release
   cp -r src/extension/* quest-extension-release/
   cp EXTENSION_INSTALL_GUIDE.md quest-extension-release/
   cd quest-extension-release
   zip -r quest-extension.zip .
   ```

3. **上传到 GitHub Releases**
   - 在 GitHub 仓库创建新的 Release
   - 上传 `quest-extension.zip`
   - 添加安装说明

### 第二步：用户安装指南

创建 `EXTENSION_INSTALL_GUIDE.md`：

```markdown
# Quest 扩展安装指南

## 快速安装

1. 下载 `quest-extension.zip`
2. 解压文件
3. 打开 Chrome，访问 `chrome://extensions/`
4. 开启"开发者模式"
5. 点击"加载已解压的扩展程序"
6. 选择解压后的文件夹
7. 完成！

## 使用说明

1. 点击扩展图标
2. 注册或登录账户
3. 在任意网页上保存洞察
```

## 🎨 自定义扩展

### 修改扩展信息

编辑 `src/extension/manifest.json`：
```json
{
  "name": "Quest Insight Collector",
  "version": "1.0",
  "description": "Save insights from web pages to your Quest space",
  "author": "Your Name",
  "homepage_url": "https://your-vercel-domain.vercel.app"
}
```

### 添加隐私政策

创建 `PRIVACY_POLICY.md`：
```markdown
# 隐私政策

## 数据收集
- 扩展只收集你主动保存的洞察内容
- 用户认证信息存储在本地
- 不收集浏览历史或其他个人信息

## 数据使用
- 洞察内容保存到你的 Quest 账户
- 数据仅用于提供核心功能
- 不会与第三方分享

## 数据安全
- 使用 HTTPS 加密传输
- 遵循行业标准安全实践
```

## 📱 用户使用指南

### 功能说明
- **保存洞察**：在任意网页上保存有用的信息
- **标签管理**：为洞察添加标签便于分类
- **账户同步**：所有数据同步到你的 Quest 空间

### 使用场景
- 学习笔记
- 工作灵感
- 阅读摘录
- 想法记录

## 🔄 更新流程

### 版本更新
1. 修改 `manifest.json` 中的版本号
2. 更新代码
3. 重新打包
4. 发布新版本

### 自动更新
- Chrome Web Store 会自动推送更新
- GitHub Releases 需要用户手动更新

## 💡 推广建议

### 分享方式
1. **社交媒体**：分享扩展链接
2. **技术社区**：在相关论坛分享
3. **个人网站**：添加扩展介绍页面
4. **朋友推荐**：直接分享给朋友

### 用户反馈
- 收集用户反馈改进功能
- 响应问题和建议
- 持续优化用户体验

## 🚨 注意事项

### 法律合规
- 确保符合 Chrome Web Store 政策
- 提供清晰的隐私政策
- 遵守数据保护法规

### 技术支持
- 提供安装和使用帮助
- 响应技术问题
- 维护扩展稳定性 