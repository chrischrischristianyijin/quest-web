import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api/v1';

async function testInsightsAPI() {
    try {
        console.log('Testing insights API...');
        
        // 测试邮箱 - 请替换为实际的测试邮箱
        const testEmail = 'test@example.com'; // 替换为实际邮箱
        
        console.log('\n1. Testing insights API for email:', testEmail);
        
        const response = await fetch(`${API_BASE}/insights?email=${encodeURIComponent(testEmail)}`);
        console.log('Response status:', response.status);
        
        const data = await response.json();
        console.log('Response data:', data);
        
        if (response.ok) {
            console.log('✅ API call successful');
            console.log('Insights count:', data.insights ? data.insights.length : 0);
            
            if (data.insights && data.insights.length > 0) {
                console.log('\nFirst insight sample:');
                console.log('- ID:', data.insights[0].id);
                console.log('- Title:', data.insights[0].title);
                console.log('- URL:', data.insights[0].url);
                console.log('- Created:', data.insights[0].created_at);
                console.log('- Tags:', data.insights[0].tags);
            } else {
                console.log('No insights found for this user');
            }
        } else {
            console.log('❌ API call failed');
            console.log('Error:', data.error || 'Unknown error');
        }
        
        // 测试用户资料API
        console.log('\n2. Testing user profile API...');
        const profileResponse = await fetch(`${API_BASE}/user/profile/${encodeURIComponent(testEmail)}`);
        console.log('Profile response status:', profileResponse.status);
        
        const profileData = await profileResponse.json();
        console.log('Profile data:', profileData);
        
        if (profileResponse.ok) {
            console.log('✅ Profile API call successful');
        } else {
            console.log('❌ Profile API call failed');
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
        await testInsightsAPI();
    } catch (error) {
        console.log('❌ Server is not running. Please start the server first:');
        console.log('   cd src/server && npm start');
    }
}

checkServer(); 