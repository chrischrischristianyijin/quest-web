    /**
 * Email Preferences Modal for Quest
 * Modal version of email preferences functionality
 */

import { api } from './api.js';
import { auth } from './auth.js';
import { emailService } from './email-service.js';
import { API_CONFIG } from './config.js';

class EmailPreferencesModal {
    constructor() {
        this.preferences = null;
        this.isLoading = false;
        this.modal = null;
        this.init();
    }

    init() {
        this.createModal();
        this.setupEventListeners();
    }

    createModal() {
        // Create modal HTML structure
        this.modal = document.createElement('div');
        this.modal.className = 'email-preferences-modal';
        this.modal.innerHTML = `
            <div class="modal-overlay" id="emailModalOverlay">
                <div class="modal-content" id="emailModalContent">
                    <div class="modal-header">
                        <h2 data-translate="email_preferences">Email Preferences</h2>
                        <button class="close-btn" id="closeEmailModal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="emailPreferencesForm" class="email-preferences-form">
                            <div class="form-section">
                                <h3 data-translate="weekly_digest">Weekly Digest</h3>
                                <div class="form-group">
                                    <label class="checkbox-label">
                                        <input type="checkbox" id="weeklyDigestEnabled" class="checkbox">
                                        <span class="checkmark"></span>
                                        <span data-translate="enable_weekly_digest">Enable weekly digest emails</span>
                                    </label>
                                    <p class="form-help" data-translate="receive_weekly_summary">Receive a weekly summary of your insights and activity</p>
                                </div>
                            </div>

                            <div class="form-section email-preference-field">
                                <h3 data-translate="delivery_schedule">Delivery Schedule</h3>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="preferredDay" class="form-label" data-translate="preferred_day">Preferred Day</label>
                                        <select id="preferredDay" class="form-select">
                                            <option value="0" data-translate="sunday">Sunday</option>
                                            <option value="1" data-translate="monday">Monday</option>
                                            <option value="2" data-translate="tuesday">Tuesday</option>
                                            <option value="3" data-translate="wednesday">Wednesday</option>
                                            <option value="4" data-translate="thursday">Thursday</option>
                                            <option value="5" data-translate="friday">Friday</option>
                                            <option value="6" data-translate="saturday">Saturday</option>
                                        </select>
                                    </div>
                                    <div class="form-group">
                                        <label for="preferredHour" class="form-label" data-translate="preferred_hour">Preferred Hour</label>
                                        <select id="preferredHour" class="form-select">
                                            <option value="6">6:00 AM</option>
                                            <option value="7">7:00 AM</option>
                                            <option value="8">8:00 AM</option>
                                            <option value="9">9:00 AM</option>
                                            <option value="10">10:00 AM</option>
                                            <option value="11">11:00 AM</option>
                                            <option value="12">12:00 PM</option>
                                            <option value="13">1:00 PM</option>
                                            <option value="14">2:00 PM</option>
                                            <option value="15">3:00 PM</option>
                                            <option value="16">4:00 PM</option>
                                            <option value="17">5:00 PM</option>
                                            <option value="18">6:00 PM</option>
                                            <option value="19">7:00 PM</option>
                                            <option value="20">8:00 PM</option>
                                            <option value="21">9:00 PM</option>
                                            <option value="22">10:00 PM</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div class="form-section email-preference-field">
                                <h3 data-translate="timezone">Timezone</h3>
                                <div class="form-group">
                                    <label for="timezone" class="form-label" data-translate="your_timezone">Your Timezone</label>
                                    <select id="timezone" class="form-select">
                                        <option value="America/Los_Angeles" data-translate="pacific_time">Pacific Time (Los Angeles)</option>
                                        <option value="America/Denver" data-translate="mountain_time">Mountain Time (Denver)</option>
                                        <option value="America/Chicago" data-translate="central_time">Central Time (Chicago)</option>
                                        <option value="America/New_York" data-translate="eastern_time">Eastern Time (New York)</option>
                                        <option value="Europe/London" data-translate="london_gmt">London (GMT)</option>
                                        <option value="Europe/Paris" data-translate="paris_cet">Paris (CET)</option>
                                        <option value="Asia/Tokyo" data-translate="tokyo_jst">Tokyo (JST)</option>
                                        <option value="Asia/Shanghai" data-translate="shanghai_cst">Shanghai (CST)</option>
                                        <option value="Australia/Sydney" data-translate="sydney_aest">Sydney (AEST)</option>
                                        <option value="UTC" data-translate="utc">UTC</option>
                                    </select>
                                    <p class="form-help" data-translate="timezone_help">We'll send your digest at your preferred time in this timezone</p>
                                </div>
                            </div>

                            <div class="form-section email-preference-field">
                                <h3 data-translate="no_activity_policy">No Activity Policy</h3>
                                <div class="form-group">
                                    <label for="noActivityPolicy" class="form-label" data-translate="no_activity_label">When you have no activity this week</label>
                                    <select id="noActivityPolicy" class="form-select">
                                        <option value="skip" data-translate="skip_sending">Skip sending (don't send email)</option>
                                        <option value="brief" data-translate="brief_email">Send brief email with suggestions</option>
                                        <option value="suggestions" data-translate="missed_content">Send email with "what you missed" content</option>
                                    </select>
                                    <p class="form-help" data-translate="no_activity_help">Choose how to handle weeks when you haven't added any insights</p>
                                </div>
                            </div>

                            <div class="form-actions">
                                <button type="submit" id="saveEmailPreferences" class="btn btn-primary" data-translate="save_preferences">
                                    Save Preferences
                                </button>
                                <button type="button" id="previewDigestBtn" class="btn btn-secondary" disabled data-translate="preview_digest">
                                    Preview Digest
                                </button>
                                <button type="button" id="sendTestEmail" class="btn btn-outline" data-translate="send_test_email">
                                    Send Test Email
                                </button>
                            </div>
                        </form>

                        <div class="email-info">
                            <h3 data-translate="about_digest">About Your Digest</h3>
                            <ul>
                                <li data-translate="weekly_summary">📝 <strong>Weekly Summary:</strong> Get a curated overview of your insights from the past week</li>
                                <li data-translate="personalized_content">🎯 <strong>Personalized Content:</strong> Highlights are chosen based on your engagement and recency</li>
                                <li data-translate="stack_updates">📚 <strong>Stack Updates:</strong> See what's new in your knowledge stacks</li>
                                <li data-translate="smart_suggestions">💡 <strong>Smart Suggestions:</strong> Get recommendations to improve your knowledge management</li>
                                <li data-translate="privacy_first">🔒 <strong>Privacy First:</strong> Your data stays private and secure</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal styles
        this.addModalStyles();
        
        // Append to body
        document.body.appendChild(this.modal);
    }

    addModalStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .email-preferences-modal {
                position: fixed;
                inset: 0;
                z-index: 1000;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 20px;
                min-height: 100vh;
                min-width: 100vw;
            }

            .email-preferences-modal.show {
                display: flex;
            }

            .modal-overlay {
                position: absolute;
                inset: 0;
                background: rgba(17, 12, 28, 0.55);
                backdrop-filter: blur(6px);
                cursor: pointer;
            }

            .modal-content {
                background: var(--bg-primary, #ffffff);
                border-radius: var(--radius-lg, 16px);
                max-width: min(90vw, 800px);
                max-height: 90vh;
                width: 100%;
                display: flex;
                flex-direction: column;
                position: relative;
                z-index: 1001;
                box-shadow: var(--shadow-medium, 0 10px 30px rgba(0,0,0,0.10));
                border: 1px solid var(--border-light, rgba(226,232,240,0.6));
                overflow: hidden;
                margin: auto;
            }

            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px 24px;
                border-bottom: 1px solid var(--border-light, rgba(226,232,240,0.6));
                background: var(--bg-secondary, #f8fafc);
            }

            .modal-header h2 {
                margin: 0;
                color: var(--quest-purple, #322563);
                font-weight: 700;
                font-size: 1.5rem;
            }

            .close-btn {
                background: linear-gradient(135deg, #f8fafc, #e2e8f0);
                border: 1px solid rgba(226,232,240,0.8);
                font-size: 1.5rem;
                cursor: pointer;
                color: #475569;
                padding: 8px 12px;
                border-radius: 10px;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .close-btn:hover {
                background: linear-gradient(135deg, #e2e8f0, #cbd5e1);
            }

            .modal-body {
                flex: 1;
                overflow-y: auto;
                padding: 24px;
                display: grid;
                grid-template-columns: 1fr 300px;
                gap: 24px;
            }

            .email-preferences-form {
                background: transparent;
                border: none;
                padding: 0;
                box-shadow: none;
            }

            .form-section {
                margin-bottom: 24px;
                padding-bottom: 20px;
                border-bottom: 1px solid var(--border-light, rgba(226,232,240,0.6));
            }

            .form-section:last-child {
                margin-bottom: 0;
                padding-bottom: 0;
                border-bottom: none;
            }

            .form-section h3 {
                color: var(--quest-purple, #322563);
                margin: 0 0 12px;
                font-size: 1.1rem;
                font-weight: 600;
            }

            .form-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
            }

            .form-group {
                margin-bottom: 16px;
            }

            .form-label {
                display: block;
                margin-bottom: 6px;
                font-weight: 600;
                color: var(--text-primary, #111827);
                font-size: 0.9rem;
            }

            .form-select {
                width: 100%;
                padding: 10px 12px;
                border: 2px solid var(--border-light, rgba(226,232,240,0.6));
                border-radius: 8px;
                font-size: 0.9rem;
                background: var(--bg-primary, #ffffff);
                transition: border-color 0.2s, box-shadow 0.2s;
            }

            .form-select:focus {
                outline: none;
                border-color: var(--quest-purple, #322563);
                box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.12);
            }

            .checkbox-label {
                display: flex;
                align-items: flex-start;
                cursor: pointer;
                font-weight: 600;
                color: var(--text-primary, #111827);
            }

            .checkbox {
                margin-right: 10px;
                margin-top: 3px;
                width: 18px;
                height: 18px;
                accent-color: var(--quest-purple, #322563);
            }

            .form-help {
                margin-top: 6px;
                font-size: 0.8rem;
                color: var(--text-secondary, #6b7280);
                line-height: 1.4;
            }

            .form-actions {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
                margin-top: 20px;
                padding-top: 20px;
                border-top: 1px solid var(--border-light, rgba(226,232,240,0.6));
            }

            .btn {
                padding: 10px 16px;
                border-radius: 8px;
                font-size: 0.9rem;
                font-weight: 600;
                text-decoration: none;
                border: none;
                cursor: pointer;
                transition: all 0.2s ease;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 120px;
            }

            .btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }

            .btn-primary {
                background: linear-gradient(135deg, var(--quest-purple, #322563), var(--quest-purple, #322563));
                color: #fff;
                border: 1px solid var(--quest-purple, #322563);
            }

            .btn-primary:hover:not(:disabled) {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(101, 85, 143, 0.25);
            }

            .btn-secondary {
                background: var(--bg-secondary, #f8fafc);
                color: var(--quest-purple, #322563);
                border: 2px solid var(--quest-light-purple, #c9b9ff);
            }

            .btn-secondary:hover:not(:disabled) {
                background: rgba(139, 92, 246, 0.08);
                border-color: var(--quest-purple, #322563);
                transform: translateY(-1px);
            }

            .btn-outline {
                background: transparent;
                color: var(--quest-purple, #322563);
                border: 2px solid var(--quest-purple, #322563);
            }

            .btn-outline:hover:not(:disabled) {
                background: var(--quest-purple, #322563);
                color: #fff;
                transform: translateY(-1px);
            }

            .email-info {
                background: var(--bg-secondary, #f8fafc);
                border-radius: 12px;
                padding: 20px;
                height: fit-content;
                border: 1px solid var(--border-light, rgba(226,232,240,0.6));
            }

            .email-info h3 {
                color: var(--quest-purple, #322563);
                margin: 0 0 12px;
                font-size: 1rem;
                font-weight: 600;
            }

            .email-info ul {
                list-style: none;
                padding: 0;
                margin: 0 0 16px;
            }

            .email-info li {
                margin-bottom: 8px;
                line-height: 1.5;
                color: var(--text-primary, #111827);
                font-size: 0.85rem;
            }

            .email-message {
                padding: 12px;
                border-radius: 8px;
                margin: 12px 0;
                font-weight: 600;
                border: 1px solid transparent;
                font-size: 0.9rem;
            }

            .email-message-success {
                background: #e7f6ed;
                color: #106a36;
                border-color: #c1ebd6;
            }

            .email-message-error {
                background: #fdecec;
                color: #a11a1a;
                border-color: #f6c7c9;
            }

            .email-message-info {
                background: #dbeafe;
                color: #1e40af;
                border-color: #93c5fd;
            }

            @media (max-width: 768px) {
                .email-preferences-modal {
                    padding: 10px;
                }
                
                .modal-content {
                    max-width: 95vw;
                    max-height: 95vh;
                }
                
                .modal-body {
                    grid-template-columns: 1fr;
                    padding: 16px;
                }
                
                .modal-header {
                    padding: 16px 20px;
                }
                
                .modal-header h2 {
                    font-size: 1.3rem;
                }
                
                .form-row {
                    grid-template-columns: 1fr;
                }
                
                .form-actions {
                    flex-direction: column;
                }
                
                .btn {
                    width: 100%;
                }
            }
        `;
        document.head.appendChild(style);
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

    async loadPreferencesSafely() {
        // Always try to load from API first to get the most current preferences
        try {
            const token = this.getAuthToken();
            if (token) {
                // Set the auth token in the API instance before making the request
                api.setAuthToken(token);
                
                const response = await api.request('/api/v1/email/preferences');
                
                if (response.success) {
                    this.preferences = response.preferences;
                    this.renderPreferences();
                    console.log('✅ Loaded current preferences from API:', this.preferences);
                    
                    // Save to localStorage for future use
                    localStorage.setItem('quest_email_preferences', JSON.stringify(this.preferences));
                    return; // Successfully loaded from API, no need to continue
                } else {
                    console.log('API returned success=false:', response);
                }
            } else {
                console.log('No auth token found, trying localStorage');
            }
        } catch (apiError) {
            console.log('API not available, trying localStorage:', apiError.message);
        }

        // Fallback to localStorage if API fails
        const savedPreferences = localStorage.getItem('quest_email_preferences');
        if (savedPreferences) {
            try {
                this.preferences = JSON.parse(savedPreferences);
                this.renderPreferences();
                console.log('📱 Loaded preferences from localStorage:', this.preferences);
            } catch (e) {
                console.error('Error parsing saved preferences:', e);
            }
        }

        // Set default preferences only if no preferences exist anywhere
        if (!this.preferences) {
            this.preferences = {
                weekly_digest_enabled: false,
                preferred_day: 1, // Monday
                preferred_hour: 9, // 9 AM
                timezone: 'America/Los_Angeles',
                no_activity_policy: 'skip'
            };
            this.renderPreferences();
            console.log('🔧 Using default preferences');
        }

        // Try to sync with API in the background (without blocking modal)
        this.syncWithAPIInBackground();
    }

    getAuthToken() {
        // Try multiple token storage locations
        let token = null;
        
        // First check quest_user_session (most common)
        try {
            const userSession = localStorage.getItem('quest_user_session');
            if (userSession) {
                const sessionData = JSON.parse(userSession);
                token = sessionData.token;
                if (token) {
                    console.log('Found token in quest_user_session');
                    return token;
                }
            }
        } catch (e) {
            console.log('Error parsing quest_user_session:', e);
        }
        
        // Fallback to other storage locations
        token = localStorage.getItem('quest_token') || 
                sessionStorage.getItem('quest_token') ||
                localStorage.getItem('authToken');
        
        if (token) {
            console.log('Found token in fallback storage');
        } else {
            console.log('No auth token found in any storage location');
        }
        
        return token;
    }

    async syncWithAPIInBackground() {
        try {
            // Check if user is authenticated before making API call
            const token = this.getAuthToken();
            if (!token) {
                console.log('No auth token found, skipping API sync');
                return;
            }

            // Additional check - make sure auth object exists and user is logged in
            if (typeof auth !== 'undefined' && auth.isLoggedIn && !auth.isLoggedIn()) {
                console.log('User not logged in, skipping API sync');
                return;
            }

            // Set the auth token in the API instance before making the request
            api.setAuthToken(token);

            const response = await api.request('/api/v1/email/preferences');
            
            if (response.success) {
                // Update preferences if different from localStorage
                const apiPrefs = response.preferences;
                if (JSON.stringify(apiPrefs) !== JSON.stringify(this.preferences)) {
                    this.preferences = apiPrefs;
                    this.renderPreferences();
                    console.log('Synced preferences from API');
                }
            }
        } catch (apiError) {
            // Silently fail - don't show errors or trigger logout
            console.log('Background API sync failed (this is okay):', apiError.message);
            // Don't re-throw the error - this prevents any potential logout triggers
        }
    }

    async savePreferences() {
        try {
            this.isLoading = true;
            this.showSavingState();

            const formData = this.getFormData();
            console.log('Saving preferences:', formData);

            // Always save to localStorage first (immediate feedback)
            localStorage.setItem('quest_email_preferences', JSON.stringify(formData));
            this.preferences = { ...this.preferences, ...formData };
            this.renderPreferences();
            this.updateUIState();
            console.log('Preferences saved to localStorage');

            // Try to save to API in background
            let apiSuccess = false;
            try {
                const token = this.getAuthToken();
                if (token) {
                    // CRITICAL: Set the auth token in the API instance before making the request
                    api.setAuthToken(token);
                    
                    const response = await api.request('/api/v1/email/preferences', {
                        method: 'PUT',
                        body: JSON.stringify(formData)
                    });

                    if (response.success) {
                        apiSuccess = true;
                        console.log('Preferences saved to API successfully');
                        
                        // Clear cache for email preferences to ensure fresh data on next load
                        if (window.apiCache) {
                            const preferencesUrl = `${API_CONFIG.API_BASE_URL}/api/v1/email/preferences`;
                            window.apiCache.delete(preferencesUrl);
                            console.log('🗑️ Cleared email preferences cache');
                        }
                    }
                }
            } catch (apiError) {
                console.log('API save failed (preferences still saved locally):', apiError.message);
            }

            if (apiSuccess) {
                this.showSuccess('Email preferences saved successfully');
            } else {
                this.showSuccess('Email preferences saved (will sync when online)');
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
            // Check if user is authenticated before attempting
            const token = this.getAuthToken();
            if (!token) {
                this.showError('Please log in to preview digest');
                return;
            }

            this.isLoading = true;
            this.showPreviewLoadingState();

            const url = `${API_CONFIG.API_BASE_URL}/api/v1/email/digest/preview`;
            const commonHeaders = {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            };

            // Try GET first (now expecting JSON)
            let res = await fetch(url, { method: 'GET', headers: commonHeaders });

            if (res.ok) {
                const data = await res.json();
                if (data.ok && data.html) {
                    this.showDigestPreview({ html_content: data.html, text_content: '', payload: data.params || {} });
                } else {
                    // Fallback to POST if GET returns unexpected format
                    await this.fallbackToPost(url, token);
                }
            } else {
                // GET failed, try POST fallback
                await this.fallbackToPost(url, token);
            }
        } catch (error) {
            console.error('Error generating digest preview:', error);
            this.showError('Failed to generate digest preview - please check your connection');
        } finally {
            this.isLoading = false;
            this.hidePreviewLoadingState();
        }
    }

    // New method: POST fallback logic
    async fallbackToPost(url, token) {
        const body = this.getFormData(); // Get current preferences to send to backend
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (res.ok) {
            const data = await res.json();
            if (data && data.success && data.preview) {
                this.showDigestPreview(data.preview);
                return;
            }
        }

        // Read backend error message for better UX
        const errorText = await res.text();
        this.showError(`Failed to generate preview: ${res.status} ${errorText}`);
    }

    async sendTestEmail() {
        try {
            // Check if user is authenticated before attempting
            const token = this.getAuthToken();
            if (!token) {
                this.showError('Please log in to send test emails');
                return;
            }

            const email = prompt('Enter email address for test:');
            if (!email) return;

            if (!emailService.isValidEmail(email)) {
                this.showError('Please enter a valid email address');
                return;
            }

            this.isLoading = true;
            this.showTestSendingState();

            // CRITICAL: Set the auth token in the API instance before making the request
            api.setAuthToken(token);

            // Use the backend API to send test email with real user data
            const response = await api.request('/api/v1/email/test', {
                method: 'POST',
                body: JSON.stringify({ 
                    email: email,
                    template_id: 1  // Pass template ID to backend
                })
            });

            if (response.success) {
                this.showSuccess('Test email sent successfully! Check your inbox for your real digest data.');
            } else {
                this.showError(`Failed to send test email: ${response.message || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error sending test email:', error);
            this.showError('Failed to send test email - please check your connection');
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

        console.log('🎨 Rendering preferences:', this.preferences);

        // Update form fields
        const weeklyDigestCheckbox = document.getElementById('weeklyDigestEnabled');
        const preferredDaySelect = document.getElementById('preferredDay');
        const preferredHourSelect = document.getElementById('preferredHour');
        const timezoneSelect = document.getElementById('timezone');
        const noActivityPolicySelect = document.getElementById('noActivityPolicy');

        if (weeklyDigestCheckbox) {
            weeklyDigestCheckbox.checked = Boolean(this.preferences.weekly_digest_enabled);
        }

        if (preferredDaySelect) {
            preferredDaySelect.value = String(this.preferences.preferred_day);
        }

        if (preferredHourSelect) {
            preferredHourSelect.value = String(this.preferences.preferred_hour);
        }

        if (timezoneSelect) {
            timezoneSelect.value = String(this.preferences.timezone);
        }

        if (noActivityPolicySelect) {
            noActivityPolicySelect.value = String(this.preferences.no_activity_policy);
        }

        // Update UI state
        this.updateUIState();
    }

    updateUIState() {
        const isEnabled = this.preferences?.weekly_digest_enabled;

        // Update preview button state
        const previewBtn = document.getElementById('previewDigestBtn');
        if (previewBtn) {
            previewBtn.disabled = !isEnabled || this.isLoading;
        }

        // Test email button should always be enabled
        const testBtn = document.getElementById('sendTestEmail');
        if (testBtn) {
            testBtn.disabled = this.isLoading;
        }
    }

    showDigestPreview(preview) {
        // Create modal for preview
        const previewModal = document.createElement('div');
        previewModal.className = 'email-preview-modal';
        previewModal.innerHTML = `
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

        document.body.appendChild(previewModal);

        // Add tab switching functionality
        window.showPreviewTab = (tab) => {
            document.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            
            document.getElementById(tab + 'Preview').classList.add('active');
            event.target.classList.add('active');
        };
    }

    setupEventListeners() {
        // Close modal events
        const closeBtn = document.getElementById('closeEmailModal');
        const overlay = document.getElementById('emailModalOverlay');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }
        
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                // Only close if clicking directly on the overlay, not on modal content
                if (e.target === overlay) {
                    this.close();
                }
            });
        }

        // Prevent modal content clicks from closing the modal
        const modalContent = document.getElementById('emailModalContent');
        if (modalContent) {
            modalContent.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        // Form events
        const form = document.getElementById('emailPreferencesForm');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.savePreferences();
            });
        }

