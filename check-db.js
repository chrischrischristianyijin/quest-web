import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabase() {
    try {
        console.log('Checking database structure...');
        
        // 检查insights表是否存在
        const { data: insights, error: insightsError } = await supabase
            .from('insights')
            .select('*')
            .limit(1);
            
        if (insightsError) {
            console.error('Error accessing insights table:', insightsError);
            return;
        }
        
        console.log('Insights table exists and is accessible');
        
        // 尝试获取一条记录来查看字段
        const { data: sampleInsight, error: sampleError } = await supabase
            .from('insights')
            .select('*')
            .limit(1)
            .single();
            
        if (sampleError) {
            console.error('Error fetching sample insight:', sampleError);
        } else {
            console.log('Sample insight fields:');
            Object.keys(sampleInsight).forEach(field => {
                console.log(`  - ${field}: ${typeof sampleInsight[field]}`);
            });
        }
        
    } catch (error) {
        console.error('Check failed:', error);
    }
}

checkDatabase(); 