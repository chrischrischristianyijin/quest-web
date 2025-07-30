import { createClient } from '@supabase/supabase-js';

console.log('🧪 测试 RLS 问题');
console.log('================');

// 环境变量
const SUPABASE_URL = 'https://wlpitstgjomynzfnqkye.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscGl0c3Rnam9teW56Zm5xa3llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxMzMyNzIsImV4cCI6MjA1OTcwOTI3Mn0.7HpEjNdnfOIeYn4nnooaAhDUqrA8q07nWtxFzVwzHck';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscGl0c3Rnam9teW56Zm5xa3llIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDEzMzI3MiwiZXhwIjoyMDU5NzA5MjcyfQ.dttyUPithJWr51dtpkJ6Ln5XnxZssHBI1tW-OCcbLKw';

// 创建客户端
const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testRLS() {
    console.log('\n🔍 测试 1: 匿名客户端访问 signup 表');
    try {
        const { data, error } = await anonClient
            .from('signup')
            .select('count')
            .limit(1);
        
        if (error) {
            console.log('❌ 匿名客户端失败:', error.message);
            console.log('💡 这可能是 RLS 策略问题');
        } else {
            console.log('✅ 匿名客户端成功');
        }
    } catch (error) {
        console.log('❌ 匿名客户端异常:', error.message);
    }

    console.log('\n🔍 测试 2: 服务角色客户端访问 signup 表');
    try {
        const { data, error } = await serviceClient
            .from('signup')
            .select('count')
            .limit(1);
        
        if (error) {
            console.log('❌ 服务角色客户端失败:', error.message);
        } else {
            console.log('✅ 服务角色客户端成功');
        }
    } catch (error) {
        console.log('❌ 服务角色客户端异常:', error.message);
    }

    console.log('\n🔍 测试 3: 服务角色客户端访问 users 表');
    try {
        const { data, error } = await serviceClient
            .from('users')
            .select('count')
            .limit(1);
        
        if (error) {
            console.log('❌ users 表访问失败:', error.message);
        } else {
            console.log('✅ users 表访问成功');
        }
    } catch (error) {
        console.log('❌ users 表访问异常:', error.message);
    }

    console.log('\n🔍 测试 4: 网络连接测试');
    try {
        const response = await fetch(SUPABASE_URL, { 
            method: 'HEAD',
            signal: AbortSignal.timeout(5000)
        });
        console.log('✅ 网络连接正常，状态码:', response.status);
    } catch (error) {
        console.log('❌ 网络连接失败:', error.message);
    }
}

testRLS().catch(console.error); 