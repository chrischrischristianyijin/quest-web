# Quest API 集成配置指南

## 🚀 快速开始

你的Demo Chat页面现在已经升级为使用真正的Quest API！按照以下步骤完成配置：

### 1. 配置API端点

编辑 `src/client/js/quest-config.js` 文件：

```javascript
const QUEST_CONFIG = {
    // 将这里替换为你的实际Quest API地址
    API_BASE: 'https://your-actual-quest-api.com',
    
    // 其他配置保持不变
    ENDPOINTS: {
        CHAT: '/api/v1/chat',
        HEALTH: '/api/v1/chat/health'
    },
    // ...
};
```

### 2. 用户认证（可选）

如果你的API需要用户认证，可以通过以下方式设置token：

```javascript
// 在用户登录后设置token（推荐使用带验证的方法）
setQuestTokenWithValidation('your-user-token', true); // true = 持久化存储

// 或者在会话中临时存储
setQuestTokenWithValidation('your-user-token', false); // false = 会话存储

// 检查认证状态
const authStatus = checkAuthStatus();
console.log('认证状态:', authStatus);

// 获取认证摘要
const summary = getAuthSummary();
console.log('认证摘要:', summary);
```

### 3. 测试连接

打开Demo Chat页面，系统会自动：
- ✅ 检查API配置是否正确
- ✅ 测试API健康状态
- ✅ 验证RAG功能是否可用

## 🔧 功能特性

### 已实现的功能

1. **真正的RAG聊天**：基于你的文档库进行智能问答
2. **流式响应**：实时显示AI回复过程
3. **错误处理**：优雅处理网络错误和API错误
4. **源文档引用**：显示AI回答基于哪些文档
5. **健康检查**：自动检测API状态
6. **用户认证**：支持Bearer token认证

### API集成详情

- **端点**: `POST /api/v1/chat`
- **流式响应**: 支持Server-Sent Events (SSE)
- **认证**: Bearer token（可选）
- **RAG**: 自动检索相关文档
- **引用**: 显示来源文档信息

## 📝 使用示例

### 基本聊天
```javascript
// 用户发送消息
"请总结一下我保存的关于机器学习的文章"

// AI基于RAG的回复
"根据您保存的文档，机器学习的主要概念包括..."
// 来源: 3个相关文档
```

### 错误处理
```javascript
// 网络错误
"Sorry, I encountered an error: Network Error. Please try again or check your connection."

// API错误
"Sorry, I encountered an error: API Error: 500 Internal Server Error. Please try again later."
```

## 🔍 调试和监控

### 浏览器控制台
打开开发者工具查看：
- API配置验证结果
- 健康检查状态
- 请求/响应详情
- 错误信息

### 配置验证
```javascript
// 检查配置是否正确
const validation = validateQuestConfig();
console.log('配置状态:', validation);
```

## 🚨 故障排除

### 常见问题

1. **JWT Token过期错误**
   ```
   错误: "invalid JWT: unable to parse or verify signature, token has invalid claims: token is expired"
   解决: 
   - 系统会自动检测并清理过期的token
   - 用户需要重新登录获取新的token
   - 使用 setQuestTokenWithValidation() 设置token时会自动验证
   ```

2. **API配置错误**
   ```
   问题: "API_BASE 未配置或仍为默认值"
   解决: 更新 quest-config.js 中的 API_BASE
   ```

3. **连接失败**
   ```
   问题: "Unable to connect to Quest API"
   解决: 检查API地址、网络连接、CORS设置
   ```

4. **认证失败**
   ```
   问题: "API Error: 401 Unauthorized"
   解决: 
   - 检查token是否正确设置
   - 确认token未过期
   - 使用 checkAuthStatus() 验证认证状态
   ```

5. **Token验证失败**
   ```
   问题: "Token is invalid or expired"
   解决:
   - 使用 getAuthSummary() 查看认证摘要
   - 调用 clearQuestToken() 清理无效token
   - 重新设置有效的token
   ```

### 开发环境测试

在本地开发时，你可以：
1. 使用代理服务器处理CORS
2. 配置本地API端点进行测试
3. 使用mock数据验证UI功能

## 📊 性能优化

### 建议配置
- **超时时间**: 30秒（适合RAG处理）
- **重试机制**: 3次重试，1秒间隔
- **流式响应**: 实时显示，提升用户体验

### 监控指标
- 响应时间
- 错误率
- 用户满意度
- RAG检索质量

## 🔄 更新和维护

### 定期检查
- API健康状态
- 配置有效性
- 错误日志
- 性能指标

### 版本更新
当Quest API更新时：
1. 检查新的端点或参数
2. 更新配置文件
3. 测试兼容性
4. 更新文档

---

## 📞 技术支持

如果遇到问题：
1. 检查浏览器控制台错误
2. 验证API配置
3. 测试网络连接
4. 联系Quest开发团队

**恭喜！你的Demo Chat现在使用真正的Quest AI了！** 🎉
