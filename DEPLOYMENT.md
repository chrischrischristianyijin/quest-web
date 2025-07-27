# Vercel 部署指南

## 准备工作

1. **安装 Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **登录 Vercel**
   ```bash
   vercel login
   ```

## 环境变量配置

在 Vercel 控制台中设置以下环境变量：

### Supabase 配置
- `SUPABASE_URL` - 你的 Supabase 项目 URL
- `SUPABASE_ANON_KEY` - 你的 Supabase 匿名密钥
- `SUPABASE_SERVICE_ROLE_KEY` - 你的 Supabase 服务角色密钥

### JWT 配置
- `JWT_SECRET` - JWT 签名密钥

### 其他配置
- `NODE_ENV` - 设置为 `production`

## 部署步骤

### 方法一：使用 Vercel CLI

1. **在项目根目录运行**
   ```bash
   vercel
   ```

2. **按照提示操作**
   - 选择项目名称
   - 确认部署设置
   - 等待部署完成

3. **设置环境变量**
   ```bash
   vercel env add SUPABASE_URL
   vercel env add SUPABASE_ANON_KEY
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   vercel env add JWT_SECRET
   ```

### 方法二：通过 GitHub 集成

1. **推送代码到 GitHub**
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push origin main
   ```

2. **在 Vercel 控制台**
   - 创建新项目
   - 连接 GitHub 仓库
   - 配置环境变量
   - 部署

## 项目结构说明

- `vercel.json` - Vercel 配置文件
- `src/server/index.js` - 主服务器文件
- `src/client/` - 前端静态文件
- `src/public/` - 公共资源文件

## 注意事项

1. **静态文件服务**：Vercel 会自动处理静态文件，通过 `vercel.json` 中的路由配置

2. **API 路由**：所有 `/api/*` 请求会被路由到 `src/server/index.js`

3. **环境变量**：确保所有必要的环境变量都在 Vercel 控制台中正确设置

4. **数据库连接**：确保 Supabase 项目配置正确，并且网络访问权限设置正确

## 故障排除

### 常见问题

1. **环境变量未设置**
   - 检查 Vercel 控制台中的环境变量配置

2. **静态文件无法访问**
   - 检查 `vercel.json` 中的路由配置

3. **API 请求失败**
   - 检查 Supabase 配置和网络连接

4. **CORS 错误**
   - 确保 Supabase 项目设置中允许你的 Vercel 域名

### 调试

1. **查看部署日志**
   ```bash
   vercel logs
   ```

2. **本地测试**
   ```bash
   vercel dev
   ```

## 更新部署

每次推送代码到 GitHub 时，Vercel 会自动重新部署。也可以手动触发：

```bash
vercel --prod
``` 