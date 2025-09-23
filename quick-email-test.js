/**
 * Quick Email System Test - MAIN BRANCH
 * 
 * Instructions:
 * 1. Go to http://localhost:8080/email-preferences
 * 2. Open Console (F12)
 * 3. Paste this script
 * 4. Press Enter
 */

console.log('🚀 Quick Email System Test - MAIN BRANCH');

// Note: API key is handled server-side for security
console.log('🔒 Email system uses secure server-side API key handling');

// Quick test function
const quickTest = () => {
    console.log('\n📧 Email Service Test:');
    if (typeof emailService !== 'undefined') {
        console.log('✅ Email Service Available');
        console.log('   API Key: Handled server-side (secure)');
        console.log('   Sender:', emailService.senderEmail);
        
        // Test email validation
        console.log('\n✅ Email Validation Test:');
        console.log('   test@example.com:', emailService.isValidEmail('test@example.com'));
        console.log('   invalid-email:', emailService.isValidEmail('invalid-email'));
        
        // Test template generation
        console.log('\n📝 Template Test:');
        const params = {
            weekly_collection: "Test collection",
            ai_summary: "Test summary",
            recommended_tag: "Test",
            recommended_articles: "Test articles",
            login_url: "https://test.com",
            unsubscribe_url: "https://test.com/unsubscribe"
        };
        
        const html = emailService.generateEmailHTML(params);
        const text = emailService.generateEmailText(params);
        console.log('   HTML Length:', html.length);
        console.log('   Text Length:', text.length);
        console.log('✅ Templates Generated');
        
    } else {
        console.log('❌ Email Service Not Available');
    }
    
    console.log('\n⚙️ Preferences Test:');
    if (typeof EmailPreferencesManager !== 'undefined') {
        console.log('✅ Preferences Manager Available');
        
        // Test localStorage
        const testPrefs = { weekly_digest_enabled: true, preferred_day: 1 };
        localStorage.setItem('quest_email_preferences', JSON.stringify(testPrefs));
        const loaded = JSON.parse(localStorage.getItem('quest_email_preferences'));
        console.log('✅ LocalStorage Working:', loaded.weekly_digest_enabled);
    } else {
        console.log('❌ Preferences Manager Not Available');
    }
    
    console.log('\n🔌 API Test:');
    if (typeof api !== 'undefined') {
        console.log('✅ API Service Available');
        console.log('   Base URL:', api.baseUrl);
    } else {
        console.log('❌ API Service Not Available');
    }
    
    console.log('\n🎉 Quick Test Complete!');
    console.log('\n💡 Next Steps:');
    console.log('   1. Set BREVO_API_KEY environment variable on server');
    console.log('   2. Implement server-side email endpoints');
    console.log('   3. Test actual email sending');
};

// Run the test
quickTest();
