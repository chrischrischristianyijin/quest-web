# Quest API 输入输出格式示例

## 🔄 更新后的API格式

### 1. **创建Insight的输入格式**

#### 从URL创建Insight（推荐方式）
```javascript
// 基本用法
const insightData = {
    url: "https://example.com/article"
};

// 带自定义字段
const insightData = {
    url: "https://example.com/article",
    title: "自定义标题",
    description: "自定义描述",
    thought: "我的想法和备注",
    tag_names: ["技术", "AI", "机器学习"]
};

// 调用API
const result = await api.createInsightFromUrl(url, insightData);
```

#### 直接创建Insight
```javascript
const insightData = {
    title: "AI技术发展趋势",
    description: "关于人工智能的最新发展...",
    url: "https://example.com/article",
    image_url: "https://example.com/image.jpg",
    thought: "这个领域发展很快，值得深入研究",
    tag_names: ["技术", "AI", "机器学习"]
};

const result = await api.createInsight(insightData);
```

### 2. **API响应格式**

#### 成功响应
```json
{
    "success": true,
    "data": {
        "id": "660e8400-e29b-41d4-a716-446655440000",
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "title": "AI技术发展趋势",
        "description": "关于人工智能的最新发展...",
        "url": "https://example.com/article",
        "image_url": "https://example.com/image.jpg",
        "thought": "这个领域发展很快，值得深入研究",
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-15T10:30:00Z",
        "tags": [
            {
                "id": "880e8400-e29b-41d4-a716-446655440000",
                "name": "技术",
                "color": "#3B82F6"
            },
            {
                "id": "990e8400-e29b-41d4-a716-446655440000",
                "name": "AI",
                "color": "#10B981"
            }
        ]
    }
}
```

#### 错误响应
```json
{
    "success": false,
    "detail": "具体错误信息"
}
```

### 3. **前端表单字段映射**

#### HTML表单结构
```html
<form id="addContentForm">
    <!-- 必需字段 -->
    <input type="url" id="contentUrl" required placeholder="https://...">
    
    <!-- 可选自定义字段 -->
    <input type="text" id="customTitle" placeholder="自定义标题">
    <textarea id="customDescription" placeholder="自定义描述"></textarea>
    <textarea id="customThought" placeholder="你的想法"></textarea>
    
    <!-- 标签选择 -->
    <div id="tagSelector">
        <!-- 动态生成的标签选项 -->
    </div>
</form>
```

#### JavaScript数据处理
```javascript
// 获取表单数据
const url = document.getElementById('contentUrl').value.trim();
const customTitle = document.getElementById('customTitle').value.trim();
const customDescription = document.getElementById('customDescription').value.trim();
const customThought = document.getElementById('customThought').value.trim();

// 获取选中的标签
const selectedTags = tagSelector.querySelectorAll('.tag-option.selected');
const tagNames = Array.from(selectedTags)
    .map(tag => tag.textContent.trim())
    .filter(tag => tag.length > 0);

// 构建API请求数据
const insightData = {
    url: url,
    tag_names: tagNames.length > 0 ? tagNames : undefined
};

// 添加自定义字段（如果用户输入了的话）
if (customTitle) insightData.title = customTitle;
if (customDescription) insightData.description = customDescription;
if (customThought) insightData.thought = customThought;

// 调用API
const result = await api.createInsightFromUrl(url, insightData);
```

### 4. **标签管理格式**

#### 创建标签
```javascript
const tagData = {
    name: "AI技术",
    color: "#FF5733"
};

const result = await api.createUserTag(tagData);
```

#### 标签响应格式
```json
{
    "success": true,
    "data": {
        "id": "880e8400-e29b-41d4-a716-446655440000",
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "AI技术",
        "color": "#FF5733",
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-15T10:30:00Z"
    }
}
```

### 5. **用户认证格式**

#### 登录请求
```javascript
const credentials = {
    email: "user@example.com",
    password: "password123"
};

const result = await api.login(credentials);
```

#### 登录响应
```json
{
    "success": true,
    "data": {
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "token_type": "bearer",
        "user_id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "user@example.com"
    }
}
```

### 6. **错误处理格式**

#### HTTP状态码
- `200 OK` - 请求成功
- `400 Bad Request` - 请求参数错误
- `401 Unauthorized` - 未授权访问
- `403 Forbidden` - 权限不足
- `422 Unprocessable Entity` - 数据验证失败
- `500 Internal Server Error` - 服务器内部错误

#### 错误响应示例
```json
{
    "success": false,
    "detail": "数据验证失败：标题不能为空"
}
```

### 7. **字段验证规则**

#### Insight字段限制
- **title**: 1-200字符（可选，不提供则使用网页标题）
- **description**: 最大3000字符（可选，不提供则使用网页描述）
- **url**: 最大500字符（必需）
- **image_url**: 最大500字符（可选）
- **thought**: 最大2000字符（可选，用户的想法/备注）
- **tag_names**: 标签名称数组（可选）

#### 标签字段限制
- **name**: 1-50字符（必需）
- **color**: 十六进制颜色值（必需，如 #FF5733）

### 8. **使用建议**

#### 最佳实践
1. **优先使用 `createInsightFromUrl`** - 自动提取元数据，用户体验更好
2. **合理使用自定义字段** - 让用户补充或覆盖自动提取的内容
3. **标签管理** - 使用 `tag_names` 数组，后端自动处理标签关联
4. **错误处理** - 始终检查 `success` 字段和 `detail` 错误信息
5. **表单验证** - 前端进行基本验证，后端进行完整验证

#### 性能优化
1. **批量操作** - 使用分页API获取大量数据
2. **缓存策略** - 合理缓存用户资料和标签信息
3. **异步处理** - 使用 async/await 处理API调用
4. **错误重试** - 对网络错误实现重试机制
