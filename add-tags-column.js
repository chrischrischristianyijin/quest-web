import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // 使用service role key来执行DDL

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addTagsColumn() {
    try {
        console.log('Adding tags column to insights table...');
        
        // 添加tags列
        const { error: addColumnError } = await supabase.rpc('exec_sql', {
            sql: `
                ALTER TABLE public.insights 
                ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
            `
        });
        
        if (addColumnError) {
            console.error('Error adding tags column:', addColumnError);
            
            // 尝试直接执行SQL
            console.log('Trying alternative approach...');
            const { error: directError } = await supabase
                .from('insights')
                .select('*')
                .limit(0); // 这只是一个测试查询
                
            if (directError) {
                console.error('Direct query error:', directError);
            }
        } else {
            console.log('Tags column added successfully');
        }
        
        // 验证字段是否添加成功
        const { data: sampleInsight, error: sampleError } = await supabase
            .from('insights')
            .select('*')
            .limit(1)
            .single();
            
        if (sampleError) {
            console.error('Error fetching sample insight:', sampleError);
        } else {
            console.log('Current insight fields:');
            Object.keys(sampleInsight).forEach(field => {
                console.log(`  - ${field}: ${typeof sampleInsight[field]}`);
            });
        }
        
    } catch (error) {
        console.error('Add tags column failed:', error);
    }
}

addTagsColumn(); 