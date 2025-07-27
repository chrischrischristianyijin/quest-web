# 🚀 Vercel 部署验证指南

## 部署完成后，请按以下步骤验证：

### 1. 访问测试页面
访问你的域名 + `/test`，例如：
```
https://your-project-name.vercel.app/test
```

这个页面会显示：
- ✅ 部署状态
- 📋 项目信息
- 🔗 快速链接
- 🧪 API 测试功能

### 2. 测试主要页面
访问以下页面确保它们正常工作：

- **首页**: `https://your-project-name.vercel.app/`
- **关于我们**: `https://your-project-name.vercel.app/about`
- **登录页面**: `https://your-project-name.vercel.app/login`
- **注册页面**: `https://your-project-name.vercel.app/signup`

### 3. 测试 API 端点
使用测试页面上的"测试 API"按钮，或直接访问：
```
https://your-project-name.vercel.app/api/v1/auth/current-user
```

### 4. 检查环境变量
确保在 Vercel 控制台中设置了以下环境变量：

#### 必需的环境变量：
- `SUPABASE_URL` = `https://wlpitstgjomynzfnqkye.supabase.co`
- `SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscGl0c3Rnam9teW56Zm5xa3llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxMzMyNzIsImV4cCI6MjA1OTcwOTI3Mn0.7HpEjNdnfOIeYn4nnooaAhDUqrA8q07nWtxFzVwzHck`
- `SUPABASE_SERVICE_ROLE_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscGl0c3Rnam9teW56Zm5xa3llIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDEzMzI3MiwiZXhwIjoyMDU5NzA5MjcyfQ.dttyUPithJWr51dtpkJ6Ln5XnxZssHBI1tW-OCcbLKw`
- `JWT_SECRET` = `your-secret-key-here`
- `NODE_ENV` = `production`

### 5. 常见问题排查

#### 如果页面显示 404：
1. 检查 `vercel.json` 配置是否正确
2. 确认环境变量已设置
3. 查看 Vercel 部署日志

#### 如果 API 返回错误：
1. 检查 Supabase 配置
2. 确认环境变量正确设置
3. 检查 Supabase 项目状态

#### 如果静态文件无法加载：
1. 检查文件路径是否正确
2. 确认 `vercel.json` 中的路由配置

### 6. 重新部署
如果需要重新部署，可以：

#### 方法一：推送代码到 GitHub
```bash
git add .
git commit -m "Fix deployment issues"
git push origin main
```

#### 方法二：使用 Vercel CLI
```bash
vercel --prod
```

### 7. 查看部署日志
在 Vercel 控制台中：
1. 进入项目
2. 点击 "Deployments"
3. 选择最新的部署
4. 查看 "Functions" 和 "Build" 日志

### 8. 成功标志
✅ 所有页面都能正常访问
✅ API 端点返回正确响应
✅ 静态文件（CSS、JS、图片）正常加载
✅ 数据库连接正常
✅ 用户认证功能正常

## 🎉 恭喜！
如果以上所有测试都通过，说明你的 Quest 应用已经成功部署到 Vercel！ 