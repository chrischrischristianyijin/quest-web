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
            <a href="#home" class="nav-link">HOME</a>
            <a href="#extension" class="nav-link">EXTENSION</a>
      <a href="#features" class="nav-link">FEATURES</a>
      <a href="#beta" class="nav-link">BETA</a>
      <a href="#contact" class="nav-link">CONTACT</a>
    `;
  
    if (isLoggedIn && user) {
      navLinks.innerHTML = linksHtml + `<a href="/my-space" class="nav-link">MY SPACE</a>`;
      authButtons.innerHTML = `<button class="auth-btn auth-btn-secondary" id="logoutBtn">Logout</button>`;
      document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
    } else {
      navLinks.innerHTML = linksHtml;
      authButtons.innerHTML = `
        <a href="/login" class="auth-btn auth-btn-secondary">Log In</a>
        <a href="/signup" class="auth-btn auth-btn-primary">Sign Up</a>
      `;
    }
  }
  
  // === 2) Hero CTA target (signup when logged out, My Space when logged in) ===
  function wireHeroCta(isLoggedIn) {
    const cta = document.getElementById('signupCta');
    if (!cta) return;
    cta.href = isLoggedIn ? '/my-space' : '/signup';
    cta.textContent = isLoggedIn ? 'Go to My Space' : 'Sign up — It’s Free!';
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

    if (slides.length === 0) return;

    function showSlide(index) {
      // Remove active class from all slides and indicators
      slides.forEach(slide => slide.classList.remove('active'));
      indicators.forEach(indicator => indicator.classList.remove('active'));

      // Add active class to current slide and indicator
      slides[index].classList.add('active');
      indicators[index].classList.add('active');
    }

    function nextSlide() {
      currentSlide = (currentSlide + 1) % slides.length;
      showSlide(currentSlide);
    }

    function startCarousel() {
      intervalId = setInterval(nextSlide, 2000); // Change slide every 2 seconds
    }

    function stopCarousel() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }

    // Initialize first slide
    showSlide(0);

    // Start automatic cycling
    startCarousel();

    // Add click handlers to indicators
    indicators.forEach((indicator, index) => {
      indicator.addEventListener('click', () => {
        currentSlide = index;
        showSlide(currentSlide);
        stopCarousel();
        startCarousel(); // Restart the timer
      });
    });

    // Pause on hover, resume on mouse leave
    const carouselContainer = document.querySelector('.carousel-container');
    if (carouselContainer) {
      carouselContainer.addEventListener('mouseenter', stopCarousel);
      carouselContainer.addEventListener('mouseleave', startCarousel);
    }
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
  });