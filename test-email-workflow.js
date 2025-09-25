// Email Workflow Test - Direct API Testing
console.log('🧪 Testing Email Workflow via Direct API...');

// Test function that uses API directly instead of global emailService
window.testEmailWorkflowAPI = async function(testEmail = 'stao042906@gmail.com') {
    console.log('🚀 Starting Email Workflow Test via API...');
    
    try {
        // Step 1: Test AI Summary Generation
        console.log('\n🤖 Step 1: Testing AI Summary Generation...');
        const digestResponse = await api.request('/api/v1/email/digest/preview');
        
        if (digestResponse.ok && digestResponse.params) {
            console.log('✅ AI Summary generation successful!');
            console.log('📊 AI Summary Preview:', digestResponse.params.ai_summary?.substring(0, 200) + '...');
            console.log('📋 Tags found:', digestResponse.params.tags?.length || 0);
            
            // Step 2: Send Test Email
            console.log('\n📧 Step 2: Sending Test Email...');
            
            const emailResponse = await api.request(`/api/v1/email/digest/test-send?force=true&dry_run=false&email_override=${encodeURIComponent(testEmail)}`, {
                method: 'POST'
            });
            
            if (emailResponse.ok || emailResponse.success) {
                console.log('✅ Test email sent successfully!');
                console.log('📧 Email sent to:', testEmail);
                console.log('📊 Response:', emailResponse);
            } else {
                console.error('❌ Test email failed:', emailResponse);
            }
            
        } else {
            console.log('⚠️ AI Summary generation response:', digestResponse);
        }
        
    } catch (error) {
        console.error('❌ Error in email workflow test:', error);
    }
    
    console.log('\n🎉 Email Workflow Test Finished!');
    console.log('📋 Check your email inbox for the test email');
};

// Test function for force sending to all users
window.testForceSendAll = async function() {
    console.log('🚀 Testing Force Send to All Users...');
    
    try {
        const response = await api.request('/api/v1/email/digest/send-all?dry_run=false&force=true&confirmed=true', {
            method: 'POST'
        });
        
        if (response.success) {
            console.log('✅ Force send successful!');
            console.log('📊 Response:', response);
        } else {
            console.error('❌ Force send failed:', response);
        }
        
    } catch (error) {
        console.error('❌ Error in force send test:', error);
    }
};

// Auto-run the test
console.log('🎯 Available test functions:');
console.log('  - testEmailWorkflowAPI("your-email@example.com") - Test single email');
console.log('  - testForceSendAll() - Send to all users (admin required)');
console.log('  - api.request("/api/v1/email/digest/preview") - Preview digest');

// Run the test automatically
testEmailWorkflowAPI('stao042906@gmail.com');
