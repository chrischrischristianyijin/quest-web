/**
 * Email preferences management for Quest
 * Handles user email settings, digest preview, and unsubscribe functionality
 */

import { api } from './api.js';
import { auth } from './auth.js';
import { emailService } from './email-service.js';

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

            // Try to load from API first
            try {
                const response = await api.request('/api/v1/email/preferences');
                
                if (response.success) {
                    this.preferences = response.preferences;
                    this.renderPreferences();
                    return;
                }
            } catch (apiError) {
                console.log('API not available, loading from localStorage:', apiError.message);
            }

            // Fallback to localStorage if API fails
            const savedPreferences = localStorage.getItem('quest_email_preferences');
            if (savedPreferences) {
                this.preferences = JSON.parse(savedPreferences);
                this.renderPreferences();
                this.showMessage('Loaded preferences from local storage', 'info');
            } else {
                // Set default preferences
                this.preferences = {
                    weekly_digest_enabled: false,
                    preferred_day: 1, // Monday
                    preferred_hour: 9, // 9 AM
                    timezone: 'America/Los_Angeles',
                    no_activity_policy: 'skip'
                };
                this.renderPreferences();
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
            console.log('Saving preferences:', formData);

            // Try to save to API first
            let apiSuccess = false;
            try {
                const response = await api.request('/api/v1/email/preferences', {
                    method: 'PUT',
                    body: JSON.stringify(formData)
                });

                if (response.success) {
                    apiSuccess = true;
                    console.log('Preferences saved to API successfully');
                }
            } catch (apiError) {
                console.log('API not available, saving to localStorage:', apiError.message);
            }

            // Always save to localStorage as backup
            localStorage.setItem('quest_email_preferences', JSON.stringify(formData));
            console.log('Preferences saved to localStorage');

            // Update local preferences and UI
            this.preferences = { ...this.preferences, ...formData };
            this.renderPreferences();
            this.updateUIState();

            if (apiSuccess) {
                this.showSuccess('Email preferences saved successfully to database');
            } else {
                this.showSuccess('Email preferences saved locally (API not available)');
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
            
            if (response.ok && response.html) {
                this.showDigestPreview({ 
                    html_content: response.html, 
                    text_content: '', 
                    payload: response.params || {} 
                });
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

            if (!emailService.isValidEmail(email)) {
                this.showError('Please enter a valid email address');
                return;
            }

            this.isLoading = true;
            this.showTestSendingState();

            // Note: Template will be found by name if no ID is set

            const response = await emailService.sendTestEmail(email);

            if (response.success) {
                this.showSuccess('Test email sent successfully! Check your inbox.');
            } else {
                this.showError(`Failed to send test email: ${response.error}`);
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
        if (!this.preferences) {
            console.log('No preferences to render');
            return;
        }

        console.log('Rendering preferences:', this.preferences);

        // Update form fields
        const weeklyDigestCheckbox = document.getElementById('weeklyDigestEnabled');
        const preferredDaySelect = document.getElementById('preferredDay');
        const preferredHourSelect = document.getElementById('preferredHour');
        const timezoneSelect = document.getElementById('timezone');
        const noActivityPolicySelect = document.getElementById('noActivityPolicy');

        if (weeklyDigestCheckbox) {
            weeklyDigestCheckbox.checked = this.preferences.weekly_digest_enabled;
            console.log('Set weekly digest enabled:', this.preferences.weekly_digest_enabled);
        }

        if (preferredDaySelect) {
            preferredDaySelect.value = this.preferences.preferred_day;
            console.log('Set preferred day:', this.preferences.preferred_day);
        }

        if (preferredHourSelect) {
            preferredHourSelect.value = this.preferences.preferred_hour;
            console.log('Set preferred hour:', this.preferences.preferred_hour);
        }

        if (timezoneSelect) {
            timezoneSelect.value = this.preferences.timezone;
            console.log('Set timezone:', this.preferences.timezone);
        }

        if (noActivityPolicySelect) {
            noActivityPolicySelect.value = this.preferences.no_activity_policy;
            console.log('Set no activity policy:', this.preferences.no_activity_policy);
        }

        // Update UI state
        this.updateUIState();
        console.log('Preferences rendered successfully');
    }

    updateUIState() {
        const isEnabled = this.preferences?.weekly_digest_enabled;

        // Update preview button state (only this depends on digest being enabled)
        const previewBtn = document.getElementById('previewDigestBtn');
        if (previewBtn) {
            previewBtn.disabled = !isEnabled || this.isLoading;
        }

        // Test email button should always be enabled (not dependent on digest settings)
        const testBtn = document.getElementById('sendTestEmail');
        if (testBtn) {
            testBtn.disabled = this.isLoading;
        }

        // Update status pill
        const pill = document.getElementById('digestStatusPill');
        if (pill) pill.textContent = `Digest · ${isEnabled ? 'On' : 'Off'}`;
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

    showInfo(message) {
        this.showMessage(message, 'info');
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

