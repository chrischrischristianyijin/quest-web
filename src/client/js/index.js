import { auth } from './auth.js';
import { PATHS, navigateTo } from './paths.js';
import { api } from './api.js';

// DOM elements
const welcomeTitle = document.getElementById('welcomeTitle');
const tryButton = document.getElementById('tryButton');

// Update navigation based on login status
function updateNavigation(isLoggedIn, user = null) {
    const authButtons = document.getElementById('authButtons');
    const dynamicExploreBtn = document.getElementById('dynamicExploreBtn');
    
    if (!authButtons) return;
    
    if (isLoggedIn && user) {
        // User is logged in - show logout button
        authButtons.innerHTML = `
            <a href="${PATHS.MY_SPACE}" class="auth-btn auth-btn-secondary">My Space</a>
            <button class="auth-btn auth-btn-secondary" onclick="handleLogout()">
                Logout
            </button>
        `;
        
        // Update explore button to go to My Space
        if (dynamicExploreBtn) {
            dynamicExploreBtn.textContent = 'Go to My Space';
            dynamicExploreBtn.href = PATHS.MY_SPACE;
        }
    } else {
        // User is not logged in - show login and signup buttons
        authButtons.innerHTML = `
            <a href="${PATHS.LOGIN}" class="auth-btn auth-btn-secondary">Login</a>
            <a href="${PATHS.SIGNUP}" class="auth-btn auth-btn-primary">Sign Up</a>
        `;
        
        // Update explore button to go to Sign Up
        if (dynamicExploreBtn) {
            dynamicExploreBtn.textContent = 'Explore Features Signup';
            dynamicExploreBtn.href = PATHS.SIGNUP;
        }
    }
}

// Update UI based on login status
function updateUIForLoginStatus(isLoggedIn, user = null) {
    if (isLoggedIn && user) {
        // User is logged in
        console.log('✅ User is logged in:', user);
        
        // Update welcome title
        if (welcomeTitle) {
            welcomeTitle.textContent = `Welcome back, ${user.nickname}!`;
        }
        
        // Update button
        if (tryButton) {
            tryButton.textContent = 'Go to My Space';
            tryButton.href = PATHS.MY_SPACE;
        }
        
        // Update navigation buttons
        updateNavigation(true, user);
        
        console.log('✅ UI updated for logged in user');
    } else {
        // User is not logged in
        console.log('❌ User is not logged in');
        
        // Reset welcome title
        if (welcomeTitle) {
            welcomeTitle.textContent = 'Welcome to Quest';
        }
        
        // Reset button
        if (tryButton) {
            tryButton.innerHTML = `
                Start Your Journey
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
            tryButton.href = PATHS.SIGNUP;
        }
        
        // Update navigation buttons
        updateNavigation(false);
        
        console.log('✅ UI updated for guest user');
    }
}

// Handle logout
async function handleLogout() {
    console.log('🚪 User clicked logout...');
    
    try {
        // Clear local state directly
        await auth.logout();
        
        // Update UI state
        updateUIForLoginStatus(false);
        updateNavigation(false); // Update navigation bar
        
        // Redirect to home page immediately
        window.location.href = PATHS.HOME;
        
    } catch (error) {
        console.error('❌ Logout failed:', error);
        
        // Even if there's an error, clear local state and redirect
        updateUIForLoginStatus(false);
        updateNavigation(false); // Update navigation bar
        window.location.href = PATHS.HOME;
    }
}

// Show logout message
function showLogoutMessage(message, type = 'info') {
    // Remove existing message
    const existingMessage = document.querySelector('.logout-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    const messageElement = document.createElement('div');
    messageElement.className = `logout-message logout-message-${type}`;
    messageElement.innerHTML = `
        <div class="message-content">
            <svg class="message-icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
                ${type === 'success' ? 
                    '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="22,4 12,14.01 9,11.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' :
                    type === 'error' ?
                    '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2"/><line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2"/>' :
                    '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
                }
            </svg>
            <span class="message-text">${message}</span>
        </div>
    `;
    
    // Add styles
    messageElement.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        font-size: 14px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 8px;
        max-width: 300px;
        animation: slideInRight 0.3s ease-out;
    `;
    
    document.body.appendChild(messageElement);
    
    // Auto hide
    setTimeout(() => {
        if (messageElement.parentNode) {
            messageElement.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.remove();
                }
            }, 300);
        }
    }, 3000);
    
    // Add CSS animations
    if (!document.querySelector('#logout-message-styles')) {
        const style = document.createElement('style');
        style.id = 'logout-message-styles';
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Extension Carousel Functionality
function initExtensionCarousel() {
    const slides = document.querySelectorAll('.carousel-slide');
    const indicators = document.querySelectorAll('.carousel-indicator');
    
    if (!slides.length || !indicators.length) return;
    
    let currentSlide = 0;
    let interval;

    function showSlide(index) {
        // Remove all classes from slides
        slides.forEach(slide => {
            slide.classList.remove('active');
        });
        indicators.forEach(indicator => indicator.classList.remove('active'));
        
        // Add active class to current slide
        slides[index].classList.add('active');
        indicators[index].classList.add('active');
    }

    function nextSlide() {
        currentSlide = (currentSlide + 1) % slides.length;
        showSlide(currentSlide);
    }

    function startCarousel() {
        interval = setInterval(nextSlide, 2000); // Switch every 2 seconds
    }

    function stopCarousel() {
        clearInterval(interval);
    }

    // Add click handlers to indicators
    indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', () => {
            currentSlide = index;
            showSlide(currentSlide);
            stopCarousel();
            startCarousel(); // Restart the timer
        });
    });

    // Initialize with first slide
    showSlide(0);
    
    // Start the carousel
    startCarousel();

    // Pause on hover
    const carousel = document.querySelector('.extension-carousel');
    if (carousel) {
        carousel.addEventListener('mouseenter', stopCarousel);
        carousel.addEventListener('mouseleave', startCarousel);
    }

    // Add keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            currentSlide = (currentSlide - 1 + slides.length) % slides.length;
            showSlide(currentSlide);
            stopCarousel();
            startCarousel();
        } else if (e.key === 'ArrowRight') {
            currentSlide = (currentSlide + 1) % slides.length;
            showSlide(currentSlide);
            stopCarousel();
            startCarousel();
        }
    });
}

