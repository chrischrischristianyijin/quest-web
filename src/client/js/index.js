import { auth } from './auth.js';

// Function to update UI based on login status
function updateUIForLoginStatus(isLoggedIn, user = null) {
    const navLinks = document.getElementById('navLinks');
    const authButtons = document.getElementById('authButtons');
    const welcomeTitle = document.getElementById('welcomeTitle');
    const tryButton = document.getElementById('tryButton');
    const ctaButton = document.getElementById('ctaButton');

    if (isLoggedIn && user) {
        navLinks.innerHTML = `
            <a href="/my-space" class="nav-link">My Space</a>
        `;
        authButtons.innerHTML = `
            <a href="/my-space" class="btn btn-outline">My Space</a>
            <button class="btn btn-primary" id="logoutBtn">Log out</button>
        `;
        tryButton.textContent = 'Go to My Space';
        tryButton.href = '/my-space';
        ctaButton.textContent = 'Go to My Space';
        ctaButton.href = '/my-space';

        // Display nickname
        if (user.nickname) {
            welcomeTitle.textContent = `Welcome back, ${user.nickname}!`;
        } else {
            welcomeTitle.textContent = 'Welcome back to Quest!';
        }

        // Bind logout event
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.onclick = function(e) {
                e.preventDefault();
                handleLogout();
            };
        }
    } else {
        navLinks.innerHTML = '';
        authButtons.innerHTML = `
            <a href="/signup" class="btn btn-outline">Sign Up</a>
            <a href="/login" class="btn btn-primary">Log In</a>
        `;
        welcomeTitle.textContent = 'Welcome to Quest';
        tryButton.innerHTML = `
            Start Your Journey
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        tryButton.href = '/signup';
        ctaButton.innerHTML = `
            Get Started for Free
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        ctaButton.href = '/signup';
    }
}

// Handle logout
async function handleLogout() {
    try {
        await auth.logout();
        updateUIForLoginStatus(false);
        window.location.href = '/';
    } catch (error) {
        console.error('Logout error:', error);
        // 即使 API 调用失败，也清除本地状态
        updateUIForLoginStatus(false);
        window.location.href = '/';
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
        interval = setInterval(nextSlide, 4000); // Switch every 4 seconds
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
            navbar.style.background = 'rgba(255, 255, 255, 0.99)';
            navbar.style.borderBottom = '1px solid rgba(75, 38, 79, 0.12)';
            navbar.style.boxShadow = '0 4px 24px rgba(0, 0, 0, 0.06)';
        } else {
            navbar.style.background = 'rgba(255, 255, 255, 0.98)';
            navbar.style.borderBottom = '1px solid rgba(75, 38, 79, 0.08)';
            navbar.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.02)';
        }
    });
}

// Check login status on page load
document.addEventListener('DOMContentLoaded', async function() {
    // 检查认证状态
    try {
        if (auth.checkAuth()) {
            const user = auth.getCurrentUser();
            updateUIForLoginStatus(true, user);
        } else {
            updateUIForLoginStatus(false);
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
        updateUIForLoginStatus(false);
    }
    
    // 初始化其他功能
    initExtensionCarousel();
    initNavbarScrollEffect();
});

// Smooth scrolling for anchor links
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});
