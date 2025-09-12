# 🤖 Quest AI Chat 使用说明

## 🎉 升级完成！

你的demo chat页面现在已经**完全升级**为使用真正的Quest API后端！

## ✨ 新功能特性

### 🔥 核心功能
- **真实AI对话**：不再是模拟，而是真正的AI回复
- **RAG检索**：基于你的知识库进行智能问答
- **流式响应**：实时显示AI思考过程
- **来源引用**：显示AI回答的文档来源
- **响应时间**：显示AI处理延迟

### 🛠️ 技术升级
- **API集成**：完全集成Quest API后端
- **流式处理**：支持Server-Sent Events
- **错误处理**：优雅处理各种异常情况
- **状态监控**：实时显示API连接状态
- **认证支持**：支持Bearer token认证

## ⚙️ 快速配置

### 1. 修改API地址
编辑 `src/client/js/api-config.js`：

```javascript
const QUEST_API_CONFIG = {
    // 替换为你的实际API地址
    BASE_URL: 'https://your-actual-quest-api.com',
    
    // 如果需要认证
    AUTH: {
        TOKEN: 'Bearer your-token-here'
    }
};
```

### 2. 访问页面
- 本地：`http://localhost:8080/demo-chat`
- 生产：`https://your-domain.vercel.app/demo-chat`

## 🎯 使用体验

### 对话流程
1. **输入问题** → 2. **AI思考** → 3. **流式回复** → 4. **显示来源**

### 界面元素
- 🟢 **右上角状态**：显示API连接状态
- 💬 **消息气泡**：用户（紫色）和AI（灰色）
- 📚 **来源信息**：显示RAG检索到的文档数量
- ⏱️ **响应时间**：显示AI处理延迟

### 错误处理
- API不可用时显示友好错误信息
- 网络问题自动重试
- 右上角状态实时更新

## 🔧 高级配置

### 自定义设置
```javascript
// 在 api-config.js 中调整
UI: {
    TYPING_SPEED: 30,    // 打字速度
    SHOW_LATENCY: true,  // 显示响应时间
    SHOW_SOURCES: true   // 显示来源信息
}
```

### 认证配置
```javascript
AUTH: {
    TOKEN: 'Bearer your-token',
    USER_ID: 'your-user-id'  // 用于个性化检索
}
```

## 🚀 立即体验

1. **配置API地址**
2. **保存配置文件**
3. **刷新页面**
4. **开始与AI对话！**

---

🎉 **现在你的Quest AI Chat已经是真正的AI了！**
