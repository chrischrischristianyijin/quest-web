document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("loginForm");
    const messageDiv = document.getElementById("message");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const loginButton = form.querySelector(".login-button");
    
    // Forgot Password Modal Elements
    const forgotPasswordLink = document.getElementById("forgotPasswordLink");
    const forgotPasswordModal = document.getElementById("forgotPasswordModal");
    const closeModal = document.getElementById("closeModal");
    const forgotPasswordForm = document.getElementById("forgotPasswordForm");
    const resetEmailInput = document.getElementById("resetEmail");
    const resetPasswordButton = document.getElementById("resetPasswordButton");
    const modalMessage = document.getElementById("modalMessage");

    function showMessage(message, isError = false) {
        messageDiv.textContent = message;
        messageDiv.className = isError ? "error" : "success";
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
        // For login, we only check if password is not empty
        // Password strength validation is only for signup
        if (!password || password.trim().length === 0) {
            return "Password is required";
        }
        
        return null; // Password is valid
    }

    function updateButtonState() {
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        
        if (email && password) {
            loginButton.classList.add("active");
        } else {
            loginButton.classList.remove("active");
        }
    }

    form.addEventListener("submit", async function(e) {
        e.preventDefault();

        if (!loginButton.classList.contains("active")) {
            return;
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        // Basic validation
        if (!email || !password) {
            showMessage("Please fill in all fields", true);
            return;
        }

        if (!validateEmail(email)) {
            showMessage("Please enter a valid email address", true);
            return;
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            showMessage(passwordError, true);
            return;
        }

        try {
            loginButton.textContent = "Logging in...";
            const loginResponse = await fetch("/api/v1/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: email,
                    password: password,
                }),
            });

            if (loginResponse.ok) {
                const result = await loginResponse.json();
                showMessage("Login successful! Redirecting...", false);
                
                // Store user session information
                if (result && result.user) {
                    localStorage.setItem('quest_user_session', JSON.stringify({
                        user: result.user,
                        timestamp: Date.now()
                    }));
                }
                
                setTimeout(() => {
                    // Redirect to my-space with email parameter
                    window.location.href = `/spaces/my-space.html?email=${encodeURIComponent(email)}`;
                }, 1000);
            } else {
                const errorData = await loginResponse.json();
                const errorMessage = errorData.message || "Invalid email or password";
                showMessage(errorMessage, true);
                loginButton.innerHTML = `
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M13 5L20 12L13 19M4 12H20" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Log in
                `;
            }
        } catch (error) {
            console.error("Login error:", error);
            let errorMessage = "An error occurred during login. Please try again.";
            if (error.message && typeof error.message === 'string') {
                // Remove any JSON-like wrapping if present
                errorMessage = error.message.replace(/^\{"message":\s*"|"\}$/g, '');
            }
            showMessage(errorMessage, true);
        }
    });

    // Update button state and clear message when user types
    emailInput.addEventListener("input", () => {
        messageDiv.style.display = "none";
        updateButtonState();
    });

    passwordInput.addEventListener("input", () => {
        messageDiv.style.display = "none";
        updateButtonState();
    });

    // Initial button state
    updateButtonState();

    // Forgot Password Modal Functions
    function showModal() {
        forgotPasswordModal.classList.add("show");
        resetEmailInput.focus();
    }

    function hideModal() {
        forgotPasswordModal.classList.remove("show");
        resetEmailInput.value = "";
        modalMessage.style.display = "none";
        modalMessage.className = "modal-message";
    }

    function showModalMessage(message, isError = false) {
        modalMessage.textContent = message;
        modalMessage.className = `modal-message ${isError ? "error" : "success"}`;
        modalMessage.style.display = "block";
    }

    // Modal Event Listeners
    forgotPasswordLink.addEventListener("click", function(e) {
        e.preventDefault();
        showModal();
    });

    closeModal.addEventListener("click", function() {
        hideModal();
    });

    // Close modal when clicking outside
    forgotPasswordModal.addEventListener("click", function(e) {
        if (e.target === forgotPasswordModal) {
            hideModal();
        }
    });

    // Close modal with Escape key
    document.addEventListener("keydown", function(e) {
        if (e.key === "Escape" && forgotPasswordModal.classList.contains("show")) {
            hideModal();
        }
    });

    // Forgot Password Form Submission
    forgotPasswordForm.addEventListener("submit", async function(e) {
        e.preventDefault();
        
        const email = resetEmailInput.value.trim();
        
        if (!email) {
            showModalMessage("Please enter your email address", true);
            return;
        }

        if (!validateEmail(email)) {
            showModalMessage("Please enter a valid email address", true);
            return;
        }

        try {
            resetPasswordButton.disabled = true;
            resetPasswordButton.textContent = "Sending...";

            const response = await fetch("/api/v1/auth/forgot-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok) {
                showModalMessage("Password reset link sent to your email!", false);
                setTimeout(() => {
                    hideModal();
                }, 2000);
            } else {
                throw new Error(data.message || "Failed to send reset link");
            }
        } catch (error) {
            console.error("Forgot password error:", error);
            showModalMessage(error.message || "An error occurred. Please try again.", true);
        } finally {
            resetPasswordButton.disabled = false;
            resetPasswordButton.textContent = "Send Reset Link";
        }
    });

    // Google OAuth Configuration
    const GOOGLE_CLIENT_ID = '103202343935-5dkesvf5dp06af09o0d2373ji2ccd0rc.apps.googleusercontent.com';
    const GOOGLE_SCOPES = [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
    ];

    // Google Login Button
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', async function() {
            try {
                console.log('🔐 Starting Google OAuth flow...');
                
                // Create OAuth URL for web flow
                const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
                    'client_id=' + GOOGLE_CLIENT_ID + '&' +
                    'response_type=code&' +
                    'scope=' + encodeURIComponent(GOOGLE_SCOPES.join(' ')) + '&' +
                    'redirect_uri=' + encodeURIComponent(window.location.origin + '/api/v1/auth/google/callback') + '&' +
                    'state=web';
                
                console.log('📡 Redirecting to Google OAuth...');
                window.location.href = authUrl;
                
            } catch (error) {
                console.error('❌ Google auth error:', error);
                showMessage('Google authentication failed', true);
            }
        });
    }
}); 