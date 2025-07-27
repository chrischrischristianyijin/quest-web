#!/bin/bash

echo "🚀 开始 Vercel 部署流程..."

# 检查是否安装了 Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI 未安装，正在安装..."
    npm install -g vercel
fi

# 检查是否已登录
if ! vercel whoami &> /dev/null; then
    echo "🔐 请先登录 Vercel..."
    vercel login
fi

# 检查环境变量
echo "📋 检查环境变量..."
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ] || [ -z "$JWT_SECRET" ]; then
    echo "⚠️  警告：某些环境变量未设置"
    echo "请在 Vercel 控制台中设置以下环境变量："
    echo "- SUPABASE_URL"
    echo "- SUPABASE_ANON_KEY"
    echo "- SUPABASE_SERVICE_ROLE_KEY"
    echo "- JWT_SECRET"
    echo ""
    echo "或者使用以下命令设置："
    echo "vercel env add SUPABASE_URL"
    echo "vercel env add SUPABASE_ANON_KEY"
    echo "vercel env add SUPABASE_SERVICE_ROLE_KEY"
    echo "vercel env add JWT_SECRET"
fi

# 部署到 Vercel
echo "🌐 部署到 Vercel..."
vercel --prod

echo "✅ 部署完成！"
echo "📖 查看部署指南：cat DEPLOYMENT.md" 