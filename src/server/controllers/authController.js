import { signUp, signIn, signOut, getCurrentUser, checkEmailExists } from '../services/authService.js';

export const register = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }
        
        const result = await signUp(email, password);
        res.status(201).json(result);
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Registration failed'
        });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }
        
        const result = await signIn(email, password);
        res.json(result);
    } catch (error) {
        console.error('Login error:', error);
        res.status(401).json({
            success: false,
            message: error.message || 'Login failed'
        });
    }
};

export const logout = async (req, res) => {
    try {
        const result = await signOut();
        res.json(result);
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Logout failed'
        });
    }
};

export const getProfile = async (req, res) => {
    try {
        const user = await getCurrentUser();
        res.json({
            success: true,
            user
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get profile'
        });
    }
};

export const checkEmail = async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }
        
        const exists = await checkEmailExists(email);
        res.json({
            success: true,
            available: !exists
        });
    } catch (error) {
        console.error('Email check error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Email check failed'
        });
    }
}; 