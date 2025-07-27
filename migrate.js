import { supabaseService } from './supabase/config.js';
import fs from 'fs';
import path from 'path';

async function runMigration() {
    try {
        console.log('开始执行数据库迁移...');
        
        // 读取迁移文件
        const migrationPath = path.join(process.cwd(), 'supabase/migrations/20240410_user_profile_follows.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // 分割SQL语句（按分号分割，但要处理函数定义中的分号）
        const statements = migrationSQL.split(/;\s*(?=\n|$)/).filter(stmt => stmt.trim());
        
        console.log(`找到 ${statements.length} 个SQL语句`);
        
        // 逐个执行SQL语句
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i].trim();
            if (statement) {
                console.log(`执行语句 ${i + 1}/${statements.length}...`);
                try {
                    const { error } = await supabaseService.rpc('exec_sql', { 
                        sql: statement 
                    });
                    
                    if (error) {
                        console.error(`语句 ${i + 1} 执行失败:`, error);
                        // 继续执行其他语句
                    } else {
                        console.log(`语句 ${i + 1} 执行成功`);
                    }
                } catch (err) {
                    console.error(`语句 ${i + 1} 执行异常:`, err);
                    // 继续执行其他语句
                }
            }
        }
        
        console.log('数据库迁移完成！');
        
    } catch (error) {
        console.error('迁移执行失败:', error);
        process.exit(1);
    }
}

// 执行迁移
runMigration(); 