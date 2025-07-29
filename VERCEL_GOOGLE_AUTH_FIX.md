# Vercel Google Auth 修复指南

## 问题描述
在Vercel部署后出现 `Error 400: redirect_uri_mismatch` 错误，但localhost可以正常使用。

## 问题原因
Google Cloud Console中的OAuth 2.0客户端ID没有配置正确的Vercel生产环境redirect URI。

## 解决步骤

### 1. 获取您的生产域名
```
https://myquestspace.com
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
https://myquestspace.com/api/v1/auth/google/callback
```

**完整的URI列表应该包含:**
```
# 本地开发
http://localhost:3001/api/v1/auth/google/callback

# 生产环境  
https://myquestspace.com/api/v1/auth/google/callback

# Chrome扩展 (如果需要)
https://jcjpicpelibofggpbbmajafjipppnojo.chromiumapp.org/
```

## 🚨 常见陷阱与解决方案

### ❌ 错误示例 vs ✅ 正确示例

| 陷阱类型 | ❌ 错误 | ✅ 正确 | 说明 |
|---------|--------|--------|------|
| **忘记HTTPS** | `myquestspace.com/api/v1/auth/google/callback` | `https://myquestspace.com/api/v1/auth/google/callback` | 生产环境必须使用HTTPS |
| **localhost混用** | 只配置 `http://localhost:3000/...` | 同时配置localhost和生产环境URI | 开发和生产需要分别配置 |
| **路径不一致** | 前端用`/callback`，Google配置`/auth/callback` | 确保前后端路径完全一致 | 路径必须精确匹配 |
| **环境混乱** | 只配置dev环境就测试prod | 每个环境分别配置对应的URI | 不同环境需要不同URI |

### 🔍 验证清单

在保存Google配置前，请确认：

- [ ] ✅ URI以`https://`开头（生产环境）
- [ ] ✅ 域名拼写正确：`myquestspace.com`
- [ ] ✅ 路径完整：`/api/v1/auth/google/callback`
- [ ] ✅ 没有多余的斜杠或空格
- [ ] ✅ 同时配置了localhost（开发）和myquestspace.com（生产）

### 🛠️ 如果仍然出错

1. **检查URI格式**：复制粘贴完整URL，避免手打
2. **等待生效**：Google配置更改需要几分钟生效
3. **清除缓存**：浏览器可能缓存了旧的OAuth响应
4. **检查环境变量**：确保生产环境有正确的`GOOGLE_CLIENT_SECRET`

### 4. 设置Vercel环境变量
确保在Vercel项目设置中配置了以下环境变量：

```bash
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
WEB_REDIRECT_URI=https://myquestspace.com/api/v1/auth/google/callback
NODE_ENV=production
```

**推荐设置 `WEB_REDIRECT_URI` 环境变量的优势：**
- ✅ 更灵活的域名配置
- ✅ 不需要修改代码就能切换域名
- ✅ 支持多环境部署
- ✅ 安全地隔离配置信息

### 5. 验证配置
保存Google Cloud Console的更改后，等待几分钟让配置生效，然后测试：

1. 访问: `https://myquestspace.com/login`
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

## 🧪 测试步骤

### 步骤1: 设置Vercel环境变量
1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择您的 `quest-web` 项目
3. 进入 "Settings" → "Environment Variables"
4. 添加以下环境变量：

| Name | Value | Environment |
|------|-------|-------------|
| `GOOGLE_CLIENT_SECRET` | your_google_client_secret | Production |
| `WEB_REDIRECT_URI` | `https://myquestspace.com/api/v1/auth/google/callback` | Production |
| `NODE_ENV` | `production` | Production |

5. 点击 "Save" 保存所有环境变量

### 步骤2: 部署代码到Vercel
```bash
git add .
git commit -m "fix: 支持WEB_REDIRECT_URI环境变量配置"
git push origin main
```

### 步骤3: 验证生产部署
1. 访问：`https://myquestspace.com`
2. 确保网站正常加载
3. 检查部署日志没有错误

### 步骤4: 配置Google Cloud Console
1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 选择您的项目 → APIs & Services → Credentials
3. 找到OAuth 2.0客户端ID，点击编辑
4. 在"授权重定向URI"中添加：
   ```
   https://myquestspace.com/api/v1/auth/google/callback
   ```
5. 点击"保存"并等待2-3分钟生效

### 步骤5: 测试Google登录
1. 打开 `https://myquestspace.com/login`
2. 点击"Continue with Google"按钮
3. 应该正常跳转到Google授权页面
4. 授权后应该成功返回并登录

### 步骤6: 验证注册页面
1. 访问 `https://myquestspace.com/signup`
2. 测试"Continue with Google"按钮
3. 确保流程一致

## 如果仍有问题
检查浏览器开发者工具的Network和Console选项卡，查看详细的错误信息。

## 联系支持
如果问题持续存在，请提供：
1. 具体的错误信息
2. 浏览器开发者工具的截图
3. 您的生产部署URL 