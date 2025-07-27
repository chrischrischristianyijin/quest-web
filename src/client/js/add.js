// Import Supabase client
import { supabase } from '../../../supabase/config.js';

// Function to get user info from email parameter
async function getUserInfo(email) {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('nickname, email')
            .eq('email', email)
            .single();

        if (error) {
            console.error('Error fetching user:', error);
            return null;
        }

        return user;
    } catch (error) {
        console.error('Error in getUserInfo:', error);
        return null;
    }
}

// Function to update welcome message
async function updateWelcomeMessage() {
    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get('email');
    const welcomeContainer = document.querySelector('.welcome-message');
    const visitSpaceLink = document.querySelector('#visitSpaceLink');
    
    if (!email) {
        console.error('No email found in URL');
        if (welcomeContainer) {
            welcomeContainer.textContent = 'Welcome to Quest';
        }
        return;
    }

    // Update Visit The Space link with email parameter
    if (visitSpaceLink) {
        visitSpaceLink.href = `/spaces/visit-space.html?email=${encodeURIComponent(email)}`;
    }

    // Immediately update welcome message with email prefix to avoid flashing
    const emailPrefix = email.split('@')[0];
    if (welcomeContainer) {
        welcomeContainer.textContent = `Welcome back, ${emailPrefix}!`;
        welcomeContainer.style.color = '#D76E13'; // Orange color for nickname
        welcomeContainer.style.fontWeight = '600';
    }

    // Then asynchronously get and update nickname if available
    try {
        const user = await getUserInfo(email);
        if (user && user.nickname && user.nickname !== emailPrefix) {
            if (welcomeContainer) {
                welcomeContainer.textContent = `Welcome back, ${user.nickname}!`;
                welcomeContainer.style.color = '#D76E13'; // Orange color for nickname
                welcomeContainer.style.fontWeight = '600';
            }
        }
    } catch (error) {
        console.error('Error updating welcome message:', error);
        // Keep the email prefix if nickname fetch fails
    }
}

// Function to handle form submission
async function handleSubmit(event) {
    event.preventDefault();
    
    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get('email');
    
    if (!email) {
        alert('Please provide an email address');
        return;
    }

    const linkInput = document.querySelector('#linkInput');
    const pinInput = document.querySelector('#pinInput');
    
    if (!linkInput || !pinInput) {
        console.error('Required form elements not found');
        return;
    }

    const url = linkInput.value.trim();
    const pin = pinInput.value.trim();

    if (!url || !pin) {
        alert('Please fill in all required fields');
        return;
    }

    try {
        const response = await fetch('/api/v1/insights', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url,
                email,
                pin
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to add insight');
        }

        // Clear form and show success message
        linkInput.value = '';
        pinInput.value = '';
        alert('Successfully added to your collection!');
        
        // Optionally redirect to collection page
                    window.location.href = `/spaces/my-space.html?email=${encodeURIComponent(email)}`;
    } catch (error) {
        console.error('Error adding insight:', error);
        alert(error.message || 'Failed to add insight. Please try again.');
    }
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    // Update welcome message
    updateWelcomeMessage();
    
    // Add form submit handler
    const form = document.querySelector('#addForm');
    if (form) {
        form.addEventListener('submit', handleSubmit);
    }
}); 