// Navigation Component
import { appState } from '../appState.js';

class Navigation {
    constructor(container) {
        this.container = container;
        this.isInitialized = false;
        this.unsubscribe = null;
    }

    // Initialize navigation
    init() {
        if (this.isInitialized) return;
        
        this.render();
        this.bindEvents();
        this.subscribeToState();
        this.isInitialized = true;
    }

            // Render navigation
    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <a href="/" class="logo">Quest</a>
            
            <div class="header-right">
                <span class="welcome-text">Welcome, <span id="userNickname">Guest</span>!</span>
                <a href="/spaces/my-space.html" class="my-space-button" id="mySpaceButton">My Space</a>
                <button class="logout-button" id="logoutButton" style="display: none;">Logout</button>
            </div>

            <nav class="nav-tabs">
                <a href="/" class="nav-tab active">Discover</a>
            </nav>

            <div class="action-buttons">
                <button class="action-button add-button" id="addInsightBtn">
                    <svg width="27" height="27" viewBox="0 0 27 27" fill="none">
                        <path d="M13.5 5.625V21.375M5.625 13.5H21.375" stroke="#8E6993" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    Add Your Pick
                </button>
                <button class="action-button visit-button" id="searchBtn">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="white" stroke-width="2"/>
                        <path d="M21 21L17 17" stroke="white" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    My Space
                </button>
            </div>
        `;
    }

            // Bind events
    bindEvents() {
        // Add Your Pick button
        const addButton = this.container.querySelector('#addInsightBtn');
        if (addButton) {
            addButton.addEventListener('click', this.handleAddYourPick.bind(this));
        }

        // My Space button
        const visitButton = this.container.querySelector('#searchBtn');
        if (visitButton) {
            visitButton.addEventListener('click', this.handleVisitSpace.bind(this));
        }

        // My Space link
        const mySpaceButton = this.container.querySelector('#mySpaceButton');
        if (mySpaceButton) {
            mySpaceButton.addEventListener('click', this.handleVisitSpace.bind(this));
        }

        // Logout button
        const logoutButton = this.container.querySelector('#logoutButton');
        if (logoutButton) {
            logoutButton.addEventListener('click', this.handleLogout.bind(this));
        }
    }

            // Subscribe to state changes
    subscribeToState() {
        this.unsubscribe = appState.subscribe(this.updateUI.bind(this));
    }

            // Update UI
    async updateUI(state) {
        const userNickname = this.container.querySelector('#userNickname');
        const mySpaceButton = this.container.querySelector('#mySpaceButton');

        const logoutButton = this.container.querySelector('#logoutButton');

        if (state.isAuthenticated && state.user) {
            // User is logged in
            const nickname = state.user.nickname || state.user.email.split('@')[0];
            if (userNickname) userNickname.textContent = nickname;
            
            if (mySpaceButton) {
                mySpaceButton.href = `/spaces/my-space.html?email=${encodeURIComponent(state.user.email)}`;
            }
            

            
            if (logoutButton) {
                logoutButton.style.display = 'inline-block';
            }
        } else {
            // User is not logged in
            if (userNickname) userNickname.textContent = 'Guest';
            
            if (mySpaceButton) {
                mySpaceButton.href = '/login.html';
            }
            

            
            if (logoutButton) {
                logoutButton.style.display = 'none';
            }
        }
    }

            // Handle Add Your Pick click
    handleAddYourPick(event) {
        event.preventDefault();
        if (appState.isAuthenticated) {
            window.location.href = `/visit-space?email=${encodeURIComponent(appState.user.email)}`;
        } else {
            window.location.href = '/signup';
        }
    }

            // Handle Visit Space click
    handleVisitSpace(event) {
        event.preventDefault();
        if (appState.isAuthenticated) {
            window.location.href = `/spaces/my-space.html?email=${encodeURIComponent(appState.user.email)}`;
        } else {
            window.location.href = '/login';
        }
    }

            // Handle logout
    handleLogout(event) {
        event.preventDefault();
        
        // Clear user session from localStorage
        localStorage.removeItem('quest_user_session');
        
        appState.clearUser();
        window.location.href = '/';
    }

    // 销毁组件
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        this.isInitialized = false;
    }
}

export { Navigation }; 