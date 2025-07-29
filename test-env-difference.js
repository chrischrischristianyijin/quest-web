import { config } from './src/config.js';

console.log('🔧 环境变量测试');
console.log('================');

// 测试环境变量状态
console.log('📋 环境变量状态:');
console.log('- process.env.SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ 已设置' : '❌ 未设置');
console.log('- process.env.SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ 已设置' : '❌ 未设置');
console.log('- process.env.SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ 已设置' : '❌ 未设置');

console.log('\n📋 配置对象状态:');
console.log('- config.SUPABASE_URL:', config.SUPABASE_URL ? '✅ 有值' : '❌ 无值');
console.log('- config.SUPABASE_ANON_KEY:', config.SUPABASE_ANON_KEY ? '✅ 有值' : '❌ 无值');
console.log('- config.SUPABASE_SERVICE_ROLE_KEY:', config.SUPABASE_SERVICE_ROLE_KEY ? '✅ 有值' : '❌ 无值');

console.log('\n🔍 详细分析:');

// 测试 SUPABASE_SERVICE_ROLE_KEY
const envValue = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configValue = config.SUPABASE_SERVICE_ROLE_KEY;

console.log('- 环境变量值:', envValue ? `${envValue.substring(0, 20)}...` : 'undefined');
console.log('- 配置对象值:', configValue ? `${configValue.substring(0, 20)}...` : 'undefined');

if (envValue && configValue) {
    console.log('✅ 本地环境: 环境变量和配置对象都有值');
} else if (!envValue && configValue) {
    console.log('✅ 本地环境: 使用默认值 (环境变量未设置，但配置对象有默认值)');
} else if (!envValue && !configValue) {
    console.log('❌ 错误: 环境变量和配置对象都没有值');
}

console.log('\n🌐 环境信息:');
console.log('- NODE_ENV:', process.env.NODE_ENV || 'undefined');
console.log('- VERCEL:', !!process.env.VERCEL);
console.log('- Platform:', process.platform);

console.log('\n💡 解释:');
console.log('1. 本地开发: 即使环境变量未设置，config.js 中的默认值会生效');
console.log('2. Vercel 生产环境: 完全依赖环境变量，没有默认值机制');
console.log('3. 这就是为什么本地工作但 Vercel 不工作的原因');

console.log('\n🔧 解决方案:');
console.log('1. 在 Vercel 仪表板中设置所有必需的环境变量');
console.log('2. 确保变量名称完全匹配');
console.log('3. 重新部署应用'); 