import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// 从环境变量获取配置
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wlpitstgjomynzfnqkye.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscGl0c3Rnam9teW56Zm5xa3llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxMzMyNzIsImV4cCI6MjA1OTcwOTI3Mn0.7HpEjNdnfOIeYn4nnooaAhDUqrA8q07nWtxFzVwzHck';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscGl0c3Rnam9teW56Zm5xa3llIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDEzMzI3MiwiZXhwIjoyMDU5NzA5MjcyfQ.dttyUPithJWr51dtpkJ6Ln5XnxZssHBI1tW-OCcbLKw';

console.log('🔧 连接测试开始...');
console.log('📋 环境变量检查:');
console.log('- SUPABASE_URL:', SUPABASE_URL ? '已设置' : '未设置');
console.log('- SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '已设置' : '未设置');
console.log('- SUPABASE_SERVICE_KEY:', SUPABASE_SERVICE_KEY ? '已设置' : '未设置');

async function testNetworkConnectivity() {
    console.log('\n🌐 测试网络连接...');
    
    try {
        // 测试基本网络连接
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

async function testSupabaseUrl() {
    console.log('\n🔗 测试 Supabase URL 连接...');
    
    try {
        const startTime = Date.now();
        const response = await fetch(SUPABASE_URL, { 
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

async function testSupabaseClient() {
    console.log('\n🔧 测试 Supabase 客户端...');
    
    try {
        const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        console.log('🧪 测试简单查询...');
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

async function testServiceClient() {
    console.log('\n🔧 测试 Supabase 服务客户端...');
    
    try {
        const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        
        console.log('🧪 测试服务角色查询...');
        const startTime = Date.now();
        const { data, error } = await serviceClient
            .from('users')
            .select('count')
            .limit(1);
        const responseTime = Date.now() - startTime;
        
        if (error) {
            console.error('❌ 服务角色查询失败:', error);
            return false;
        }
        
        console.log('✅ 服务角色连接成功，响应时间:', responseTime + 'ms');
        console.log('📊 查询结果:', data);
        return true;
    } catch (error) {
        console.error('❌ 服务角色连接失败:', error.message);
        return false;
    }
}

async function runAllTests() {
    console.log('🚀 开始全面连接测试...\n');
    
    const results = {
        network: await testNetworkConnectivity(),
        supabaseUrl: await testSupabaseUrl(),
        supabaseClient: await testSupabaseClient(),
        serviceClient: await testServiceClient()
    };
    
    console.log('\n📊 测试结果汇总:');
    console.log('- 网络连接:', results.network ? '✅ 正常' : '❌ 失败');
    console.log('- Supabase URL:', results.supabaseUrl ? '✅ 正常' : '❌ 失败');
    console.log('- Supabase 客户端:', results.supabaseClient ? '✅ 正常' : '❌ 失败');
    console.log('- 服务角色客户端:', results.serviceClient ? '✅ 正常' : '❌ 失败');
    
    const allPassed = Object.values(results).every(result => result);
    
    if (allPassed) {
        console.log('\n🎉 所有测试通过！连接正常。');
    } else {
        console.log('\n⚠️  部分测试失败，请检查配置。');
        
        if (!results.network) {
            console.log('💡 建议: 检查网络连接');
        }
        if (!results.supabaseUrl) {
            console.log('💡 建议: 检查 SUPABASE_URL 是否正确');
        }
        if (!results.supabaseClient) {
            console.log('💡 建议: 检查 SUPABASE_ANON_KEY 是否正确');
        }
        if (!results.serviceClient) {
            console.log('💡 建议: 检查 SUPABASE_SERVICE_ROLE_KEY 是否正确');
        }
    }
}

// 运行测试
runAllTests().catch(console.error); 