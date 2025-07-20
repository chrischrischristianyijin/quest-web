import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api/v1';

async function testDelete() {
    try {
        console.log('Testing delete functionality...');
        
        // 1. 先获取用户的insights
        const testEmail = 'test@example.com'; // 替换为实际测试邮箱
        console.log('\n1. Getting insights for user:', testEmail);
        
        const insightsResponse = await fetch(`${API_BASE}/insights?email=${encodeURIComponent(testEmail)}`);
        const insightsResult = await insightsResponse.json();
        
        if (!insightsResponse.ok) {
            console.log('❌ Failed to get insights:', insightsResult);
            return;
        }
        
        console.log('✅ Got insights:', insightsResult.insights.length);
        
        if (insightsResult.insights.length === 0) {
            console.log('No insights to delete');
            return;
        }
        
        // 2. 删除第一个insight
        const firstInsight = insightsResult.insights[0];
        console.log('\n2. Deleting insight:', firstInsight.id);
        
        const deleteResponse = await fetch(`${API_BASE}/insights/${firstInsight.id}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: testEmail
            })
        });
        
        console.log('Delete response status:', deleteResponse.status);
        
        if (deleteResponse.ok) {
            console.log('✅ Insight deleted successfully');
        } else {
            const errorData = await deleteResponse.json().catch(() => ({}));
            console.log('❌ Delete failed:', errorData);
        }
        
        // 3. 验证删除结果
        console.log('\n3. Verifying deletion...');
        const verifyResponse = await fetch(`${API_BASE}/insights?email=${encodeURIComponent(testEmail)}`);
        const verifyResult = await verifyResponse.json();
        
        if (verifyResponse.ok) {
            console.log('Remaining insights:', verifyResult.insights.length);
            const stillExists = verifyResult.insights.some(i => i.id === firstInsight.id);
            if (!stillExists) {
                console.log('✅ Insight was successfully deleted from database');
            } else {
                console.log('❌ Insight still exists in database');
            }
        }
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

// 检查服务器是否运行
async function checkServer() {
    try {
        const response = await fetch(`${API_BASE}/insights`);
        console.log('✅ Server is running');
        await testDelete();
    } catch (error) {
        console.log('❌ Server is not running. Please start the server first:');
        console.log('   cd src/server && npm start');
    }
}

checkServer(); 