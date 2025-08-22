# 🚀 Vercel 部署指南

## 📋 **概述**
Quest Web应用现在使用Vercel部署，自动处理CORS问题，无需代理服务器。

## ✨ **Vercel优势**
- ✅ **自动CORS处理** - 无需配置代理
- ✅ **全球CDN** - 访问速度快
- ✅ **自动HTTPS** - 安全连接
- ✅ **零配置部署** - 自动检测和构建
- ✅ **Git集成** - 自动部署

## 🚀 **部署步骤**

### 1. **安装Vercel CLI**
```bash
npm i -g vercel
```

### 2. **登录Vercel**
```bash
vercel login
```

### 3. **部署应用**
```bash
vercel
```

### 4. **生产环境部署**
```bash
vercel --prod
```

## 🌐 **访问地址**
部署成功后，Vercel会提供：
- **预览URL**: `https://quest-web-xxx.vercel.app`
- **生产URL**: `https://quest-web.vercel.app` (如果配置了自定义域名)

## 🔧 **本地开发**
```bash
npm run dev
# 或
npm start
```
前端运行在 `http://localhost:8080`

## 📁 **项目结构**
```
quest-web/
├── src/client/           # 前端代码
│   ├── pages/           # HTML页面
│   ├── js/              # JavaScript文件
│   ├── styles/          # CSS样式
│   └── public/          # 静态资源
├── vercel.json          # Vercel配置
├── package.json         # 项目配置
└── VERCEL_DEPLOYMENT.md # 本文档
```

## 🔍 **故障排除**
如果遇到问题：
1. 检查 `vercel.json` 配置
2. 确认文件路径正确
3. 查看Vercel部署日志
4. 检查API端点是否可访问

## 📚 **更多信息**
- [Vercel文档](https://vercel.com/docs)
- [Vercel CLI](https://vercel.com/docs/cli)
- [静态站点部署](https://vercel.com/docs/static-sites)
