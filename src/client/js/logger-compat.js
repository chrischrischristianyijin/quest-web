/**
 * Environment-aware logging utility (Compatible Version)
 * Works in both ES modules and regular script contexts
 * Automatically disables logging in production
 */

(function() {
    'use strict';

    // Environment detection without imports
    function detectEnvironment() {
        const hostname = window.location.hostname;
        return {
            IS_LOCAL: hostname === 'localhost' || 
                     hostname === '127.0.0.1' || 
                     hostname.startsWith('192.168.') ||
                     hostname.startsWith('10.') ||
                     hostname.endsWith('.local'),
            BASE_URL: hostname === 'localhost' || 
                     hostname === '127.0.0.1' || 
                     hostname.startsWith('192.168.') ||
                     hostname.startsWith('10.') ||
                     hostname.endsWith('.local') 
                     ? 'http://localhost:8000' 
                     : 'https://quest-api-edz1.onrender.com'
        };
    }

    const ENV_CONFIG = detectEnvironment();

    class Logger {
        constructor() {
            // Only enable logging in development/local environment
            this.isDevelopment = ENV_CONFIG.IS_LOCAL || 
                               window.location.hostname === 'localhost' || 
                               window.location.hostname === '127.0.0.1' ||
                               window.location.hostname.includes('dev') ||
                               window.location.hostname.includes('test');
            
            // Log levels: error, warn, info, debug
            this.levels = {
                error: 0,
                warn: 1,
                info: 2,
                debug: 3
            };
            
            // Set log level based on environment
            this.currentLevel = this.isDevelopment ? this.levels.debug : this.levels.error;
            
            // Sanitize function to remove sensitive data
            this.sanitizeData = this.sanitizeData.bind(this);
        }

        /**
         * Sanitize sensitive data from log output
         * @param {any} data - Data to sanitize
         * @returns {any} - Sanitized data
         */
        sanitizeData(data) {
            if (typeof data === 'string') {
                // Remove potential tokens, API keys, passwords
                return data
                    .replace(/(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/g, '$1[REDACTED]')
                    .replace(/(token['":\s]*)([A-Za-z0-9\-._~+/]+=*)/g, '$1[REDACTED]')
                    .replace(/(api[_-]?key['":\s]*)([A-Za-z0-9\-._~+/]+=*)/gi, '$1[REDACTED]')
                    .replace(/(password['":\s]*)([^\s,}]+)/gi, '$1[REDACTED]')
                    .replace(/(secret['":\s]*)([A-Za-z0-9\-._~+/]+=*)/gi, '$1[REDACTED]');
            }
            
            if (typeof data === 'object' && data !== null) {
                const sanitized = Array.isArray(data) ? [] : {};
                for (const key in data) {
                    if (data.hasOwnProperty(key)) {
                        const lowerKey = key.toLowerCase();
                        if (lowerKey.includes('token') || 
                            lowerKey.includes('password') || 
                            lowerKey.includes('secret') || 
                            lowerKey.includes('key')) {
                            sanitized[key] = '[REDACTED]';
                        } else {
                            sanitized[key] = this.sanitizeData(data[key]);
                        }
                    }
                }
                return sanitized;
            }
            
            return data;
        }

        /**
         * Log message if level is enabled
         * @param {number} level - Log level
         * @param {string} method - Console method to use
         * @param {string} prefix - Log prefix
         * @param {...any} args - Arguments to log
         */
        log(level, method, prefix, ...args) {
            if (level <= this.currentLevel) {
                const sanitizedArgs = args.map(arg => this.sanitizeData(arg));
                console[method](prefix, ...sanitizedArgs);
            }
        }

        /**
         * Error logging (always enabled)
         */
        error(...args) {
            this.log(this.levels.error, 'error', '❌', ...args);
        }

        /**
         * Warning logging
         */
        warn(...args) {
            this.log(this.levels.warn, 'warn', '⚠️', ...args);
        }

        /**
         * Info logging (development only)
         */
        info(...args) {
            this.log(this.levels.info, 'info', 'ℹ️', ...args);
        }

        /**
         * Debug logging (development only)
         */
        debug(...args) {
            this.log(this.levels.debug, 'log', '🔍', ...args);
        }

        /**
         * Success logging (development only)
         */
        success(...args) {
            this.log(this.levels.info, 'log', '✅', ...args);
        }

        /**
         * Security logging (always enabled, with extra sanitization)
         */
        security(...args) {
            if (this.isDevelopment) {
                const sanitizedArgs = args.map(arg => this.sanitizeData(arg));
                console.warn('🔒 SECURITY', ...sanitizedArgs);
            }
        }

        /**
         * Performance logging (development only)
         */
        performance(...args) {
            this.log(this.levels.debug, 'log', '⚡', ...args);
        }

        /**
         * API request logging (development only, with sanitization)
         */
        apiRequest(method, url, data = null) {
            if (this.isDevelopment) {
                const sanitizedData = data ? this.sanitizeData(data) : null;
                console.log('🌐 API Request:', {
                    method,
                    url,
                    data: sanitizedData,
                    timestamp: new Date().toISOString()
                });
            }
        }

        /**
         * API response logging (development only, with sanitization)
         */
        apiResponse(status, data = null, latency = null) {
            if (this.isDevelopment) {
                const sanitizedData = data ? this.sanitizeData(data) : null;
                console.log('📡 API Response:', {
                    status,
                    data: sanitizedData,
                    latency: latency ? `${latency}ms` : null,
                    timestamp: new Date().toISOString()
                });
            }
        }

        /**
         * User action logging (development only, with sanitization)
         */
        userAction(action, details = null) {
            if (this.isDevelopment) {
                const sanitizedDetails = details ? this.sanitizeData(details) : null;
                console.log('👤 User Action:', {
                    action,
                    details: sanitizedDetails,
                    timestamp: new Date().toISOString()
                });
            }
        }

        /**
         * Check if logging is enabled
         */
        isLoggingEnabled() {
            return this.isDevelopment;
        }

        /**
         * Get current environment info
         */
        getEnvironmentInfo() {
            return {
                isDevelopment: this.isDevelopment,
                currentLevel: this.currentLevel,
                hostname: window.location.hostname,
                protocol: window.location.protocol
            };
        }
    }

    // Create singleton instance
    const logger = new Logger();

    // Export to global scope
    window.logger = logger;

    // Also try to export for module systems if available
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { Logger, logger };
    }
    if (typeof exports !== 'undefined') {
        exports.Logger = Logger;
        exports.logger = logger;
    }

    // Initialize logging
    if (logger.isLoggingEnabled()) {
        console.log('🔧 Logger initialized in development mode');
    } else {
        console.log('🔒 Logger initialized in production mode (logging disabled)');
    }

})();


