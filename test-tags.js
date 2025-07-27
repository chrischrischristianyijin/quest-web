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

async function testTags() {
    try {
        console.log('Testing tags functionality...');
        
        // 1. 检查insights表结构
        console.log('\n1. Checking insights table structure...');
        const { data: tableInfo, error: tableError } = await supabase
            .from('information_schema.columns')
            .select('column_name, data_type')
            .eq('table_name', 'insights')
            .eq('table_schema', 'public');
            
        if (tableError) {
            console.error('Error checking table structure:', tableError);
        } else {
            console.log('Insights table columns:');
            tableInfo.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type}`);
            });
        }
        
        // 2. 查看最近的insights数据
        console.log('\n2. Checking recent insights with tags...');
        const { data: insights, error: insightsError } = await supabase
            .from('insights')
            .select('id, url, title, tags, created_at')
            .order('created_at', { ascending: false })
            .limit(5);
            
        if (insightsError) {
            console.error('Error fetching insights:', insightsError);
        } else {
            console.log(`Found ${insights.length} recent insights:`);
            insights.forEach((insight, index) => {
                console.log(`  ${index + 1}. ${insight.title}`);
                console.log(`     URL: ${insight.url}`);
                console.log(`     Tags: ${JSON.stringify(insight.tags)}`);
                console.log(`     Created: ${insight.created_at}`);
                console.log('');
            });
        }
        
        // 3. 测试插入带tags的数据
        console.log('\n3. Testing insertion with tags...');
        const testData = {
            url: 'https://example.com/test-tags',
            title: 'Test Insight with Tags',
            description: 'This is a test insight with tags',
            image_url: '',
            tags: ['test', 'example', 'demo'],
            user_id: '00000000-0000-0000-0000-000000000000' // 使用一个测试用户ID
        };
        
        const { data: newInsight, error: insertError } = await supabase
            .from('insights')
            .insert([testData])
            .select()
            .single();
            
        if (insertError) {
            console.error('Error inserting test data:', insertError);
        } else {
            console.log('Successfully inserted test insight with tags:');
            console.log(`  ID: ${newInsight.id}`);
            console.log(`  Tags: ${JSON.stringify(newInsight.tags)}`);
            
            // 清理测试数据
            const { error: deleteError } = await supabase
                .from('insights')
                .delete()
                .eq('id', newInsight.id);
                
            if (deleteError) {
                console.error('Error cleaning up test data:', deleteError);
            } else {
                console.log('Test data cleaned up successfully');
            }
        }
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testTags(); 