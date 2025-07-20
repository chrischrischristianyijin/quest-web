// Import dependencies
import { supabase } from './supabase-config.js';
import { appState } from './appState.js';
import { errorHandler } from './utils/errorHandler.js';
import { Navigation } from './components/Navigation.js';

console.log('index.js loaded and executing');
console.log('Imported supabase client status:', !!supabase);

// =====================
// Component Instances
// =====================

let navigation = null;

// =====================
// Utility Functions
// =====================

// Get user info from email
async function getUserInfo(email) {
    if (!email) return null;
    try {
        // Test DB connection
        const { error: testError } = await supabase.from('users').select('count').limit(1);
        if (testError) return { email, nickname: email.split('@')[0] };
        // Query user
        const { data: userData, error: userError } = await supabase.from('users').select('*').eq('email', email);
        if (userError) return { email, nickname: email.split('@')[0] };
        if (userData && userData.length > 0 && userData[0].nickname) {
            return { email, nickname: userData[0].nickname };
        }
        return { email, nickname: email.split('@')[0] };
    } catch (error) {
        return { email, nickname: email.split('@')[0] };
    }
}

// =====================
// Event Handlers
// =====================

// Handle form submission for adding an insight
async function handleFormSubmit(e) {
    e.preventDefault();
    const urlInput = document.querySelector('input[type="url"]');
    if (!urlInput) {
        console.error('URL input element not found');
        return;
    }
    const url = urlInput.value.trim();

    if (!url) {
        errorHandler.handleValidationError(['Please enter a URL']);
        return;
    }

    if (!appState.isAuthenticated) {
        errorHandler.handleError(new Error('Please log in to add insights'), {
            title: 'Authentication Required',
            message: 'Please log in to add insights'
        });
        return;
    }

    try {
        appState.setLoading(true);
        
        // Get user_id from users table
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', appState.user.email)
            .single();

        if (userError || !userData) {
            throw new Error('User account not found. Please sign up first.');
        }
        
        // Fetch metadata for the URL
        let meta = { title: '', image_url: '' };
        try {
            const metaRes = await fetch(`/api/v1/metadata?url=${encodeURIComponent(url)}`);
            if (metaRes.ok) meta = await metaRes.json();
        } catch (err) {
            console.warn('Metadata fetch error:', err);
        }

        // Insert the insight with metadata
        const { error: insightError } = await supabase
            .from('insights')
            .insert([{
                user_id: userData.id,
                url: url,
                title: meta.title || '',
                image_url: meta.image_url || ''
            }])
            .select()
            .single();

        if (insightError) {
            throw new Error('Failed to save your insight. Please try again.');
        }

        // Clear the input field
        urlInput.value = '';
        
        // Show success message
        errorHandler.handleError(new Error('Insight added successfully!'), {
            title: 'Success',
            message: 'Your insight has been successfully added.',
            type: 'success',
            duration: 2000
        });
        
        // Redirect after success message
        setTimeout(() => {
            window.location.href = `/spaces/my-space.html?email=${encodeURIComponent(appState.user.email)}`;
        }, 2000);
        
    } catch (error) {
        console.error('Form submission error:', error);
        errorHandler.handleError(error, {
            title: 'Error',
            message: error.message || 'An error occurred. Please try again.'
        });
    } finally {
        appState.setLoading(false);
    }
}

// =====================
// Popup Handlers
// =====================

function showPinPopup() {
    document.getElementById('overlay').style.display = 'block';
    document.getElementById('pinPopup').style.display = 'block';
}
function closePinPopup() {
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('pinPopup').style.display = 'none';
}
function showSuccessPopup() {
    document.getElementById('overlay').style.display = 'block';
    document.getElementById('successPopup').style.display = 'block';
}
function closeSuccessPopup() {
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('successPopup').style.display = 'none';
}

// =====================
// Page Initialization
// =====================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize navigation component
        const navContainer = document.querySelector('.content-wrapper');
        if (navContainer) {
            navigation = new Navigation(navContainer);
            navigation.init();
        }
        
        // Check for email in URL and update app state
    const urlParams = new URLSearchParams(window.location.search);
        const emailFromUrl = urlParams.get('email');
        
        if (emailFromUrl && !appState.isAuthenticated) {
            // If email in URL but not authenticated, set user state
            await appState.setUser({ email: emailFromUrl });
    }
    
        // Pre-fill email input if present
    const emailInput = document.querySelector('input[type="email"]');
    if (emailInput && emailFromUrl) {
        emailInput.value = emailFromUrl;
    }
    
        // Bind form submit
    const form = document.querySelector('form');
        if (form) form.addEventListener('submit', handleFormSubmit);

        // PIN input popup logic
    let hasSeenPinPopup = false;
    const pinInput = document.querySelector('input[type="password"]');
    if (pinInput) {
        pinInput.addEventListener('focus', function() {
            if (!hasSeenPinPopup) {
                showPinPopup();
                hasSeenPinPopup = true;
            }
        });
        pinInput.addEventListener('input', function() {
            this.value = this.value.replace(/[^0-9]/g, '').slice(0, 6);
        });
    }

        // Popup close handlers
    const overlay = document.getElementById('overlay');
    if (overlay) {
        overlay.addEventListener('click', function() {
            closePinPopup();
            closeSuccessPopup();
        });
    }
    const pinPopupButton = document.querySelector('#pinPopup button');
        if (pinPopupButton) pinPopupButton.addEventListener('click', closePinPopup);
    const successPopupButton = document.querySelector('#successPopup button');
        if (successPopupButton) successPopupButton.addEventListener('click', closeSuccessPopup);
        
    } catch (error) {
        console.error('Page initialization error:', error);
        errorHandler.handleError(error, {
            title: 'Initialization Error',
            message: 'Failed to initialize the page properly'
        });
    }
});

// =====================
// Export Functions
// =====================

export {
    getUserInfo,
    showPinPopup,
    closePinPopup,
    showSuccessPopup,
    closeSuccessPopup,
    handleFormSubmit
}; 