# Vercel 环境变量检查指南

## 🔍 问题诊断

从错误日志可以看出：
```
TypeError: fetch failed
Email not found. Please check your email or sign up.
```

这表明：
1. **网络连接问题** - `fetch failed` 表示无法连接到 Supabase
2. **环境变量问题** - 可能是环境变量未正确设置

## 📋 Vercel 环境变量设置步骤

### 1. 登录 Vercel 仪表板
- 访问 https://vercel.com/dashboard
- 找到你的项目 `quest-jmzuj65mw-chris-jins-projects`

### 2. 进入环境变量设置
- 点击项目名称
- 点击 **Settings** 标签
- 点击左侧菜单中的 **Environment Variables**

### 3. 检查现有环境变量
确保以下三个变量都存在且值正确：

| 变量名 | 当前值 | 正确值 |
|--------|--------|--------|
| `SUPABASE_URL` | 检查是否设置 | `https://wlpitstgjomynzfnqkye.supabase.co` |
| `SUPABASE_ANON_KEY` | 检查是否设置 | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscGl0c3Rnam9teW56Zm5xa3llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxMzMyNzIsImV4cCI6MjA1OTcwOTI3Mn0.7HpEjNdnfOIeYn4nnooaAhDUqrA8q07nWtxFzVwzHck` |
| `SUPABASE_SERVICE_ROLE_KEY` | 检查是否设置 | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscGl0c3Rnam9teW56Zm5xa3llIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDEzMzI3MiwiZXhwIjoyMDU5NzA5MjcyfQ.dttyUPithJWr51dtpkJ6Ln5XnxZssHBI1tW-OCcbLKw` |

### 4. 添加/更新环境变量

#### 如果变量不存在：
1. 点击 **Add New**
2. 输入变量名（如 `SUPABASE_URL`）
3. 输入对应的值
4. 选择 **Production** 环境
5. 点击 **Save**

#### 如果变量存在但值不正确：
1. 点击变量名旁边的 **Edit** 按钮
2. 更新值为正确的值
3. 点击 **Save**

### 5. 验证设置
确保：
- ✅ 所有三个变量都存在
- ✅ 值完整且正确（没有多余的空格）
- ✅ 环境选择为 **Production**
- ✅ 变量名大小写正确

## 🔧 重新部署

设置完环境变量后：
1. 回到 **Deployments** 标签
2. 点击 **Redeploy** 按钮
3. 等待部署完成

## 🧪 测试部署

部署完成后，你可以通过以下方式测试：

### 方法 1: 直接访问应用
访问：https://quest-jmzuj65mw-chris-jins-projects.vercel.app

### 方法 2: 检查 Vercel 函数日志
1. 在 Vercel 仪表板中点击 **Functions** 标签
2. 查看最新的函数调用日志
3. 检查是否有环境变量相关的错误

## ⚠️ 常见问题

### 1. 变量值显示为 `•••••••••••••••`
- 这表示变量存在但可能值为空
- 点击编辑并重新输入完整值

### 2. 部署后仍然报错
- 检查是否选择了正确的环境（Production）
- 确认变量名拼写正确
- 重新部署应用

### 3. 网络连接问题
- 检查 Supabase 项目是否正常运行
- 确认 API 密钥是否有效

## 📞 下一步

如果按照以上步骤设置后仍然有问题，请：
1. 截图 Vercel 环境变量页面
2. 提供最新的错误日志
3. 确认 Supabase 项目状态 