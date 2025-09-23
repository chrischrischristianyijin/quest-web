/**
 * Email service for Quest
 * Handles Brevo API integration for transactional emails
 */

import { BREVO_CONFIG } from './config.js';
import { api } from './api.js';

class EmailService {
    constructor() {
        // API key is handled server-side for security
        this.apiUrl = BREVO_CONFIG.API_URL;
        this.templateId = BREVO_CONFIG.TEMPLATE_ID;
        this.senderEmail = BREVO_CONFIG.SENDER_EMAIL;
        this.senderName = BREVO_CONFIG.SENDER_NAME;
    }

    /**
     * Send a transactional email via server-side API (secure)
     * @param {Object} emailData - Email data object
     * @param {string} emailData.to - Recipient email
     * @param {string} emailData.toName - Recipient name
     * @param {Object} emailData.params - Template parameters
     * @param {number} emailData.templateId - Brevo template ID (optional)
     * @param {string} emailData.templateName - Brevo template name (optional)
     * @returns {Promise<Object>} API response
     */
    async sendTransactionalEmail(emailData) {
        const {
            to,
            toName,
            params = {},
            templateId = this.templateId,
            templateName = 'My Quest Space Weekly Knowledge Digest'
        } = emailData;

        const payload = {
            to: to,
            toName: toName || to,
            params: params,
            templateId: templateId,
            templateName: templateName,
            subject: "My Quest Space Weekly Knowledge Digest",
            htmlContent: this.generateEmailHTML(params),
            textContent: this.generateEmailText(params)
        };

        try {
            console.log('📧 Sending email via server API:', {
                to: to,
                templateId: templateId,
                params: Object.keys(params)
            });

            // Call server-side email endpoint (API key handled server-side)
            const response = await api.request('/api/v1/email/send', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            if (response.success) {
                console.log('✅ Email sent successfully:', response);
                return {
                    success: true,
                    messageId: response.messageId,
                    data: response
                };
            } else {
                console.error('❌ Email sending failed:', response.error);
                return {
                    success: false,
                    error: response.error || 'Unknown error'
                };
            }

        } catch (error) {
            console.error('❌ Email sending failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send test email with sample data
     * @param {string} email - Test email address
     * @returns {Promise<Object>} API response
     */
    async sendTestEmail(email) {
        const testParams = {
            weekly_collection: "📚 **Work**: 'Meeting Notes from Q4 Planning', 'Project Updates'\n📝 **Personal**: 'Book Highlights from Atomic Habits', 'Fitness Goals'",
            ai_summary: "This week you captured valuable insights about work productivity and personal development. Your notes show a focus on planning and self-improvement, with actionable items for both professional and personal growth.",
            recommended_tag: "Work",
            recommended_articles: "Effective Meeting Strategies, Goal Setting Techniques",
            login_url: "https://myquestspace.com/my-space",
            unsubscribe_url: "https://myquestspace.com/unsubscribe?token=test-token"
        };

        return this.sendTransactionalEmail({
            to: email,
            toName: 'Test User',
            params: testParams
        });
    }

    /**
     * Send weekly digest email
     * @param {Object} digestData - Digest data
     * @param {string} digestData.userEmail - User email
     * @param {string} digestData.userName - User name
     * @param {Array} digestData.tags - Array of tags with articles
     * @param {string} digestData.aiSummary - AI generated summary
     * @param {string} digestData.recommendedTag - Recommended tag name
     * @param {string} digestData.recommendedArticles - Recommended articles
     * @param {string} digestData.unsubscribeToken - Unsubscribe token
     * @returns {Promise<Object>} API response
     */
    async sendWeeklyDigest(digestData) {
        const {
            userEmail,
            userName,
            tags = [],
            aiSummary,
            recommendedTag,
            recommendedArticles,
            unsubscribeToken
        } = digestData;

        // Format tags for template
        const formattedTags = tags.map(tag => ({
            name: tag.name,
            articles: Array.isArray(tag.articles) ? tag.articles.join(', ') : tag.articles
        }));

        const params = {
            weekly_collection: formattedTags.map(tag => 
                `**${tag.name}**: ${tag.articles}`
            ).join('\n'),
            ai_summary: aiSummary || 'No summary available this week.',
            recommended_tag: recommendedTag || 'General',
            recommended_articles: recommendedArticles || 'Check out our latest insights',
            login_url: `${window.location.origin}/my-space`,
            unsubscribe_url: `${window.location.origin}/unsubscribe?token=${unsubscribeToken}`
        };

        return this.sendTransactionalEmail({
            to: userEmail,
            toName: userName,
            params: params
        });
    }

    /**
     * Set template ID
     * @param {number} templateId - Brevo template ID
     */
    setTemplateId(templateId) {
        this.templateId = templateId;
        BREVO_CONFIG.TEMPLATE_ID = templateId;
    }

    /**
     * Get template ID
     * @returns {number|null} Current template ID
     */
    getTemplateId() {
        return this.templateId;
    }

    /**
     * Validate email address
     * @param {string} email - Email to validate
     * @returns {boolean} Is valid email
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Generate HTML content for email
     * @param {Object} params - Email parameters
     * @returns {string} HTML content
     */
    generateEmailHTML(params) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Quest Space Weekly Knowledge Digest</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <h2 style="color: #2563eb;">My Quest Space Weekly Knowledge Digest</h2>
    
    <p>Hi there,</p>
    
    <p>To better utilize your second brain, please check out the following knowledge review report!</p>
    
    <h3 style="color: #1f2937; margin-top: 30px;">This Week's Collection:</h3>
    
    <div style="margin: 15px 0; padding: 10px; background-color: #f9fafb; border-left: 4px solid #2563eb;">
        ${params.weekly_collection || 'No content this week.'}
    </div>
    
    <h3 style="color: #1f2937; margin-top: 30px;">AI Summary:</h3>
    <div style="background-color: #f0f9ff; padding: 15px; border-radius: 8px; margin: 15px 0;">
        ${params.ai_summary || 'No summary available this week.'}
    </div>
    
    <h3 style="color: #1f2937; margin-top: 30px;">This Week's Recommendations:</h3>
    <p>Your followed <strong>${params.recommended_tag || 'General'}</strong> featured articles this week: ${params.recommended_articles || 'Check out our latest insights'}</p>
    
    <div style="text-align: center; margin: 40px 0;">
        <a href="${params.login_url || 'https://myquestspace.com/my-space'}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Open Quest - Login to Review Your Knowledge Base
        </a>
    </div>
    
    <p style="text-align: center; color: #6b7280; font-style: italic; margin-top: 30px;">
        Your second brain is not a storage repository, but a thinking accelerator
    </p>
    
    <hr style="margin: 40px 0; border: none; border-top: 1px solid #e5e7eb;">
    
    <div style="text-align: center; font-size: 12px; color: #9ca3af;">
        <p>
            <a href="${params.unsubscribe_url || 'https://myquestspace.com/unsubscribe'}" style="color: #6b7280;">Unsubscribe</a> | 
            <a href="mailto:contact@myquestspace.com" style="color: #6b7280;">Contact Support</a>
        </p>
        <p>&copy; 2024 Quest. All rights reserved.</p>
    </div>
    
</body>
</html>`;
    }

    /**
     * Generate text content for email
     * @param {Object} params - Email parameters
     * @returns {string} Text content
     */
    generateEmailText(params) {
        return `
My Quest Space Weekly Knowledge Digest

Hi there,

To better utilize your second brain, please check out the following knowledge review report!

This Week's Collection:
${params.weekly_collection || 'No content this week.'}

AI Summary:
${params.ai_summary || 'No summary available this week.'}

This Week's Recommendations:
Your followed ${params.recommended_tag || 'General'} featured articles this week: ${params.recommended_articles || 'Check out our latest insights'}

Open Quest - Login to Review Your Knowledge Base
${params.login_url || 'https://myquestspace.com/my-space'}

Your second brain is not a storage repository, but a thinking accelerator

---
Unsubscribe: ${params.unsubscribe_url || 'https://myquestspace.com/unsubscribe'}
Contact Support: contact@myquestspace.com
© 2024 Quest. All rights reserved.
`;
    }

    /**
     * Get email delivery status via server API (secure)
     * @param {string} messageId - Message ID from send response
     * @returns {Promise<Object>} Delivery status
     */
    async getEmailStatus(messageId) {
        try {
            const response = await api.request(`/api/v1/email/status/${messageId}`, {
                method: 'GET'
            });

            return response;
        } catch (error) {
            console.error('❌ Failed to get email status:', error);
            throw error;
        }
    }

    /**
     * Get email service status via server API (secure)
     * @returns {Promise<Object>} Service status
     */
    async getServiceStatus() {
        try {
            const response = await api.request('/api/v1/email/status', {
                method: 'GET'
            });

            return response;
        } catch (error) {
            console.error('❌ Failed to get email service status:', error);
            throw error;
        }
    }
}

// Create singleton instance
const emailService = new EmailService();

// Export for use in other modules
export { EmailService, emailService };
