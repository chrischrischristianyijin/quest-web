// Simple logger utility for performance optimization
class Logger {
    constructor() {
        this.isDebug = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      window.location.search.includes('debug=true');
    }

    log(...args) {
        if (this.isDebug) {
            console.log(...args);
        }
    }

    error(...args) {
        if (this.isDebug) {
            console.error(...args);
        }
    }

    warn(...args) {
        if (this.isDebug) {
            console.warn(...args);
        }
    }

    info(...args) {
        if (this.isDebug) {
            console.info(...args);
        }
    }

    // Always log critical errors
    critical(...args) {
        console.error(...args);
    }
}

// Create global logger instance
window.logger = new Logger();
