/**
 * Quest Email System Console Test Script - MAIN BRANCH
 * 
 * Instructions:
 * 1. Open your browser and go to http://localhost:8080/email-preferences
 * 2. Open Developer Tools (F12)
 * 3. Go to Console tab
 * 4. Copy and paste this entire script
 * 5. Press Enter to run the tests
 */

console.log('🧪 Quest Email System Console Test Suite - MAIN BRANCH');
console.log('====================================================');

// Note: API key is handled server-side for security
console.log('🔒 Email system uses secure server-side API key handling');

// Test 1: Check if email service is available
console.log('\n1. 📧 Checking Email Service Availability...');
try {
    if (typeof emailService !== 'undefined') {
        console.log('✅ Email Service: Available');
        console.log('   API Key: Handled server-side (secure)');
        console.log('   API URL:', emailService.apiUrl);
        console.log('   Template ID:', emailService.templateId || 'Not set');
        console.log('   Sender Email:', emailService.senderEmail);
        console.log('   Sender Name:', emailService.senderName);
    } else {
        console.log('❌ Email Service: Not available');
        console.log('   Make sure you are on the email-preferences page');
    }
} catch (error) {
    console.log('❌ Email Service Error:', error.message);
}

// Test 2: Email Validation
console.log('\n2. ✅ Testing Email Validation...');
if (typeof emailService !== 'undefined') {
    const testEmails = [
        'test@example.com',
        'user@domain.co.uk',
        'invalid-email',
        'user@',
        '@domain.com',
        'user.name@domain.com',
        'user+tag@domain.com'
    ];
    
    testEmails.forEach(email => {
        const isValid = emailService.isValidEmail(email);
        console.log(`   ${isValid ? '✅' : '❌'} ${email} - ${isValid ? 'Valid' : 'Invalid'}`);
    });
} else {
    console.log('   ⚠️ Skipped - Email service not available');
}

// Test 3: Template Generation
console.log('\n3. 📝 Testing Template Generation...');
if (typeof emailService !== 'undefined') {
    try {
        const sampleParams = {
            weekly_collection: "📚 **Work**: 'Meeting Notes from Q4 Planning', 'Project Updates'\n📝 **Personal**: 'Book Highlights from Atomic Habits', 'Fitness Goals'",
            ai_summary: "This week you captured valuable insights about work productivity and personal development. Your notes show a focus on planning and self-improvement, with actionable items for both professional and personal growth.",
            recommended_tag: "Work",
            recommended_articles: "Effective Meeting Strategies, Goal Setting Techniques",
            login_url: "https://myquestspace.com/my-space",
            unsubscribe_url: "https://myquestspace.com/unsubscribe?token=test-token"
        };

        const html = emailService.generateEmailHTML(sampleParams);
        const text = emailService.generateEmailText(sampleParams);
        
        console.log('   ✅ HTML Template Generated:', html.length, 'characters');
        console.log('   ✅ Text Template Generated:', text.length, 'characters');
        console.log('   📋 HTML Preview (first 200 chars):');
        console.log('   ' + html.substring(0, 200) + '...');
        console.log('   📋 Text Preview (first 200 chars):');
        console.log('   ' + text.substring(0, 200) + '...');
    } catch (error) {
        console.log('   ❌ Template Generation Error:', error.message);
    }
} else {
    console.log('   ⚠️ Skipped - Email service not available');
}

// Test 4: Email Preferences Manager
console.log('\n4. ⚙️ Testing Email Preferences Manager...');
try {
    if (typeof EmailPreferencesManager !== 'undefined') {
        console.log('   ✅ EmailPreferencesManager: Available');
        
        // Test preferences structure
        const testPreferences = {
            weekly_digest_enabled: true,
            preferred_day: 1, // Monday
            preferred_hour: 9, // 9 AM
            timezone: 'America/Los_Angeles',
            no_activity_policy: 'skip'
        };
        
        console.log('   📋 Test Preferences Structure:');
        console.log('   ', JSON.stringify(testPreferences, null, 2));
        
        // Test localStorage operations
        localStorage.setItem('quest_email_preferences', JSON.stringify(testPreferences));
        const loaded = JSON.parse(localStorage.getItem('quest_email_preferences'));
        
        if (JSON.stringify(loaded) === JSON.stringify(testPreferences)) {
            console.log('   ✅ LocalStorage Operations: Working');
        } else {
            console.log('   ❌ LocalStorage Operations: Failed');
        }
    } else {
        console.log('   ❌ EmailPreferencesManager: Not available');
    }
} catch (error) {
    console.log('   ❌ Preferences Manager Error:', error.message);
}

// Test 5: API Service
console.log('\n5. 🔌 Testing API Service...');
try {
    if (typeof api !== 'undefined') {
        console.log('   ✅ API Service: Available');
        console.log('   Base URL:', api.baseUrl);
        
        // Test API configuration
        if (api.baseUrl) {
            console.log('   ✅ API Base URL: Configured');
        } else {
            console.log('   ❌ API Base URL: Not configured');
        }
    } else {
        console.log('   ❌ API Service: Not available');
    }
} catch (error) {
    console.log('   ❌ API Service Error:', error.message);
}

