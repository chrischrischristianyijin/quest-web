import { createClient } from '@supabase/supabase-js';
import { config } from '../src/config.js';

const supabaseUrl = config.SUPABASE_URL;
const supabaseKey = config.SUPABASE_ANON_KEY;
const supabaseServiceKey = config.SUPABASE_SERVICE_KEY;

// 验证URL格式
if (!supabaseUrl || !supabaseUrl.startsWith('https://')) {
    console.error('Supabase URL格式错误:', supabaseUrl);
    throw new Error('Invalid Supabase URL format');
}

// 验证API密钥格式
if (!supabaseKey || supabaseKey.length < 20) {
    console.error('Supabase API密钥格式错误:', supabaseKey ? '密钥长度不足' : '未设置');
    throw new Error('Invalid Supabase API key format');
}

// 验证服务角色密钥格式
if (!supabaseServiceKey || supabaseServiceKey.length < 20) {
    console.error('Supabase服务角色密钥格式错误:', supabaseServiceKey ? '密钥长度不足' : '未设置');
    throw new Error('Invalid Supabase service role key format');
}

console.log('Supabase配置检查通过:', {
    url: supabaseUrl,
    keyLength: supabaseKey.length,
    serviceKeyLength: supabaseServiceKey.length
});

// 创建两个客户端实例
const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

// 检查数据库表结构
async function checkDatabaseStructure() {
    try {
        // 检查 users 表
        const { data: usersData, error: usersError } = await supabaseService
            .from('users')
            .select('id')
            .limit(1);
        
        if (usersError) {
            console.error('users表检查失败:', usersError);
            return false;
        }
        
        // 检查 insights 表
        const { data: insightsData, error: insightsError } = await supabaseService
            .from('insights')
            .select('id, title, description, image_url')
            .limit(1);
        
        if (insightsError) {
            console.error('insights表检查失败:', insightsError);
            return false;
        }
        
        console.log('数据库表结构检查通过');
        return true;
    } catch (error) {
        console.error('数据库结构检查失败:', error);
        return false;
    }
}

// Check service role permissions
async function checkServiceRolePermissions() {
    try {
        console.log('Checking service role permissions...');
        const { data, error } = await supabaseService.rpc('check_service_role_permissions');
        
        if (error) {
            console.error('Service role permission check failed:', error);
            return false;
        }

        if (!data) {
            console.error('No permission data returned');
            return false;
        }

        console.log('Service role permissions:', data.permissions);
        console.log('Current role:', data.current_role);

        // Verify all required permissions
        const permissions = data.permissions;
        const hasAllPermissions = permissions.can_create_users && 
                                permissions.can_create_signup;

        if (!hasAllPermissions) {
            console.error('Missing required permissions:', {
                can_create_users: permissions.can_create_users,
                can_create_signup: permissions.can_create_signup
            });
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error checking service role permissions:', error);
        return false;
    }
}

// Execute checks
Promise.all([checkDatabaseStructure(), checkServiceRolePermissions()])
    .then(([dbStructure, permissions]) => {
        if (!dbStructure || !permissions) {
            console.error('One or more checks failed');
        } else {
            console.log('All checks passed successfully');
        }
    })
    .catch(error => {
        console.error('Error during checks:', error);
    });

export { supabase, supabaseService }; 