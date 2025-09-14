/**
 * Email preferences management for Quest
 * Handles user email settings, digest preview, and unsubscribe functionality
 */

import { api } from './api.js';
import { auth } from './auth.js';

class EmailPreferencesManager {
    constructor() {
        this.preferences = null;
        this.isLoading = false;
        this.init();
    }

    init() {
        this.loadPreferences();
        this.setupEventListeners();
    }

    async loadPreferences() {
        try {
            this.isLoading = true;
            this.showLoadingState();

            const response = await api.request('/api/v1/email/preferences');
            
            if (response.success) {
                this.preferences = response.preferences;
                this.renderPreferences();
            } else {
                this.showError('Failed to load email preferences');
            }
        } catch (error) {
            console.error('Error loading email preferences:', error);
            this.showError('Failed to load email preferences');
        } finally {
            this.isLoading = false;
            this.hideLoadingState();
        }
    }

    async savePreferences() {
        try {
            this.isLoading = true;
            this.showSavingState();

            const formData = this.getFormData();
            const response = await api.request('/api/v1/email/preferences', {
                method: 'PUT',
                body: JSON.stringify(formData)
            });

            if (response.success) {
                this.preferences = { ...this.preferences, ...formData };
                this.showSuccess('Email preferences saved successfully');
                this.renderPreferences();
            } else {
                this.showError('Failed to save email preferences');
            }
        } catch (error) {
            console.error('Error saving email preferences:', error);
            this.showError('Failed to save email preferences');
        } finally {
            this.isLoading = false;
            this.hideSavingState();
        }
    }

    async previewDigest() {
        try {
            this.isLoading = true;
            this.showPreviewLoadingState();

            const response = await api.request('/api/v1/email/digest/preview');
            
            if (response.success) {
                this.showDigestPreview(response.preview);
            } else {
                this.showError('Failed to generate digest preview');
            }
        } catch (error) {
            console.error('Error generating digest preview:', error);
            this.showError('Failed to generate digest preview');
        } finally {
            this.isLoading = false;
            this.hidePreviewLoadingState();
        }
    }

    async sendTestEmail() {
        try {
            const email = prompt('Enter email address for test:');
            if (!email) return;

            if (!this.isValidEmail(email)) {
                this.showError('Please enter a valid email address');
                return;
            }

            this.isLoading = true;
            this.showTestSendingState();

            const response = await api.request('/api/v1/email/test', {
                method: 'POST',
                body: JSON.stringify({ email })
            });

            if (response.success) {
                this.showSuccess('Test email sent successfully');
            } else {
                this.showError('Failed to send test email');
            }
        } catch (error) {
            console.error('Error sending test email:', error);
            this.showError('Failed to send test email');
        } finally {
            this.isLoading = false;
            this.hideTestSendingState();
        }
    }

    getFormData() {
        return {
            weekly_digest_enabled: document.getElementById('weeklyDigestEnabled').checked,
            preferred_day: parseInt(document.getElementById('preferredDay').value),
            preferred_hour: parseInt(document.getElementById('preferredHour').value),
            timezone: document.getElementById('timezone').value,
            no_activity_policy: document.getElementById('noActivityPolicy').value
        };
    }

    renderPreferences() {
        if (!this.preferences) return;

        // Update form fields
        document.getElementById('weeklyDigestEnabled').checked = this.preferences.weekly_digest_enabled;
        document.getElementById('preferredDay').value = this.preferences.preferred_day;
        document.getElementById('preferredHour').value = this.preferences.preferred_hour;
        document.getElementById('timezone').value = this.preferences.timezone;
        document.getElementById('noActivityPolicy').value = this.preferences.no_activity_policy;

        // Update UI state
        this.updateUIState();
    }

    updateUIState() {
        const isEnabled = this.preferences?.weekly_digest_enabled;
        const formFields = document.querySelectorAll('.email-preference-field');
        
        formFields.forEach(field => {
            field.disabled = !isEnabled;
        });

        // Update preview button state
        const previewBtn = document.getElementById('previewDigestBtn');
        if (previewBtn) {
            previewBtn.disabled = !isEnabled || this.isLoading;
        }
    }

