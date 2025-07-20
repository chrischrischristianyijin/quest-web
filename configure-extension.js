#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔧 Quest 扩展配置工具');
console.log('========================');

// 获取命令行参数
const vercelDomain = process.argv[2];

if (!vercelDomain) {
    console.log('\n❌ 请提供你的 Vercel 域名');
    console.log('使用方法: node configure-extension.js YOUR-VERCEL-DOMAIN');
    console.log('例如: node configure-extension.js quest-web-abc123.vercel.app');
    console.log('\n📋 获取域名步骤:');
    console.log('1. 访问 vercel.com 并登录');
    console.log('2. 找到你的 quest-web 项目');
    console.log('3. 复制域名（例如：quest-web-abc123.vercel.app）');
    process.exit(1);
}

// 移除可能的协议前缀
const cleanDomain = vercelDomain.replace(/^https?:\/\//, '');

console.log(`\n✅ 配置域名: ${cleanDomain}`);

// 更新 popup.js
const popupPath = path.join(__dirname, 'src/extension/popup.js');
let popupContent = fs.readFileSync(popupPath, 'utf8');

// 替换 API_BASE
popupContent = popupContent.replace(
    /const API_BASE = 'https:\/\/YOUR-VERCEL-DOMAIN\.vercel\.app\/api\/v1';/,
    `const API_BASE = 'https://${cleanDomain}/api/v1';`
);

fs.writeFileSync(popupPath, popupContent);
console.log('✅ 已更新 src/extension/popup.js');

// 更新 manifest.json
const manifestPath = path.join(__dirname, 'src/extension/manifest.json');
let manifestContent = fs.readFileSync(manifestPath, 'utf8');

// 添加特定域名权限
const specificDomainPermission = `    "https://${cleanDomain}/*"`;

if (!manifestContent.includes(specificDomainPermission)) {
    manifestContent = manifestContent.replace(
        /"host_permissions": \[/,
        `"host_permissions": [\n    ${specificDomainPermission},`
    );
    fs.writeFileSync(manifestPath, manifestContent);
    console.log('✅ 已更新 src/extension/manifest.json');
}

console.log('\n🎉 扩展配置完成！');
console.log('\n📋 下一步：');
console.log('1. 在 Chrome 中打开 chrome://extensions/');
console.log('2. 开启"开发者模式"');
console.log('3. 点击"加载已解压的扩展程序"');
console.log('4. 选择 src/extension 文件夹');
console.log('5. 扩展将连接到你的 Vercel 部署');

console.log('\n🔗 测试链接:');
console.log(`- 网站: https://${cleanDomain}`);
console.log(`- 测试页面: https://${cleanDomain}/simple`);
console.log(`- API 测试: https://${cleanDomain}/api/v1/auth/current-user`); 