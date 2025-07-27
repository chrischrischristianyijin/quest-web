# 🔍 Vercel 部署问题排查清单

## 当前状态：404 NOT_FOUND 错误

### 第一步：检查基本配置

#### 1. 确认项目结构
```
quest-web/
├── src/
│   ├── server/
│   │   └── index.js          ✅ 主服务器文件
│   └── client/
│       └── pages/
│           ├── AboutUs.html  ✅ 首页文件
│           ├── test.html     ✅ 测试页面
│           └── simple-test.html ✅ 简单测试页面
├── vercel.json               ✅ Vercel 配置
└── package.json              ✅ 项目配置
```

#### 2. 检查 vercel.json 配置
当前配置：
```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/server/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/server/index.js"
    }
  ]
}
```

### 第二步：环境变量检查

在 Vercel 控制台中设置以下环境变量：

#### 必需变量：
- [ ] `SUPABASE_URL` = `https://wlpitstgjomynzfnqkye.supabase.co`
- [ ] `SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscGl0c3Rnam9teW56Zm5xa3llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxMzMyNzIsImV4cCI6MjA1OTcwOTI3Mn0.7HpEjNdnfOIeYn4nnooaAhDUqrA8q07nWtxFzVwzHck`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscGl0c3Rnam9teW56Zm5xa3llIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDEzMzI3MiwiZXhwIjoyMDU5NzA5MjcyfQ.dttyUPithJWr51dtpkJ6Ln5XnxZssHBI1tW-OCcbLKw`
- [ ] `JWT_SECRET` = `your-secret-key-here`
- [ ] `NODE_ENV` = `production`

### 第三步：重新部署

#### 方法一：推送代码到 GitHub
```bash
git add .
git commit -m "Fix 404 error - simplify Vercel config"
git push origin main
```

#### 方法二：使用 Vercel CLI
```bash
vercel --prod
```

### 第四步：测试页面

部署完成后，依次测试以下页面：

1. **简单测试页面**：
   ```
   https://your-project-name.vercel.app/simple
   ```

2. **主测试页面**：
   ```
   https://your-project-name.vercel.app/test
   ```

3. **首页**：
   ```
   https://your-project-name.vercel.app/
   ```

4. **关于页面**：
   ```
   https://your-project-name.vercel.app/about
   ```

### 第五步：查看部署日志

在 Vercel 控制台中：
1. 进入项目
2. 点击 "Deployments"
3. 选择最新的部署
4. 查看 "Functions" 日志

### 第六步：常见问题解决

#### 如果仍然出现 404：

1. **检查构建日志**：
   - 查看是否有构建错误
   - 确认 `src/server/index.js` 被正确识别

2. **检查函数日志**：
   - 查看服务器是否正常启动
   - 检查是否有运行时错误

3. **测试 API 端点**：
   ```
   https://your-project-name.vercel.app/api/v1/auth/current-user
   ```

#### 如果页面加载但显示错误：

1. **检查环境变量**：
   - 确认所有变量都已设置
   - 检查变量值是否正确

2. **检查 Supabase 连接**：
   - 确认 Supabase 项目状态
   - 检查网络连接

### 第七步：备用方案

如果问题持续存在，可以尝试：

1. **使用更简单的配置**：
   - 创建一个最小化的测试版本
   - 逐步添加功能

2. **检查 Vercel 项目设置**：
   - 确认项目类型为 "Node.js"
   - 检查构建命令和输出目录

3. **联系 Vercel 支持**：
   - 提供详细的错误日志
   - 说明项目结构和配置

### 成功标志

✅ 访问 `/simple` 显示成功页面
✅ 访问 `/test` 显示完整测试页面  
✅ 访问 `/` 显示首页
✅ API 端点返回正确响应
✅ 所有静态文件正常加载

## 🚨 紧急联系

如果按照以上步骤仍然无法解决问题，请：
1. 截图 Vercel 部署日志
2. 提供具体的错误信息
3. 说明已尝试的解决方案 