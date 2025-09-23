// Backend Connectivity Manager
// Monitors backend connectivity and triggers logout when connection is lost

import { API_CONFIG } from './config.js';
import { tokenManager } from './token-manager.js';

class ConnectivityManager {
    constructor() {
        this.isOnline = true;
        this.consecutiveFailures = 0;
        this.maxConsecutiveFailures = 3; // Trigger logout after 3 consecutive failures
        this.healthCheckInterval = null;
        this.healthCheckFrequency = 30000; // Check every 30 seconds
        this.lastSuccessfulCheck = Date.now();
        this.maxOfflineTime = 5 * 60 * 1000; // 5 minutes max offline before logout
        this.isMonitoring = false;
        
        // Track API request failures
        this.apiFailureCount = 0;
        this.maxApiFailures = 5; // Trigger logout after 5 API failures in a row
        this.lastApiSuccess = Date.now();
        
        console.log('🔗 ConnectivityManager initialized');
    }

    // Start monitoring backend connectivity
    startMonitoring() {
        if (this.isMonitoring) {
            console.log('🔗 Connectivity monitoring already running');
            return;
        }

        this.isMonitoring = true;
        console.log('🔗 Starting backend connectivity monitoring...');
        
        // Initial health check
        this.performHealthCheck();
        
        // Set up periodic health checks
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, this.healthCheckFrequency);

        // Listen for online/offline events
        window.addEventListener('online', this.handleOnline.bind(this));
        window.addEventListener('offline', this.handleOffline.bind(this));
        
        // Listen for API errors
        window.addEventListener('quest-api-error', this.handleApiError.bind(this));
        
