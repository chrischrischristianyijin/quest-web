#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('📦 Quest 扩展打包工具');
console.log('======================');

// 检查是否提供了域名
const vercelDomain = process.argv[2];

if (!vercelDomain) {
    console.log('\n❌ 请提供你的 Vercel 域名');
    console.log('使用方法: node package-extension.js YOUR-VERCEL-DOMAIN');
    console.log('例如: node package-extension.js quest-web-abc123.vercel.app');
    process.exit(1);
}

// 移除可能的协议前缀
const cleanDomain = vercelDomain.replace(/^https?:\/\//, '');

console.log(`\n✅ 配置域名: ${cleanDomain}`);

// 第一步：配置扩展
console.log('\n🔧 配置扩展...');
try {
    execSync(`node configure-extension.js ${cleanDomain}`, { stdio: 'inherit' });
} catch (error) {
    console.error('❌ 配置失败:', error.message);
    process.exit(1);
}

// 第二步：创建发布目录
const releaseDir = 'quest-extension-release';
if (fs.existsSync(releaseDir)) {
    fs.rmSync(releaseDir, { recursive: true });
}
fs.mkdirSync(releaseDir);

// 第三步：复制扩展文件
console.log('\n📁 复制扩展文件...');
const extensionDir = path.join(__dirname, 'src/extension');
const files = fs.readdirSync(extensionDir);

files.forEach(file => {
    const sourcePath = path.join(extensionDir, file);
    const destPath = path.join(releaseDir, file);
    
    if (fs.statSync(sourcePath).isDirectory()) {
        fs.cpSync(sourcePath, destPath, { recursive: true });
    } else {
        fs.copyFileSync(sourcePath, destPath);
    }
});

// 第四步：复制安装指南
console.log('\n📖 复制安装指南...');
fs.copyFileSync('EXTENSION_INSTALL_GUIDE.md', path.join(releaseDir, 'README.md'));

// 第五步：创建隐私政策
console.log('\n🔒 创建隐私政策...');
const privacyPolicy = `# 隐私政策

## 数据收集
- 扩展只收集你主动保存的洞察内容
- 用户认证信息存储在本地
- 不收集浏览历史或其他个人信息

## 数据使用
- 洞察内容保存到你的 Quest 账户
- 数据仅用于提供核心功能
- 不会与第三方分享

## 数据安全
- 使用 HTTPS 加密传输
- 遵循行业标准安全实践

## 联系信息
如有问题，请联系开发者。
`;

fs.writeFileSync(path.join(releaseDir, 'PRIVACY_POLICY.md'), privacyPolicy);

// 第六步：创建 zip 文件
console.log('\n📦 创建发布包...');
const currentDir = process.cwd();
process.chdir(releaseDir);

try {
    execSync('zip -r quest-extension.zip . -x "*.DS_Store"', { stdio: 'inherit' });
} catch (error) {
    console.error('❌ 创建 zip 文件失败:', error.message);
    process.exit(1);
}

process.chdir(currentDir);

// 第七步：移动 zip 文件到根目录
fs.renameSync(
    path.join(releaseDir, 'quest-extension.zip'),
    path.join(__dirname, 'quest-extension.zip')
);

console.log('\n🎉 扩展打包完成！');
console.log('\n📋 发布文件：');
console.log(`- quest-extension.zip (扩展包)`);
console.log(`- ${releaseDir}/ (发布文件夹)`);

console.log('\n🚀 发布选项：');

console.log('\n1. Chrome Web Store:');
console.log('   - 访问 https://chrome.google.com/webstore/devconsole/');
console.log('   - 注册开发者账号 ($5)');
console.log('   - 上传 quest-extension.zip');

console.log('\n2. GitHub Releases:');
console.log('   - 在 GitHub 仓库创建新的 Release');
console.log('   - 上传 quest-extension.zip');
console.log('   - 添加安装说明');

console.log('\n3. 直接分享:');
console.log('   - 将 quest-extension.zip 分享给用户');
console.log('   - 提供 EXTENSION_INSTALL_GUIDE.md 作为安装说明');

console.log('\n🔗 测试链接:');
console.log(`- 网站: https://${cleanDomain}`);
console.log(`- 测试页面: https://${cleanDomain}/simple`);
console.log(`- API 测试: https://${cleanDomain}/api/v1/auth/current-user`);

console.log('\n✅ 扩展已准备就绪，可以分享给其他人使用了！'); 