import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

console.log('🔧 Vercel 环境诊断');
console.log('==================');

// 环境变量检查
const envVars = {
    'SUPABASE_URL': process.env.SUPABASE_URL,
    'SUPABASE_ANON_KEY': process.env.SUPABASE_ANON_KEY,
    'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'NODE_ENV': process.env.NODE_ENV,
    'VERCEL': process.env.VERCEL,
    'VERCEL_ENV': process.env.VERCEL_ENV
};

console.log('📋 环境变量状态:');
Object.entries(envVars).forEach(([key, value]) => {
    const status = value ? '✅ 已设置' : '❌ 未设置';
    const preview = value ? `${value.substring(0, 20)}...` : '无';
    console.log(`  ${key}: ${status} (${preview})`);
});

console.log('\n🌐 网络连接测试:');

// 测试 1: 基本网络连接
async function testBasicConnectivity() {
    try {
        console.log('🧪 测试1: 基本网络连接...');
        const startTime = Date.now();
        const response = await fetch('https://www.google.com', { 
            method: 'HEAD',
            signal: AbortSignal.timeout(5000)
        });
        const responseTime = Date.now() - startTime;
        console.log('✅ 基本网络连接正常，响应时间:', responseTime + 'ms');
        return true;
    } catch (error) {
        console.error('❌ 基本网络连接失败:', error.message);
        return false;
    }
}

// 测试 2: Supabase URL 连接
async function testSupabaseUrl() {
    if (!process.env.SUPABASE_URL) {
        console.log('❌ SUPABASE_URL 未设置，跳过测试');
        return false;
    }
    
    try {
        console.log('🧪 测试2: Supabase URL 连接...');
        const startTime = Date.now();
        const response = await fetch(process.env.SUPABASE_URL, { 
            method: 'HEAD',
            signal: AbortSignal.timeout(10000)
        });
        const responseTime = Date.now() - startTime;
        console.log('✅ Supabase URL 可访问，响应时间:', responseTime + 'ms');
        console.log('📊 响应状态:', response.status);
        return true;
    } catch (error) {
        console.error('❌ Supabase URL 连接失败:', error.message);
        return false;
    }
}

// 测试 3: Supabase 客户端连接
async function testSupabaseClient() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.log('❌ 缺少 Supabase 环境变量，跳过测试');
        return false;
    }
    
    try {
        console.log('🧪 测试3: Supabase 客户端连接...');
        const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        
        const startTime = Date.now();
        const { data, error } = await client
            .from('users')
            .select('count')
            .limit(1);
        const responseTime = Date.now() - startTime;
        
        if (error) {
            console.error('❌ Supabase 查询失败:', error);
            return false;
        }
        
        console.log('✅ Supabase 客户端连接成功，响应时间:', responseTime + 'ms');
        console.log('📊 查询结果:', data);
        return true;
    } catch (error) {
        console.error('❌ Supabase 客户端连接失败:', error.message);
        return false;
    }
}

// 测试 4: 检查 Vercel 特定环境
function checkVercelEnvironment() {
    console.log('\n🧪 测试4: Vercel 环境检查...');
    console.log('- NODE_ENV:', process.env.NODE_ENV || 'undefined');
    console.log('- VERCEL:', !!process.env.VERCEL);
    console.log('- VERCEL_ENV:', process.env.VERCEL_ENV || 'undefined');
    console.log('- AWS_LAMBDA_FUNCTION_NAME:', process.env.AWS_LAMBDA_FUNCTION_NAME || 'undefined');
    console.log('- Platform:', process.platform);
    console.log('- Node version:', process.version);
    
    const isVercel = !!process.env.VERCEL;
    const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
    
    if (isVercel) {
        console.log('✅ 检测到 Vercel 环境');
    } else {
        console.log('⚠️  未检测到 Vercel 环境');
    }
    
    if (isLambda) {
        console.log('✅ 检测到 Lambda 环境');
    } else {
        console.log('⚠️  未检测到 Lambda 环境');
    }
    
    return isVercel;
}

// 运行所有测试
async function runAllTests() {
    const results = {
        basicConnectivity: await testBasicConnectivity(),
        supabaseUrl: await testSupabaseUrl(),
        supabaseClient: await testSupabaseClient(),
        isVercel: checkVercelEnvironment()
    };
    
    console.log('\n📊 测试结果汇总:');
    console.log('- 基本网络连接:', results.basicConnectivity ? '✅ 正常' : '❌ 失败');
    console.log('- Supabase URL:', results.supabaseUrl ? '✅ 正常' : '❌ 失败');
    console.log('- Supabase 客户端:', results.supabaseClient ? '✅ 正常' : '❌ 失败');
    console.log('- Vercel 环境:', results.isVercel ? '✅ 检测到' : '⚠️  未检测到');
    
    const allPassed = Object.values(results).every(result => result);
    
    if (allPassed) {
        console.log('\n🎉 所有测试通过！');
    } else {
        console.log('\n⚠️  部分测试失败，可能的问题:');
        
        if (!results.basicConnectivity) {
            console.log('💡 网络连接问题 - 检查 Vercel 的网络配置');
        }
        if (!results.supabaseUrl) {
            console.log('💡 Supabase URL 问题 - 检查 SUPABASE_URL 环境变量');
        }
        if (!results.supabaseClient) {
            console.log('💡 Supabase 客户端问题 - 检查 SUPABASE_SERVICE_ROLE_KEY 环境变量');
        }
        if (!results.isVercel) {
            console.log('💡 环境检测问题 - 确保在 Vercel 上运行');
        }
    }
    
    return results;
}

// 执行测试
runAllTests().catch(console.error); 