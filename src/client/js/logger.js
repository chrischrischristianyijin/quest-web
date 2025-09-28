/**
 * Production-Safe Logging System
 * This file should be loaded FIRST to override console methods in production
 * Automatically disables debug logging in production environments
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
            IS_PRODUCTION: !(hostname === 'localhost' ||
                           hostname === '127.0.0.1' ||
                           hostname.startsWith('192.168.') ||
                           hostname.startsWith('10.') ||
                           hostname.endsWith('.local'))
        };
    }

    const ENV_CONFIG = detectEnvironment();

    // EARLY CONSOLE OVERRIDE FOR PRODUCTION
    if (ENV_CONFIG.IS_PRODUCTION) {
        // Store original console methods
        const originalConsole = {
            log: console.log,
            debug: console.debug,
            info: console.info,
            warn: console.warn,
            error: console.error
        };

        // Override console methods in production
        console.log = function(...args) {
            // Only allow critical production messages
            const message = args[0];
            if (typeof message === 'string' && (
                message.includes('🚀 Production Mode') ||
                message.includes('📡 API Base URL') ||
                message.includes('❌') ||
                message.includes('⚠️') ||
                message.includes('🔒') ||
                message.includes('SECURITY') ||
                message.includes('ERROR') ||
                message.includes('CRITICAL')
            )) {
                originalConsole.log.apply(console, args);
            }
        };

        console.debug = function() { /* disabled in production */ };
        console.info = function() { /* disabled in production */ };

        // Keep warnings and errors
        console.warn = originalConsole.warn;
        console.error = originalConsole.error;

        // Log that we're in production mode with reduced logging
        originalConsole.log('🚀 Production Mode - Debug logging disabled');
    }

    // Advanced Logger Class
    class Logger {
        constructor() {
            // Only enable logging in development/local environment
            this.isDevelopment = ENV_CONFIG.IS_LOCAL ||
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
    window.ENV_CONFIG = ENV_CONFIG;

    // Also try to export for module systems if available
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { Logger, logger, ENV_CONFIG };
    }
    if (typeof exports !== 'undefined') {
        exports.Logger = Logger;
        exports.logger = logger;
        exports.ENV_CONFIG = ENV_CONFIG;
    }

    // Initialize logging message
    if (logger.isLoggingEnabled()) {
        console.log('🔧 Development Logger initialized - Full logging enabled');
    } else {
        // This should only show if the console override above doesn't catch it
        console.log('🔒 Production Logger initialized - Debug logging disabled');
    }

})();