        // Button events
        const saveBtn = document.getElementById('saveEmailPreferences');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.savePreferences());
        }

        const previewBtn = document.getElementById('previewDigestBtn');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => this.previewDigest());
        }

        const testBtn = document.getElementById('sendTestEmail');
        if (testBtn) {
            testBtn.addEventListener('click', () => this.sendTestEmail());
        }

        // Toggle weekly digest
        const toggle = document.getElementById('weeklyDigestEnabled');
        if (toggle) {
            toggle.addEventListener('change', () => this.updateUIState());
        }
    }

    resetRightPanel() {
        // Remove any existing messages
        const existing = this.modal.querySelector('.email-message');
        if (existing) {
            existing.remove();
        }

        // Ensure the default "About Your Digest" section is visible and prominent
        const emailInfo = this.modal.querySelector('.email-info');
        if (emailInfo) {
            emailInfo.style.display = 'block';
            emailInfo.style.opacity = '1';
        }

        // Hide any preview content that might be showing
        const previewContent = this.modal.querySelector('.digest-preview-content');
        if (previewContent) {
            previewContent.style.display = 'none';
        }
    }

    show() {
        this.modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        // Clear any existing messages and reset to default content
        this.resetRightPanel();
        
        // Load preferences safely without triggering logout
        // Add a small delay to ensure DOM elements are ready
        setTimeout(() => {
            this.loadPreferencesSafely();
        }, 100);
    }

    close() {
        this.modal.classList.remove('show');
        document.body.style.overflow = '';
    }

    // Loading states
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
        const existing = this.modal.querySelector('.email-message');
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

// Create singleton instance
const emailPreferencesModal = new EmailPreferencesModal();

// Export for use in other modules
export { EmailPreferencesModal, emailPreferencesModal };