// Navbar scroll effect
function initNavbarScrollEffect() {
    window.addEventListener('scroll', function() {
        const navbar = document.querySelector('.navbar');
        if (!navbar) return;
        
        if (window.scrollY > 50) {
            navbar.style.background = 'rgba(255, 255, 255, 0.15)';
            navbar.style.backdropFilter = 'blur(24px) saturate(180%)';
            navbar.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)';
            navbar.style.boxShadow = '0 4px 32px rgba(0, 0, 0, 0.15)';
        } else {
            navbar.style.background = 'rgba(255, 255, 255, 0.1)';
            navbar.style.backdropFilter = 'blur(24px) saturate(180%)';
            navbar.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
            navbar.style.boxShadow = '0 4px 32px rgba(0, 0, 0, 0.1)';
        }
    });
}

// Message display function
function showMessage(message, type = 'info') {
    // Create message element
    const messageEl = document.createElement('div');
    messageEl.className = `message message-${type}`;
    messageEl.textContent = message;
    
    // Style the message
    messageEl.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transform: translateX(100%);
        transition: transform 0.3s ease;
        ${type === 'success' ? 'background: #10b981;' : ''}
        ${type === 'error' ? 'background: #ef4444;' : ''}
        ${type === 'info' ? 'background: #3b82f6;' : ''}
    `;
    
    // Add to page
    document.body.appendChild(messageEl);
    
    // Animate in
    setTimeout(() => {
        messageEl.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 5 seconds
    setTimeout(() => {
        messageEl.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 300);
    }, 5000);
}

// Waitlist functionality
function initWaitlist() {
    const waitlistEmail = document.getElementById('waitlistEmail');
    const waitlistButton = document.getElementById('waitlistButton');
    
    if (!waitlistEmail || !waitlistButton) return;
    
    // Handle waitlist submission
    async function handleWaitlistSubmit() {
        const email = waitlistEmail.value.trim();
        
        if (!email) {
            showMessage('Please enter your email address', 'error');
            return;
        }
        
        if (!isValidEmail(email)) {
            showMessage('Please enter a valid email address', 'error');
            return;
        }
        
        // Show loading state
        waitlistButton.textContent = 'Joining...';
        waitlistButton.disabled = true;
        
        try {
            console.log('🚀 Attempting to join waitlist with email:', email);
            
            // Call real API
            const response = await api.joinWaitlist(email);
            
            console.log('📡 API Response:', response);
            
            if (response.success) {
                showMessage(response.message, 'success');
                waitlistEmail.value = '';
            } else {
                showMessage(response.message || 'Failed to join waitlist', 'error');
            }
        } catch (error) {
            console.error('❌ Waitlist error:', error);
            showMessage('Failed to join waitlist. Please try again.', 'error');
        } finally {
            // Reset button state
            waitlistButton.textContent = 'Done';
            waitlistButton.disabled = false;
        }
    }
    
    // Email validation
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    // Event listeners
    waitlistButton.addEventListener('click', handleWaitlistSubmit);
    
    waitlistEmail.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleWaitlistSubmit();
        }
    });
    
    // Focus effects
    waitlistEmail.addEventListener('focus', function() {
        this.style.borderColor = '#54497D';
        this.style.color = '#332564';
    });
    
    waitlistEmail.addEventListener('blur', function() {
        if (!this.value) {
            this.style.borderColor = 'rgba(0, 0, 0, 0.25)';
            this.style.color = '#AAAAAA';
        }
    });
}

// Check login status on page load
document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication status
    try {
        if (auth.checkAuth()) {
            const user = auth.getCurrentUser();
            updateUIForLoginStatus(true, user); // This now calls updateNavigation internally
        } else {
            updateUIForLoginStatus(false); // This now calls updateNavigation internally
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
        updateUIForLoginStatus(false); // This now calls updateNavigation internally
    }
    
    // Initialize other features
    initExtensionCarousel();
    initNavbarScrollEffect();
    initWaitlist();
});

// Smooth scrolling for anchor links with active state management
document.addEventListener('DOMContentLoaded', function() {
    // Handle navigation link clicks
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                // Add smooth scroll animation
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                
                // Update active state
                updateActiveNavLink(this.getAttribute('href'));
            }
        });
    });
    
    // Initialize scroll spy for active navigation
    initScrollSpy();
});

// Update active navigation link
function updateActiveNavLink(targetId) {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === targetId) {
            link.classList.add('active');
        }
    });
}

// Scroll spy functionality
function initScrollSpy() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link[href^="#"]');
    
    // Throttle function for better performance
    function throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    }
    
    // Check which section is in view
    function checkSectionInView() {
        let current = '';
        const scrollPosition = window.scrollY + 100; // Offset for better UX
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            
            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                current = section.getAttribute('id');
            }
        });
        
        // Update active navigation link
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    }
    
    // Add scroll event listener with throttling
    window.addEventListener('scroll', throttle(checkSectionInView, 100));
    
    // Initial check
    checkSectionInView();
}

// Expose functions to global scope
window.handleLogout = handleLogout;