    showDigestPreview(preview) {
        // Create modal for preview
        const modal = document.createElement('div');
        modal.className = 'email-preview-modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.closest('.email-preview-modal').remove()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>Digest Preview</h3>
                        <button class="close-btn" onclick="this.closest('.email-preview-modal').remove()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="preview-tabs">
                            <button class="tab-btn active" onclick="this.showPreviewTab('html')">HTML</button>
                            <button class="tab-btn" onclick="this.showPreviewTab('text')">Text</button>
                            <button class="tab-btn" onclick="this.showPreviewTab('raw')">Raw Data</button>
                        </div>
                        <div class="preview-content">
                            <div id="htmlPreview" class="preview-tab active">
                                <div class="email-preview-frame">
                                    ${preview.html_content}
                                </div>
                            </div>
                            <div id="textPreview" class="preview-tab">
                                <pre>${preview.text_content}</pre>
                            </div>
                            <div id="rawPreview" class="preview-tab">
                                <pre>${JSON.stringify(preview.payload, null, 2)}</pre>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add tab switching functionality
        window.showPreviewTab = (tab) => {
            document.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            
            document.getElementById(tab + 'Preview').classList.add('active');
            event.target.classList.add('active');
        };
    }

    setupEventListeners() {
        // Save button
        const saveBtn = document.getElementById('saveEmailPreferences');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.savePreferences());
        }

        // Preview button
        const previewBtn = document.getElementById('previewDigestBtn');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => this.previewDigest());
        }

        // Test email button
        const testBtn = document.getElementById('sendTestEmail');
        if (testBtn) {
            testBtn.addEventListener('click', () => this.sendTestEmail());
        }

        // Toggle weekly digest
        const toggle = document.getElementById('weeklyDigestEnabled');
        if (toggle) {
            toggle.addEventListener('change', () => this.updateUIState());
        }

        // Form validation
        const form = document.getElementById('emailPreferencesForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.savePreferences();
            });
        }
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    showLoadingState() {
        const saveBtn = document.getElementById('saveEmailPreferences');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Loading...';
        }
    }

    hideLoadingState() {
        const saveBtn = document.getElementById('saveEmailPreferences');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Preferences';
        }
    }

    showSavingState() {
        const saveBtn = document.getElementById('saveEmailPreferences');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Saving...';
        }
    }

    hideSavingState() {
        const saveBtn = document.getElementById('saveEmailPreferences');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Preferences';
        }
    }

    showPreviewLoadingState() {
        const previewBtn = document.getElementById('previewDigestBtn');
        if (previewBtn) {
            previewBtn.disabled = true;
            previewBtn.textContent = 'Generating Preview...';
        }
    }

    hidePreviewLoadingState() {
        const previewBtn = document.getElementById('previewDigestBtn');
        if (previewBtn) {
            previewBtn.disabled = false;
            previewBtn.textContent = 'Preview Digest';
        }
    }

    showTestSendingState() {
        const testBtn = document.getElementById('sendTestEmail');
        if (testBtn) {
            testBtn.disabled = true;
            testBtn.textContent = 'Sending...';
        }
    }

    hideTestSendingState() {
        const testBtn = document.getElementById('sendTestEmail');
        if (testBtn) {
            testBtn.disabled = false;
            testBtn.textContent = 'Send Test Email';
        }
    }

    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showError(message) {
        this.showMessage(message, 'error');
    }

    showMessage(message, type) {
        // Remove existing messages
        const existing = document.querySelector('.email-message');
        if (existing) {
            existing.remove();
        }

        // Create new message
        const messageEl = document.createElement('div');
        messageEl.className = `email-message email-message-${type}`;
        messageEl.textContent = message;

        // Insert after form
        const form = document.getElementById('emailPreferencesForm');
        if (form) {
            form.parentNode.insertBefore(messageEl, form.nextSibling);
        }

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.remove();
            }
        }, 5000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('emailPreferencesForm')) {
        window.emailPreferences = new EmailPreferencesManager();
    }
});

// Export for use in other modules
export { EmailPreferencesManager };