        console.log('✅ Backend connectivity monitoring started');
    }

    // Stop monitoring
    stopMonitoring() {
        if (!this.isMonitoring) return;
        
        this.isMonitoring = false;
        
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        
        window.removeEventListener('online', this.handleOnline.bind(this));
        window.removeEventListener('offline', this.handleOffline.bind(this));
        window.removeEventListener('quest-api-error', this.handleApiError.bind(this));
        
        console.log('🔗 Backend connectivity monitoring stopped');
    }

    // Perform health check against backend
    async performHealthCheck() {
        try {
            console.log('🔗 Performing backend health check...');
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            const response = await fetch(`${API_CONFIG.API_BASE_URL}/health`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const healthData = await response.json();
                this.handleHealthCheckSuccess(healthData);
            } else {
                this.handleHealthCheckFailure(`HTTP ${response.status}: ${response.statusText}`);
            }
            
        } catch (error) {
            this.handleHealthCheckFailure(error.message);
        }
    }

    // Handle successful health check
    handleHealthCheckSuccess(healthData) {
        const wasOffline = !this.isOnline;
        
        this.isOnline = true;
        this.consecutiveFailures = 0;
        this.apiFailureCount = 0; // Reset API failure count on successful health check
        this.lastSuccessfulCheck = Date.now();
        this.lastApiSuccess = Date.now();
        
        if (wasOffline) {
            console.log('✅ Backend connection restored!', healthData);
            this.showConnectivityNotification('Backend connection restored', 'success');
        } else {
            console.log('✅ Backend health check passed', healthData);
        }
        
        // Check if database is connected
        if (healthData.database === 'disconnected') {
            console.warn('⚠️ Backend database is disconnected');
            this.handleDatabaseDisconnection();
        }
    }

    // Handle failed health check
    handleHealthCheckFailure(error) {
        this.consecutiveFailures++;
        console.warn(`❌ Backend health check failed (${this.consecutiveFailures}/${this.maxConsecutiveFailures}):`, error);
        
        if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
            this.isOnline = false;
            console.error('🚨 Backend connection lost - triggering logout');
            this.triggerConnectivityLogout('Backend connection lost');
        } else {
            this.showConnectivityNotification(`Backend connection issue (${this.consecutiveFailures}/${this.maxConsecutiveFailures})`, 'warning');
        }
    }

    // Handle browser online event
    handleOnline() {
        console.log('🌐 Browser detected online connection');
        // Immediately perform health check when browser comes online
        setTimeout(() => this.performHealthCheck(), 1000);
    }

    // Handle browser offline event
    handleOffline() {
        console.log('🌐 Browser detected offline connection');
        this.isOnline = false;
        this.showConnectivityNotification('No internet connection detected', 'error');
        
        // Start offline timer
        setTimeout(() => {
            if (!this.isOnline) {
                console.error('🚨 Offline too long - triggering logout');
                this.triggerConnectivityLogout('No internet connection');
            }
        }, this.maxOfflineTime);
    }

    // Handle API errors from other parts of the application
    handleApiError(event) {
        const { status, reason } = event.detail || {};
        
        // Don't count auth errors (401/403) as connectivity issues
        if (status === 401 || status === 403) {
            return;
        }
        
        this.apiFailureCount++;
        console.warn(`❌ API request failed (${this.apiFailureCount}/${this.maxApiFailures}):`, reason);
        
        // Check if we've had too many API failures
        if (this.apiFailureCount >= this.maxApiFailures) {
            const timeSinceLastSuccess = Date.now() - this.lastApiSuccess;
            
            // Only trigger logout if it's been a while since last success
            if (timeSinceLastSuccess > 60000) { // 1 minute
                console.error('🚨 Too many API failures - triggering logout');
                this.triggerConnectivityLogout('Multiple API request failures');
            }
        }
    }

    // Handle database disconnection
    handleDatabaseDisconnection() {
        console.error('🚨 Backend database disconnected - triggering logout');
        this.triggerConnectivityLogout('Backend database unavailable');
    }

    // Trigger logout due to connectivity issues
    async triggerConnectivityLogout(reason) {
        try {
            console.log(`🚪 Triggering connectivity logout: ${reason}`);
            
            // Stop monitoring to prevent multiple logout attempts
            this.stopMonitoring();
            
            // Show notification
            this.showConnectivityNotification(`Logging out: ${reason}`, 'error');
            
            // Store logout reason for login page display
            const fullReason = `Connection lost: ${reason}`;
            localStorage.setItem('quest_logout_reason', fullReason);
            localStorage.setItem('quest_logout_timestamp', Date.now().toString());
            
            // Use token manager to handle logout
            await tokenManager.autoLogout(fullReason);
            
        } catch (error) {
            console.error('❌ Error during connectivity logout:', error);
            // Fallback to direct navigation with reason
            localStorage.setItem('quest_logout_reason', `Connection error: ${reason}`);
            localStorage.setItem('quest_logout_timestamp', Date.now().toString());
            window.location.href = `/login?reason=${encodeURIComponent(reason)}&auto=true`;
        }
    }

    // Show connectivity notification
    showConnectivityNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `connectivity-notification connectivity-${type}`;
        notification.innerHTML = `
            <div class="connectivity-notification-content">
                <span class="connectivity-icon">${this.getNotificationIcon(type)}</span>
                <span class="connectivity-message">${message}</span>
            </div>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${this.getNotificationColor(type)};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            max-width: 350px;
            animation: slideInRight 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 5000);
    }

    // Get notification icon based on type
    getNotificationIcon(type) {
        switch (type) {
            case 'success': return '✅';
            case 'warning': return '⚠️';
            case 'error': return '❌';
            default: return 'ℹ️';
        }
    }

    // Get notification color based on type
    getNotificationColor(type) {
        switch (type) {
            case 'success': return '#10B981';
            case 'warning': return '#F59E0B';
            case 'error': return '#EF4444';
            default: return '#3B82F6';
        }
    }

    // Public method to report API success (call this from successful API requests)
    reportApiSuccess() {
        this.apiFailureCount = 0;
        this.lastApiSuccess = Date.now();
    }

    // Public method to report API failure (call this from failed API requests)
    reportApiFailure(error, status) {
        // Don't count auth errors as connectivity issues
        if (status === 401 || status === 403) {
            return;
        }
        
        window.dispatchEvent(new CustomEvent('quest-api-error', {
            detail: { status, reason: error }
        }));
    }

    // Check if backend is currently reachable
    isBackendReachable() {
        return this.isOnline && this.consecutiveFailures < this.maxConsecutiveFailures;
    }

    // Get connectivity status
    getStatus() {
        return {
            isOnline: this.isOnline,
            consecutiveFailures: this.consecutiveFailures,
            apiFailureCount: this.apiFailureCount,
            lastSuccessfulCheck: this.lastSuccessfulCheck,
            lastApiSuccess: this.lastApiSuccess,
            isMonitoring: this.isMonitoring
        };
    }

    // Manual connectivity test (for debugging/testing)
    async testConnectivity() {
        console.log('🔗 Manual connectivity test initiated...');
        await this.performHealthCheck();
        return this.getStatus();
    }

    // Force connectivity failure (for testing)
    simulateConnectivityFailure() {
        console.log('🔗 Simulating connectivity failure for testing...');
        this.consecutiveFailures = this.maxConsecutiveFailures;
        this.handleHealthCheckFailure('Simulated failure for testing');
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .connectivity-notification-content {
        display: flex;
        align-items: center;
        gap: 8px;
    }
`;
document.head.appendChild(style);

// Create and export global instance
export const connectivityManager = new ConnectivityManager();

// Expose globally for debugging/testing
if (typeof window !== 'undefined') {
    window.connectivityManager = connectivityManager;
}

// Auto-start monitoring when module loads (if user is authenticated)
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is authenticated before starting monitoring
    setTimeout(() => {
        try {
            const session = localStorage.getItem('quest_user_session');
            if (session) {
                console.log('🔗 User authenticated, starting connectivity monitoring');
                connectivityManager.startMonitoring();
            }
        } catch (error) {
            console.warn('🔗 Could not check authentication status:', error);
        }
    }, 2000); // Wait 2 seconds for auth to initialize
});
