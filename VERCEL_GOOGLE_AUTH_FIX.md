# Vercel Google Auth 修复指南

## 问题描述
在Vercel部署后出现 `Error 400: redirect_uri_mismatch` 错误，但localhost可以正常使用。

## 问题原因
Google Cloud Console中的OAuth 2.0客户端ID没有配置正确的Vercel生产环境redirect URI。

## 解决步骤

### 1. 获取您的Vercel部署域名
```
https://quest-web-psi.vercel.app
```

### 2. 前往Google Cloud Console
1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 选择您的项目
3. 进入 "APIs & Services" > "Credentials"
4. 找到您的OAuth 2.0客户端ID

### 3. 添加Vercel Redirect URI
在"授权重定向URI"部分添加以下URI：

**必须添加的URI:**
```
https://quest-web-psi.vercel.app/api/v1/auth/google/callback
```

**完整的URI列表应该包含:**
```
# 本地开发
http://localhost:3001/api/v1/auth/google/callback

# Vercel生产环境
https://quest-web-psi.vercel.app/api/v1/auth/google/callback

# Chrome扩展 (如果需要)
https://jcjpicpelibofggpbbmajafjipppnojo.chromiumapp.org/
```

### 4. 设置Vercel环境变量
确保在Vercel项目设置中配置了以下环境变量：

```bash
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
NODE_ENV=production
```

### 5. 验证配置
保存Google Cloud Console的更改后，等待几分钟让配置生效，然后测试：

1. 访问: `https://quest-web-psi.vercel.app/login`
2. 点击"Continue with Google"按钮
3. 应该能够正常完成OAuth流程

## 代码已更新
我已经学习扩展的成功模式，更新了前端和后端代码：

### 后端修复：
- ✅ 添加了缺失的 `/auth/google/web` 路由
- ✅ 简化了OAuth流程，直接重定向到Google
- ✅ 确保正确的redirect URI配置

### 前端修复：
- ✅ 登录页面：改用后端OAuth端点 `/api/v1/auth/google/login`
- ✅ 注册页面：改用后端OAuth端点 `/api/v1/auth/google/login`
- ✅ 统一了扩展和网页版的OAuth流程逻辑

### 扩展vs网页版的关键区别：
- **扩展**: 使用 `chrome.identity.launchWebAuthFlow()` 
- **网页版**: 使用后端统一的OAuth端点
- **共同点**: 都通过后端进行安全的token交换

## 测试步骤
1. 部署更新的代码到Vercel
2. 在Google Cloud Console添加redirect URI
3. 测试Google登录功能

## 如果仍有问题
检查浏览器开发者工具的Network和Console选项卡，查看详细的错误信息。

## 联系支持
如果问题持续存在，请提供：
1. 具体的错误信息
2. 浏览器开发者工具的截图
3. 您的Vercel部署URL 