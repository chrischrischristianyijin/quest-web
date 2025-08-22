# 🚀 代理服务器设置指南

## 📋 **概述**
这个代理服务器解决了前端跨域问题，让前端可以直接访问后端API而不会有CORS错误。

## 🛠️ **安装依赖**
```bash
npm run install:proxy
```

## 🚀 **启动代理服务器**
```bash
npm run dev
# 或者
npm start
```

## 🌐 **访问地址**
- **前端应用**: http://localhost:3001
- **API代理**: http://localhost:3001/api/* → https://quest-api-edz1.onrender.com/api/*
- **健康检查**: http://localhost:3001/health

## 🔧 **工作原理**
1. 前端发送请求到 `http://localhost:3001/api/v1/...`
2. 代理服务器接收请求并转发到 `https://quest-api-edz1.onrender.com/api/v1/...`
3. 后端响应通过代理服务器返回给前端
4. 浏览器不会遇到CORS问题，因为请求都来自同一个域名

## 📁 **文件结构**
```
quest-web/
├── proxy-server.js          # 代理服务器主文件
├── package.json             # 项目配置和依赖
├── src/client/              # 前端代码
│   ├── js/
│   │   ├── config.js        # API配置（已更新为本地代理）
│   │   └── api.js           # API服务（已简化，移除CORS代理）
│   └── ...
└── PROXY_SETUP.md           # 本文档
```

## ✅ **优势**
- ✅ **最稳妥的解决方案** - 没有CORS问题
- ✅ **性能更好** - 不需要通过第三方代理服务
- ✅ **更安全** - 所有请求都通过自己的服务器
- ✅ **更稳定** - 不依赖外部代理服务的可用性

## 🚨 **注意事项**
- 确保端口3001没有被其他服务占用
- 代理服务器需要和后端API保持同步
- 生产环境建议使用Nginx等更专业的代理服务器

## 🔍 **故障排除**
如果遇到问题：
1. 检查代理服务器是否正常启动
2. 查看控制台日志
3. 访问 `/health` 端点检查服务状态
4. 确认后端API是否可访问
