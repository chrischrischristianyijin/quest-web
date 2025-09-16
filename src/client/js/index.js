// Import auth module
import { auth } from './auth.js';

// Make auth available globally
window.auth = auth;

// === 1) Navigation to match the new sections ===
function updateNavigation(isLoggedIn, user = null) {
    const navLinks = document.getElementById('navLinks');
    const authButtons = document.getElementById('authButtons');
    if (!navLinks || !authButtons) return;
    
    const linksHtml = `
            <a href="#home" class="nav-link" data-translate="home">HOME</a>
            <a href="#extension" class="nav-link" data-translate="extension">EXTENSION</a>
            <a href="#features" class="nav-link" data-translate="features">FEATURES</a>
            <a href="#beta" class="nav-link" data-translate="beta">BETA</a>
            <a href="#contact" class="nav-link" data-translate="contact">CONTACT</a>
    `;
  
    if (isLoggedIn && user) {
      navLinks.innerHTML = linksHtml + `<a href="/my-space" class="nav-link" data-translate="my_space">MY SPACE</a>`;
      authButtons.innerHTML = `
        <button class="translation-btn" id="translationToggle">
          <span class="translation-flag">🌐</span>
          <span class="translation-text" data-translate="language">EN</span>
        </button>
        <button class="auth-btn auth-btn-secondary" id="logoutBtn" data-translate="log_out">Logout</button>
      `;
      document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
    } else {
      navLinks.innerHTML = linksHtml;
      authButtons.innerHTML = `
        <button class="translation-btn" id="translationToggle">
          <span class="translation-flag">🌐</span>
          <span class="translation-text" data-translate="language">EN</span>
        </button>
        <a href="/login" class="auth-btn auth-btn-secondary" data-translate="log_in">Log In</a>
        <a href="/signup" class="auth-btn auth-btn-primary" data-translate="sign_up">Sign Up</a>
      `;
    }
  }
  
  // === 2) Hero CTA target (signup when logged out, My Space when logged in) ===
  function wireHeroCta(isLoggedIn) {
    const cta = document.getElementById('signupCta');
    if (!cta) return;
    cta.href = isLoggedIn ? '/my-space' : '/signup';
    
    // Use translation manager if available
    if (window.translationManager) {
      const key = isLoggedIn ? 'go_to_my_space' : 'signup_cta';
      cta.textContent = window.translationManager.t(key);
    } else {
      cta.textContent = isLoggedIn ? 'Go to My Space' : 'Sign up — It\'s Free!';
    }
  }
  
  // === 3) “Canvas drag” parallax (color-stable) ===
  function initHeroParallax() {
    const canvas = document.querySelector('.hero-canvas');
    const screen = document.getElementById('heroScreen');
    if (!canvas || !screen) return;
  
    const apply = (x, y) => {
      // subtle translate only; no filters / hue changes
      canvas.style.transform = `translate(${x * 0.03}px, ${y * 0.03}px)`;
      screen.style.transform = `translate(${x * 0.02}px, ${y * 0.02}px)`;
    };
  
    window.addEventListener('pointermove', (e) => {
      const { innerWidth: w, innerHeight: h } = window;
      const x = (e.clientX - w / 2);
      const y = (e.clientY - h / 2);
      apply(x, y);
    });
    window.addEventListener('mouseleave', () => apply(0, 0));
  }
  
  // === 3.5) Logout handler ===
  async function handleLogout() {
    try {
      if (window.auth && window.auth.logout) {
        await window.auth.logout();
        // Redirect to home page after logout
        window.location.href = '/';
        }
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  // === 4) Carousel functionality ===
  function initCarousel() {
    const slides = document.querySelectorAll('.carousel-slide');
    const indicators = document.querySelectorAll('.indicator');
    let currentSlide = 0;
    let intervalId = null;

    if (slides.length === 0) {
      console.log('No carousel slides found');
      return;
    }

    console.log(`Carousel initialized with ${slides.length} slides`);

    function showSlide(index) {
      // Remove active class from all slides and indicators
      slides.forEach(slide => slide.classList.remove('active'));
      indicators.forEach(indicator => indicator.classList.remove('active'));

      // Add active class to current slide and indicator
      if (slides[index]) slides[index].classList.add('active');
      if (indicators[index]) indicators[index].classList.add('active');
    }

    function nextSlide() {
      currentSlide = (currentSlide + 1) % slides.length;
      showSlide(currentSlide);
    }

    function startCarousel() {
      // Clear any existing interval first
      if (intervalId) {
        clearInterval(intervalId);
      }
      intervalId = setInterval(nextSlide, 2000); // Change slide every 2 seconds
      console.log('Carousel started');
    }

    // Initialize first slide
    showSlide(0);

    // Start automatic cycling
    startCarousel();

    // Add click handlers to indicators (just for visual feedback, doesn't stop cycling)
    indicators.forEach((indicator, index) => {
      indicator.addEventListener('click', () => {
        currentSlide = index;
        showSlide(currentSlide);
        // Don't stop the carousel, just jump to the clicked slide
      });
    });

    // Safety net - restart carousel every 10 seconds to ensure it keeps running
    setInterval(() => {
      if (!intervalId) {
        console.log('Carousel restarted (safety net)');
        startCarousel();
      }
    }, 10000);
  }

  // === 5) Boot ===
  document.addEventListener('DOMContentLoaded', async () => {
    // Your existing auth check (reuse your auth/api if present)
    let isLoggedIn = false, user = null;
    try {
      user = await (window.auth?.getUser?.() ?? null);
      isLoggedIn = !!user;
    } catch { /* noop */ }
  
    updateNavigation(isLoggedIn, user);
    wireHeroCta(isLoggedIn);
    initHeroParallax();
    initCarousel();
    
    // Re-apply translations and setup event listeners after navigation is set up
    if (window.translationManager) {
      // Small delay to ensure DOM is fully updated
      setTimeout(() => {
        window.translationManager.setupEventListeners(); // Re-setup event listeners for dynamically created buttons
        window.translationManager.applyTranslations();
      }, 100);
    }

    // Ensure the hero demo video keeps playing regardless of scroll/visibility
    const demoVideo = document.getElementById('heroDemoVideo');
    if (demoVideo) {
      const ensurePlay = () => {
        if (demoVideo.paused) {
          demoVideo.play().catch(() => {});
        }
      };
      // Try to start ASAP
      ensurePlay();
      // Resume on visibility changes
      document.addEventListener('visibilitychange', ensurePlay);
      // Resume when scrolled back or layout changes
      window.addEventListener('scroll', ensurePlay, { passive: true });
      window.addEventListener('focus', ensurePlay);
    }
  });