// Test 6: Send Test Email (if email service is available)
console.log('\n6. 📤 Testing Email Sending...');
if (typeof emailService !== 'undefined') {
    console.log('   🔒 Testing email sending via secure server API...');
    
    // Create a test email function
    const testEmailSending = async () => {
        try {
            const testEmail = prompt('Enter email address for test (or cancel to skip):');
            if (!testEmail) {
                console.log('   ⚠️ Test email skipped');
                return;
            }
            
            console.log('   📧 Sending test email to:', testEmail);
            const result = await emailService.sendTestEmail(testEmail);
            
            if (result.success) {
                console.log('   ✅ Test email sent successfully!');
                console.log('   Message ID:', result.messageId);
            } else {
                console.log('   ❌ Test email failed:', result.error);
            }
        } catch (error) {
            console.log('   ❌ Test email error:', error.message);
        }
    };
    
    // Run the test
    testEmailSending();
} else {
    console.log('   ⚠️ Skipped - Email service not available');
    console.log('   Note: Email sending requires server-side API endpoints to be implemented');
}

// Test 7: Weekly Digest Test
console.log('\n7. 📊 Testing Weekly Digest...');
if (typeof emailService !== 'undefined') {
    try {
        const digestData = {
            userEmail: 'test@example.com',
            userName: 'Test User',
            tags: [
                { name: 'Work', articles: ['Meeting Notes', 'Project Updates', 'Client Feedback'] },
                { name: 'Personal', articles: ['Book Highlights', 'Fitness Goals', 'Travel Plans'] },
                { name: 'Ideas', articles: ['New Product Concept', 'Marketing Strategy'] }
            ],
            aiSummary: 'This week you captured valuable insights about work productivity, personal development, and creative thinking. Your notes show a balanced approach to professional growth and personal well-being.',
            recommendedTag: 'Work',
            recommendedArticles: 'Effective Meeting Strategies, Goal Setting Techniques, Time Management Tips',
            unsubscribeToken: 'test-unsubscribe-token-123'
        };
        
        console.log('   📋 Sample Digest Data:');
        console.log('   - User:', digestData.userName, '(' + digestData.userEmail + ')');
        console.log('   - Tags:', digestData.tags.length, 'categories');
        console.log('   - AI Summary:', digestData.aiSummary.length, 'characters');
        console.log('   - Recommended Tag:', digestData.recommendedTag);
        console.log('   - Recommended Articles:', digestData.recommendedArticles);
        console.log('   - Unsubscribe Token:', digestData.unsubscribeToken);
        
        // Test digest formatting
        const formattedTags = digestData.tags.map(tag => ({
            name: tag.name,
            articles: Array.isArray(tag.articles) ? tag.articles.join(', ') : tag.articles
        }));
        
        const weeklyCollection = formattedTags.map(tag => 
            `**${tag.name}**: ${tag.articles}`
        ).join('\n');
        
        console.log('   ✅ Digest Formatting: Working');
        console.log('   📋 Formatted Weekly Collection:');
        console.log('   ' + weeklyCollection);
        
    } catch (error) {
        console.log('   ❌ Weekly Digest Error:', error.message);
    }
} else {
    console.log('   ⚠️ Skipped - Email service not available');
}

// Test 8: Browser Environment Check
console.log('\n8. 🌐 Browser Environment Check...');
console.log('   User Agent:', navigator.userAgent);
console.log('   Current URL:', window.location.href);
console.log('   Local Storage Available:', typeof Storage !== 'undefined');
console.log('   Fetch Available:', typeof fetch !== 'undefined');
console.log('   Console Available:', typeof console !== 'undefined');

// Test 9: Configuration Check
console.log('\n9. ⚙️ Configuration Check...');
try {
    if (typeof BREVO_CONFIG !== 'undefined') {
        console.log('   ✅ BREVO_CONFIG: Available');
        console.log('   API Key: Handled server-side (secure)');
        console.log('   API URL:', BREVO_CONFIG.API_URL);
        console.log('   Template ID:', BREVO_CONFIG.TEMPLATE_ID || 'Not set');
        console.log('   Sender Email:', BREVO_CONFIG.SENDER_EMAIL);
        console.log('   Sender Name:', BREVO_CONFIG.SENDER_NAME);
    } else {
        console.log('   ❌ BREVO_CONFIG: Not available');
    }
} catch (error) {
    console.log('   ❌ Configuration Error:', error.message);
}

// Summary
console.log('\n🎉 Test Suite Complete!');
console.log('=====================');
console.log('📋 Summary:');
console.log('   - Email Service: ' + (typeof emailService !== 'undefined' ? '✅ Available' : '❌ Not Available'));
console.log('   - Preferences Manager: ' + (typeof EmailPreferencesManager !== 'undefined' ? '✅ Available' : '❌ Not Available'));
console.log('   - API Service: ' + (typeof api !== 'undefined' ? '✅ Available' : '❌ Not Available'));
console.log('   - Configuration: ' + (typeof BREVO_CONFIG !== 'undefined' ? '✅ Available' : '❌ Not Available'));

console.log('\n💡 Next Steps:');
console.log('   1. If email service is available, test sending emails');
console.log('   2. Check email preferences page functionality');
console.log('   3. Verify template generation and formatting');
console.log('   4. Test API endpoints if server is running');

console.log('\n🔧 To test email sending:');
console.log('   - Set BREVO_API_KEY environment variable on your server');
console.log('   - Implement server-side email endpoints');
console.log('   - Run the email sending test above');

console.log('\n📚 For more detailed testing, visit:');
console.log('   http://localhost:8080/email-preferences');
