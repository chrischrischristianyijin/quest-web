// Configuration file for Quest Web Application
// This file contains all the configuration constants used throughout the application

// API Configuration
export const API_CONFIG = {
    BASE_URL: 'https://api.myquestspace.com',
    TIMEOUT: 10000, // 10 seconds
    RETRY_ATTEMPTS: 3
};

// Authentication Configuration
export const AUTH_CONFIG = {
    TOKEN_KEY: 'quest_auth_token',
    REFRESH_TOKEN_KEY: 'quest_refresh_token',
    TOKEN_EXPIRY_KEY: 'quest_token_expiry',
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    REFRESH_THRESHOLD: 5 * 60 * 1000 // Refresh token 5 minutes before expiry
};

// Email Configuration
export const EMAIL_CONFIG = {
    PREFERENCES_KEY: 'quest_email_preferences',
    CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
    DEFAULT_PREFERENCES: {
        weekly_digest_enabled: true,
        preferred_day: 1, // Monday (0 = Sunday, 1 = Monday, etc.)
        preferred_hour: 9, // 9 AM
        timezone: 'UTC',
        no_activity_policy: 'send' // 'send' or 'skip'
    }
};

// Brevo (Sendinblue) Configuration
export const BREVO_CONFIG = {
    // API_KEY: Moved to backend environment variables for security
    API_URL: 'https://api.brevo.com/v3',
    TEMPLATE_ID: 1, // Will be set after creating template in Brevo
    SENDER_EMAIL: 'contact@myquestspace.com',
    SENDER_NAME: 'Quest'
};

// UI Configuration
export const UI_CONFIG = {
    ANIMATION_DURATION: 300,
    DEBOUNCE_DELAY: 500,
    TOAST_DURATION: 3000,
    LOADING_TIMEOUT: 10000
};

// Feature Flags
export const FEATURES = {
    EMAIL_DIGEST: true,
    TRANSLATION: true,
    DEMO_CHAT: true,
    TOKEN_DEBUG: false // Set to true for development
};

// Translation Configuration
export const TRANSLATION_CONFIG = {
    DEFAULT_LANGUAGE: 'en',
    SUPPORTED_LANGUAGES: ['en', 'zh', 'es', 'fr', 'de', 'ja'],
    FALLBACK_LANGUAGE: 'en',
    CACHE_KEY: 'quest_language_preference'
};

// Cache Configuration
export const CACHE_CONFIG = {
    PREFIX: 'quest_',
    DEFAULT_TTL: 60 * 60 * 1000, // 1 hour
    MAX_ITEMS: 100
};

// Error Messages
export const ERROR_MESSAGES = {
    NETWORK_ERROR: 'Network connection failed. Please check your internet connection.',
    AUTH_ERROR: 'Authentication failed. Please log in again.',
    SERVER_ERROR: 'Server error occurred. Please try again later.',
    VALIDATION_ERROR: 'Please check your input and try again.',
    TIMEOUT_ERROR: 'Request timed out. Please try again.',
    UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.'
};

// Success Messages
export const SUCCESS_MESSAGES = {
    LOGIN_SUCCESS: 'Successfully logged in!',
    LOGOUT_SUCCESS: 'Successfully logged out!',
    PREFERENCES_SAVED: 'Preferences saved successfully!',
    EMAIL_SENT: 'Email sent successfully!',
    SETTINGS_UPDATED: 'Settings updated successfully!'
};

// Validation Rules
export const VALIDATION_RULES = {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PASSWORD_MIN_LENGTH: 8,
    USERNAME_MIN_LENGTH: 3,
    USERNAME_MAX_LENGTH: 20
};

// Date and Time Configuration
export const DATE_CONFIG = {
    DEFAULT_FORMAT: 'YYYY-MM-DD',
    DISPLAY_FORMAT: 'MMM DD, YYYY',
    TIME_FORMAT: 'HH:mm',
    DATETIME_FORMAT: 'MMM DD, YYYY HH:mm'
};

// Pagination Configuration
export const PAGINATION_CONFIG = {
    DEFAULT_PAGE_SIZE: 10,
    MAX_PAGE_SIZE: 100,
    PAGE_SIZE_OPTIONS: [10, 25, 50, 100]
};

// Development Configuration
export const DEV_CONFIG = {
    DEBUG_MODE: false,
    VERBOSE_LOGGING: false,
    MOCK_API: false,
    HOT_RELOAD: true
};

// Export all configurations as a single object for convenience
export const CONFIG = {
    API: API_CONFIG,
    AUTH: AUTH_CONFIG,
    EMAIL: EMAIL_CONFIG,
    BREVO: BREVO_CONFIG,
    UI: UI_CONFIG,
    FEATURES: FEATURES,
    TRANSLATION: TRANSLATION_CONFIG,
    CACHE: CACHE_CONFIG,
    ERRORS: ERROR_MESSAGES,
    SUCCESS: SUCCESS_MESSAGES,
    VALIDATION: VALIDATION_RULES,
    DATE: DATE_CONFIG,
    PAGINATION: PAGINATION_CONFIG,
    DEV: DEV_CONFIG
};

// Default export
export default CONFIG;
