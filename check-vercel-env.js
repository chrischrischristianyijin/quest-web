import { config } from './src/config.js';

console.log('🔧 Vercel 环境变量检查');
console.log('========================');

// 检查环境变量
const envVars = {
    'SUPABASE_URL': process.env.SUPABASE_URL,
    'SUPABASE_ANON_KEY': process.env.SUPABASE_ANON_KEY,
    'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'GOOGLE_CLIENT_ID': process.env.GOOGLE_CLIENT_ID,
    'GOOGLE_CLIENT_SECRET': process.env.GOOGLE_CLIENT_SECRET,
    'GOOGLE_REDIRECT_URI': process.env.GOOGLE_REDIRECT_URI
};

console.log('📋 环境变量状态:');
Object.entries(envVars).forEach(([key, value]) => {
    const status = value ? '✅ 已设置' : '❌ 未设置';
    const preview = value ? `${value.substring(0, 20)}...` : '无';
    console.log(`  ${key}: ${status} (${preview})`);
});

console.log('\n🔧 配置对象状态:');
console.log('  SUPABASE_URL:', config.SUPABASE_URL ? '✅ 已配置' : '❌ 未配置');
console.log('  SUPABASE_ANON_KEY:', config.SUPABASE_ANON_KEY ? '✅ 已配置' : '❌ 未配置');
console.log('  SUPABASE_SERVICE_KEY:', config.SUPABASE_SERVICE_KEY ? '✅ 已配置' : '❌ 未配置');

console.log('\n🌐 运行时环境:');
console.log('  NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('  VERCEL:', !!process.env.VERCEL);
console.log('  Platform:', process.platform);

console.log('\n📊 所有包含 SUPABASE 的环境变量:');
const supabaseKeys = Object.keys(process.env).filter(k => k.includes('SUPABASE'));
console.log('  ', supabaseKeys.length > 0 ? supabaseKeys.join(', ') : '无');

console.log('\n📊 所有包含 GOOGLE 的环境变量:');
const googleKeys = Object.keys(process.env).filter(k => k.includes('GOOGLE'));
console.log('  ', googleKeys.length > 0 ? googleKeys.join(', ') : '无');

// 检查配置是否正确
const criticalVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingVars = criticalVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.log('\n❌ 缺失关键环境变量:', missingVars);
    console.log('\n💡 解决方案:');
    console.log('1. 在 Vercel 仪表板中设置环境变量');
    console.log('2. 确保变量名称完全匹配');
    console.log('3. 重新部署应用');
} else {
    console.log('\n✅ 所有关键环境变量都已设置');
}

console.log('\n🔧 Vercel 部署建议:');
console.log('1. 在 Vercel 仪表板 → Settings → Environment Variables 中设置:');
console.log('   - SUPABASE_URL');
console.log('   - SUPABASE_ANON_KEY');
console.log('   - SUPABASE_SERVICE_ROLE_KEY');
console.log('   - GOOGLE_CLIENT_ID');
console.log('   - GOOGLE_CLIENT_SECRET');
console.log('   - GOOGLE_REDIRECT_URI');
console.log('\n2. 确保选择正确的环境 (Production/Preview/Development)');
console.log('\n3. 重新部署应用'); 