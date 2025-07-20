import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000/api/v1';

async function testTagsAPI() {
    try {
        console.log('Testing tags API functionality...');
        
        // 测试数据
        const testInsight = {
            url: 'https://example.com/test-tags-api',
            email: 'test@example.com',
            tags: ['tech', 'test', 'api']
        };
        
        console.log('\n1. Testing insight creation with tags...');
        console.log('Request data:', testInsight);
        
        const response = await fetch(`${API_BASE}/insights`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testInsight)
        });
        
        const result = await response.json();
        console.log('Response status:', response.status);
        console.log('Response data:', result);
        
        if (response.ok) {
            console.log('✅ Tags API test passed!');
            console.log('Created insight with tags:', result.insight?.tags);
        } else {
            console.log('❌ Tags API test failed!');
            console.log('Error:', result.message || result.error);
        }
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

// 检查服务器是否运行
async function checkServer() {
    try {
        const response = await fetch(`${API_BASE}/health`);
        if (response.ok) {
            console.log('✅ Server is running');
            await testTagsAPI();
        } else {
            console.log('❌ Server is not responding properly');
        }
    } catch (error) {
        console.log('❌ Server is not running. Please start the server first:');
        console.log('   cd src/server && npm start');
    }
}

checkServer(); 