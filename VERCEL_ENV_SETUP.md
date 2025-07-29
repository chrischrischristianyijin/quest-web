# Vercel 环境变量设置指南

## 问题分析

在 Vercel 上，你的应用无法找到 Supabase 环境变量，这是因为：

1. **环境变量未在 Vercel 仪表板中设置**
2. **环境变量名称不匹配**
3. **部署时环境变量未正确加载**

## 解决方案

### 步骤 1: 在 Vercel 仪表板中设置环境变量

1. 登录 [Vercel 仪表板](https://vercel.com/dashboard)
2. 选择你的项目 `quest-web`
3. 进入 **Settings** → **Environment Variables**
4. 添加以下环境变量：

#### 必需的环境变量：

```bash
# Supabase 配置
SUPABASE_URL=https://wlpitstgjomynzfnqkye.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscGl0c3Rnam9teW56Zm5xa3llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxMzMyNzIsImV4cCI6MjA1OTcwOTI3Mn0.7HpEjNdnfOIeYn4nnooaAhDUqrA8q07nWtxFzVwzHck
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscGl0c3Rnam9teW56Zm5xa3llIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDEzMzI3MiwiZXhwIjoyMDU5NzA5MjcyfQ.dttyUPithJWr51dtpkJ6Ln5XnxZssHBI1tW-OCcbLKw

# Google OAuth 配置
GOOGLE_CLIENT_ID=103202343935-5dkesvf5dp06af09o0d2373ji2ccd0rc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URI=https://quest-jmzuj65mw-chris-jins-projects.vercel.app/api/v1/auth/google/callback
```

### 步骤 2: 设置环境变量

对于每个环境变量：

1. 点击 **Add New**
2. **Name**: 输入变量名（如 `SUPABASE_URL`）
3. **Value**: 输入变量值
4. **Environment**: 选择 **Production**（重要！）
5. 点击 **Save**

### 步骤 3: 验证环境变量

设置完成后，你可以通过以下方式验证：

1. **检查部署日志**：
   - 在 Vercel 仪表板中查看最新部署的日志
   - 查找 "All critical environment variables present" 消息

2. **测试 API 端点**：
   ```bash
   curl https://quest-jmzuj65mw-chris-jins-projects.vercel.app/api/v1/auth/debug/env
   ```

3. **检查健康状态**：
   ```bash
   curl https://quest-jmzuj65mw-chris-jins-projects.vercel.app/api/v1/health
   ```

### 步骤 4: 重新部署

设置环境变量后，需要重新部署应用：

1. 在 Vercel 仪表板中点击 **Deployments**
2. 找到最新部署，点击 **Redeploy**
3. 或者推送代码到 GitHub 触发自动部署

## 常见问题

### 问题 1: 环境变量仍然未找到

**解决方案**：
- 确保选择了正确的环境（Production）
- 检查变量名是否完全匹配
- 重新部署应用

### 问题 2: 部署后仍然报错

**解决方案**：
- 检查 Vercel 部署日志
- 确认环境变量在部署时可用
- 使用调试端点检查环境变量状态

### 问题 3: 本地工作但生产环境不工作

**解决方案**：
- 确保生产环境的环境变量已设置
- 检查 Vercel 函数超时设置
- 验证 Supabase 网络访问权限

## 调试工具

### 1. 环境变量检查端点

```bash
curl https://quest-jmzuj65mw-chris-jins-projects.vercel.app/api/v1/auth/debug/env
```

### 2. Supabase 连接测试

```bash
curl https://quest-jmzuj65mw-chris-jins-projects.vercel.app/api/v1/auth/debug/supabase-direct
```

### 3. 健康检查

```bash
curl https://quest-jmzuj65mw-chris-jins-projects.vercel.app/api/v1/health
```

## 重要提醒

1. **环境变量名称必须完全匹配**：`SUPABASE_SERVICE_ROLE_KEY` 不是 `SUPABASE_SERVICE_KEY`
2. **选择正确的环境**：确保选择 Production 环境
3. **重新部署**：设置环境变量后必须重新部署
4. **检查日志**：部署后检查 Vercel 日志确认环境变量加载成功

## 验证清单

- [ ] 在 Vercel 仪表板中设置了所有必需的环境变量
- [ ] 选择了 Production 环境
- [ ] 重新部署了应用
- [ ] 检查了部署日志
- [ ] 测试了 API 端点
- [ ] 验证了 Supabase 连接

完成这些步骤后，你的应用应该能在 Vercel 上正常工作。 