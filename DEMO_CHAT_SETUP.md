# Quest AI Chat 配置指南

## 🎉 升级完成！

你的demo chat页面现在已经升级为使用真正的Quest API后端，支持RAG（检索增强生成）功能！

## 📋 主要功能

### ✅ 已实现的功能
- **真实AI对话**：集成Quest API，支持RAG检索
- **流式响应**：实时显示AI回复过程
- **来源引用**：显示RAG检索到的文档来源
- **错误处理**：优雅处理API错误和网络问题
- **健康检查**：自动检测API连接状态
- **响应时间**：显示AI响应延迟
- **认证支持**：支持Bearer token认证
- **响应式设计**：完美适配移动端

### 🔧 技术特性
- **SSE流式响应**：支持Server-Sent Events
- **自动重试**：网络错误时自动重试
- **优雅降级**：API不可用时显示友好错误信息
- **实时状态**：右上角显示API连接状态

## ⚙️ 配置步骤

### 1. 修改API地址

编辑 `src/client/js/api-config.js` 文件：

```javascript
const QUEST_API_CONFIG = {
    // 替换为你的实际Quest API地址
    BASE_URL: 'https://your-actual-quest-api.com',
    
    // 如果需要认证，设置你的token
    AUTH: {
        TOKEN: 'Bearer your-actual-token-here',
        USER_ID: 'your-user-id'
    }
};
```

### 2. 配置选项说明

```javascript
const QUEST_API_CONFIG = {
    // API基础地址
    BASE_URL: 'https://your-quest-api.com',
    
    // API端点（通常不需要修改）
    ENDPOINTS: {
        CHAT: '/api/v1/chat',
        HEALTH: '/api/v1/chat/health'
    },
    
    // 认证配置
    AUTH: {
        TOKEN: null,        // Bearer token
        USER_ID: null       // 用户ID
    },
    
    // 请求配置
    REQUEST: {
        TIMEOUT: 30000,     // 超时时间
        RETRY_COUNT: 3,     // 重试次数
        RETRY_DELAY: 1000   // 重试延迟
    },
    
    // UI配置
    UI: {
        TYPING_SPEED: 30,   // 打字速度
        SHOW_LATENCY: true, // 显示响应时间
        SHOW_SOURCES: true  // 显示来源信息
    }
};
```

## 🚀 使用方法

### 1. 本地开发
```bash
# 启动开发服务器
npm start

# 访问demo chat页面
http://localhost:8080/demo-chat
```

### 2. 生产部署
确保你的Vercel部署包含了最新的配置，然后访问：
```
https://your-domain.vercel.app/demo-chat
```

## 📡 API集成详情

### 请求格式
```javascript
POST /api/v1/chat
Content-Type: application/json
Authorization: Bearer your-token (可选)

{
  "message": "用户的问题"
}
```

### 响应格式（流式）
```
data: {"type": "content", "content": "AI回复内容"}

data: {"type": "done", "request_id": "uuid", "latency_ms": 1500, "sources": [...]}
```

### 健康检查
```
GET /api/v1/chat/health

响应：
{
  "status": "healthy",
  "message": "聊天服务运行正常",
  "features": {
    "rag_enabled": true,
    "streaming_enabled": true
  }
}
```

## 🔍 功能演示

### 1. RAG检索
- AI会搜索你的知识库
- 显示找到的相关文档数量
- 提供基于文档的准确回答

### 2. 流式响应
- 实时显示AI思考过程
- 打字机效果展示回复
- 显示响应时间和来源信息

### 3. 错误处理
- API不可用时显示友好提示
- 网络错误时自动重试
- 右上角实时显示连接状态

## 🛠️ 故障排除

### 常见问题

1. **API连接失败**
   - 检查 `api-config.js` 中的 `BASE_URL` 是否正确
   - 确认API服务器是否运行正常
   - 检查网络连接和防火墙设置

2. **认证失败**
   - 确认 `AUTH.TOKEN` 是否正确设置
   - 检查token是否过期
   - 确认API是否需要认证

3. **流式响应不工作**
   - 确认API支持SSE流式响应
   - 检查浏览器是否支持EventSource
   - 查看控制台错误信息

### 调试技巧

1. **查看控制台日志**
   ```javascript
   // 打开浏览器开发者工具
   // 查看Console标签页的日志信息
   ```

2. **检查网络请求**
   ```javascript
   // 在Network标签页查看API请求
   // 确认请求格式和响应状态
   ```

3. **测试API健康状态**
   ```javascript
   // 直接访问健康检查端点
   fetch('https://your-api.com/api/v1/chat/health')
     .then(response => response.json())
     .then(data => console.log(data));
   ```

## 📈 性能优化

### 建议配置
- **超时时间**：根据网络情况调整 `TIMEOUT` 值
- **重试次数**：根据API稳定性调整 `RETRY_COUNT`
- **打字速度**：根据用户体验调整 `TYPING_SPEED`

### 监控指标
- API响应时间
- 错误率
- 用户满意度
- RAG检索质量

## 🎯 下一步计划

1. **增强功能**
   - 支持多轮对话
   - 添加对话历史
   - 支持文件上传

2. **性能优化**
   - 实现客户端缓存
   - 添加离线模式
   - 优化移动端体验

3. **用户体验**
   - 添加语音输入
   - 支持快捷键
   - 个性化设置

## 📞 技术支持

如果遇到问题，请检查：
1. API配置是否正确
2. 网络连接是否正常
3. 浏览器控制台是否有错误信息

---

🎉 **恭喜！你的Quest AI Chat现在已经完全集成了真正的AI后端！**
