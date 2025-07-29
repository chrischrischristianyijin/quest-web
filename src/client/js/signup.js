document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("signupForm");
  const messageDiv = document.getElementById("message");
  const emailInput = document.getElementById("email");
  const nicknameInput = document.getElementById("nickname");
  const passwordInput = document.getElementById("password");
  const confirmPasswordInput = document.getElementById("confirmPassword");
  const signupButton = form.querySelector(".signup-button");
  
  let isNicknameValid = false;

  function showMessage(message, isError = false) {
    messageDiv.textContent = message;
    messageDiv.className = `message ${isError ? "error" : "success"}`;
    messageDiv.style.display = "block";
    
    if (isError) {
      messageDiv.style.animation = 'none';
      messageDiv.offsetHeight; // Trigger reflow
      messageDiv.style.animation = 'shake 0.5s';
    }
  }

  function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  function validatePassword(password) {
    const minLength = 8;
    
    if (password.length < minLength) {
      return "Password must be at least 8 characters long";
    }
    
    return null; // Password is valid
  }

  async function checkEmailAvailability(email) {
    try {
      console.log('Checking email availability for:', email);
      const checkResponse = await fetch("/api/v1/auth/check-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      console.log('Response status:', checkResponse.status);
      console.log('Response headers:', Object.fromEntries(checkResponse.headers.entries()));

      // Check if response is JSON
      const contentType = checkResponse.headers.get("content-type");
      console.log('Content-Type:', contentType);
      
      if (!contentType || !contentType.includes("application/json")) {
        console.error('Invalid content type:', contentType);
        throw new Error('Server error: Expected JSON response but got HTML. Please check if the server is running.');
      }

      if (!checkResponse.ok) {
        throw new Error('Failed to check email availability');
      }

      const checkResult = await checkResponse.json();
      console.log('Email check result:', checkResult);
      
      if (checkResult.exists) {
        showMessage("This email is already registered", true);
      } else {
        messageDiv.style.display = "none";
      }
      
      updateButtonState();
    } catch (error) {
      console.error("Email check failed:", error);
      console.error("Full error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      showMessage("Unable to verify email availability. Please try again later.", true);
      updateButtonState();
    }
  }

  function updateButtonState() {
    const email = emailInput.value.trim();
    const nickname = nicknameInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    
    // Check if email is filled (not empty)
    const isEmailFilled = email.length > 0;
    
    // Check if nickname is valid (not empty)
    isNicknameValid = nickname.length > 0;
    
    // Check if password and confirm password are not empty
    const isPasswordFilled = password.length > 0;
    const isConfirmPasswordFilled = confirmPassword.length > 0;
    
    // Update button appearance if basic validations pass
    // Note: Detailed validation (email format, password requirements, email availability) are checked only on form submission
    const isFormValid = isEmailFilled && isNicknameValid && isPasswordFilled && isConfirmPasswordFilled;
    
    if (isFormValid) {
      signupButton.classList.add("active");
    } else {
      signupButton.classList.remove("active");
    }
  }

  // Email input - only clear messages, no real-time validation
  emailInput.addEventListener("input", function() {
    messageDiv.style.display = "none";
    updateButtonState();
  });

  // Password input - only clear messages, no real-time validation
  passwordInput.addEventListener("input", function() {
    messageDiv.style.display = "none";
    updateButtonState();
  });

  // Confirm password input - only clear messages, no real-time validation
  confirmPasswordInput.addEventListener("input", function() {
    messageDiv.style.display = "none";
    updateButtonState();
  });

  // Form submission
  form.addEventListener("submit", async function(e) {
    e.preventDefault();

    const email = emailInput.value.trim();
    const nickname = nicknameInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Final validation before submit
    if (!validateEmail(email)) {
      showMessage("Please enter a valid email address", true);
      return;
    }

    if (!nickname) {
      showMessage("Please enter a nickname", true);
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      showMessage(passwordError, true);
      return;
    }

    if (password !== confirmPassword) {
      showMessage("Passwords do not match", true);
      return;
    }

    try {
      signupButton.textContent = "Checking email...";
      
      // Check email availability before creating account
      const checkResponse = await fetch("/api/v1/auth/check-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!checkResponse.ok) {
        throw new Error('Failed to check email availability');
      }

      const checkResult = await checkResponse.json();
      
      if (checkResult.exists) {
        showMessage("This email is already registered", true);
        signupButton.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M13 5L20 12L13 19M4 12H20" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Sign Up
        `;
        return;
      }

      signupButton.textContent = "Creating account...";

      const signupResponse = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          nickname: nickname,
          password: password
        }),
      });

      // Check if response is JSON
      const contentType = signupResponse.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error('Server error: Expected JSON response but got HTML. Please check if the server is running.');
      }

      const data = await signupResponse.json();

      if (signupResponse.ok) {
        showMessage("Account created successfully! Redirecting to My Space...", false);
        
        // Store user session information
        if (data && data.user) {
          localStorage.setItem('quest_user_session', JSON.stringify({
            user: data.user,
            timestamp: Date.now()
          }));
        }
        
        setTimeout(() => {
          // Redirect to my-space with email parameter after successful signup
          document.location.href = `/spaces/my-space.html?email=${encodeURIComponent(email)}`;
        }, 1500);
      } else {
        throw new Error(data.message || "Error creating account");
      }
    } catch (error) {
      console.error("Signup error:", error);
      showMessage(error.message || "An error occurred during signup. Please try again.", true);
      signupButton.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M13 5L20 12L13 19M4 12H20" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Sign Up
      `;
    }
  });

  // Initial button state
  updateButtonState();

  // Google OAuth Configuration - will be handled by backend
  // Client ID and scopes are managed through backend OAuth flow

  // Google Signup Button
  const googleSignupBtn = document.getElementById('googleSignupBtn');
  
  if (googleSignupBtn) {
    googleSignupBtn.addEventListener('click', async function() {
      try {
        console.log('🔐 Starting Google OAuth flow for signup...');
        showMessage('Redirecting to Google...', false);
        
        // Use backend OAuth endpoint (like extension does)
        const authUrl = window.location.origin + '/api/v1/auth/google/login';
        
        console.log('📡 Redirecting to backend OAuth endpoint:', authUrl);
        window.location.href = authUrl;
        
      } catch (error) {
        console.error('❌ Google auth error:', error);
        showMessage('Google authentication failed', true);
      }
    });
  }
});
