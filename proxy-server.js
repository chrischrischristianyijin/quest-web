const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3001;

// 启用CORS
app.use(cors());

// 静态文件服务（前端）
app.use(express.static(path.join(__dirname, 'src/client')));

// 代理API请求到后端
app.use('/api', createProxyMiddleware({
    target: 'https://quest-api-edz1.onrender.com',
    changeOrigin: true,
    pathRewrite: {
        '^/api': '/api' // 保持路径不变
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log(`🔄 代理请求: ${req.method} ${req.url} -> ${proxyReq.path}`);
    },
    onProxyRes: (proxyRes, req, res) => {
        console.log(`✅ 代理响应: ${proxyRes.statusCode} ${req.url}`);
        if (proxyRes.statusCode >= 400) {
            console.error(`❌ 后端错误: ${proxyRes.statusCode} ${req.url}`);
        }
    },
    onError: (err, req, res) => {
        console.error(`❌ 代理错误: ${err.message}`);
        res.status(500).json({ error: '代理服务器错误' });
    }
}));

// 健康检查
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: '代理服务器运行正常' });
});

// 所有其他请求返回前端页面
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'src/client/pages/index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 代理服务器启动成功！`);
    console.log(`📍 前端地址: http://localhost:${PORT}`);
    console.log(`🔗 API代理: http://localhost:${PORT}/api/* -> https://quest-api-edz1.onrender.com/api/*`);
    console.log(`💡 现在前端可以直接访问 /api/* 而不会有CORS问题`);
});
