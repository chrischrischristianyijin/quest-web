document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("signupForm");
  const messageDiv = document.getElementById("message");
  const emailInput = document.getElementById("email");
  const nicknameInput = document.getElementById("nickname");
  const passwordInput = document.getElementById("password");
  const confirmPasswordInput = document.getElementById("confirmPassword");
  const signupButton = form.querySelector(".signup-button");
  
  let isPasswordValid = false;
  let isPasswordMatch = false;
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
    const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/;
    
    if (password.length < minLength) {
      return "Password must be at least 8 characters long";
    }
    
    if (!specialCharRegex.test(password)) {
      return "Password must contain at least one special character";
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
    
    // Update password validation state
    const passwordError = validatePassword(password);
    isPasswordValid = !passwordError;
    
    // Update password match state
    isPasswordMatch = password && confirmPassword && password === confirmPassword;
    
    // Check if email is valid format (separate from availability)
    const isEmailFormatValid = email && validateEmail(email);
    
    // Check if nickname is valid (not empty)
    isNicknameValid = nickname.length > 0;
    
    // Update button appearance if all validations pass
    // Note: Email availability is now checked only on form submission
    const isFormValid = isEmailFormatValid && isPasswordValid && isPasswordMatch && isNicknameValid;
    
    if (isFormValid) {
      signupButton.classList.add("active");
    } else {
      signupButton.classList.remove("active");
    }
  }

  // Email validation - only check format, not availability
  emailInput.addEventListener("input", function() {
    const email = this.value.trim();
    messageDiv.style.display = "none";
    
    // Only check email format, not availability
    if (email && !validateEmail(email)) {
      showMessage("Please enter a valid email address", true);
    } else if (email && validateEmail(email)) {
      messageDiv.style.display = "none";
    }
    
    updateButtonState();
  });

  // Password validation
  passwordInput.addEventListener("input", function() {
    const error = validatePassword(this.value);
    isPasswordValid = !error;
    
    if (error) {
      showMessage(error, true);
    } else {
      messageDiv.style.display = "none";
    }
    
    // Check password match if confirm password is not empty
    if (confirmPasswordInput.value) {
      isPasswordMatch = this.value === confirmPasswordInput.value;
      if (!isPasswordMatch) {
        showMessage("Passwords do not match", true);
      }
    }
    
    updateButtonState();
  });

  // Confirm password validation
  confirmPasswordInput.addEventListener("input", function() {
    if (this.value) {
      isPasswordMatch = this.value === passwordInput.value;
      if (!isPasswordMatch) {
        showMessage("Passwords do not match", true);
      } else {
        messageDiv.style.display = "none";
      }
    }
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
});
