import express from 'express';
import { signUp, signIn, signOut, checkEmailExists, getCurrentUser, updateUserProfile, recreateAuthTables, addNicknameColumn, forgotPassword } from '../services/authService.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Check if email exists
router.post('/check-email', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const exists = await checkEmailExists(email);
        res.setHeader('Content-Type', 'application/json');
        res.json({ exists });
    } catch (error) {
        console.error('Check email error:', error);
        res.setHeader('Content-Type', 'application/json');
        res.status(500).json({ message: 'Error checking email availability' });
    }
});

// Sign up
router.post('/register', async (req, res) => {
    try {
        const { email, password, nickname } = req.body;
        
        if (!email || !password || !nickname) {
            return res.status(400).json({ message: 'Email, password, and nickname are required' });
        }

        const result = await signUp(email, password, nickname);
        res.setHeader('Content-Type', 'application/json');
        res.status(201).json(result);
    } catch (error) {
        console.error('Signup error:', error);
        res.setHeader('Content-Type', 'application/json');
        res.status(error.status || 500).json({ 
            message: error.message || 'Error creating account' 
        });
    }
});

// Sign in
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const result = await signIn(email, password);
        res.json(result);
    } catch (error) {
        console.error('Login error:', error);
        res.status(error.status || 401).json({ 
            message: error.message || 'Invalid login credentials' 
        });
    }
});

// Sign out
router.post('/signout', async (req, res) => {
    try {
        const result = await signOut();
        res.json(result);
    } catch (error) {
        console.error('Signout error:', error);
        res.status(500).json({ message: 'Error signing out' });
    }
});

// 获取用户信息路由
router.get('/profile', authenticate, async (req, res) => {
    try {
        const user = req.user;
        res.json(user);
    } catch (error) {
        console.error('Error getting profile:', error);
        res.status(500).json({ message: 'Error getting user profile' });
    }
});

// Update this route
router.post('/recreate-auth-tables', async (req, res) => {
    try {
        const result = await recreateAuthTables();
        res.json(result);
    } catch (error) {
        console.error('Error recreating auth tables:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to recreate auth tables',
            error: error.message
        });
    }
});

// Add nickname column
router.post('/add-nickname-column', async (req, res) => {
    try {
        const result = await addNicknameColumn();
        res.json(result);
    } catch (error) {
        console.error('Error adding nickname column:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add nickname column',
            error: error.message
        });
    }
});

// Forgot password
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const result = await forgotPassword(email);
        res.json(result);
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(error.status || 500).json({ 
            message: error.message || 'Error processing password reset request' 
        });
    }
});

export default router; 