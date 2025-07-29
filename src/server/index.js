import 'dotenv/config';

// Force environment check at startup
console.log('🚀 Server startup environment check:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- VERCEL:', !!process.env.VERCEL);
console.log('- Process CWD:', process.cwd());
console.log('- SUPABASE vars available:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));

// Verify critical environment variables
const criticalEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingVars = criticalEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error('❌ Missing critical environment variables:', missingVars);
    console.error('🔧 Available env keys containing "SUPABASE":', 
        Object.keys(process.env).filter(k => k.includes('SUPABASE')));
} else {
    console.log('✅ All critical environment variables present');
}

import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import authRoutes from './routes/auth.js';
import insightsRoutes from './routes/insights.js';
import metadataRoutes from './routes/metadata.js';
import userRoutes from './routes/user.js';
import userTagsRoutes from './routes/userTags.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/logger.js';
import { supabaseService } from '../../supabase/config.js';
import { authenticate } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

// Debug middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Middleware configuration
app.use(requestLogger);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Static file service configuration - moved before routes
app.use('/js', express.static(path.join(__dirname, '../client/js')));
app.use('/styles', express.static(path.join(__dirname, '../client/styles')));
app.use('/templates', express.static(path.join(__dirname, '../client/templates')));
app.use('/public', express.static(path.join(__dirname, '../public')));
app.use('/node_modules', express.static(path.join(__dirname, '../node_modules')));
app.use(express.static(path.join(__dirname, '../client')));
app.use('/pages', express.static(path.join(__dirname, '../client/pages')));

// API route configuration
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/insights', insightsRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/user-tags', userTagsRoutes);
app.use('/', metadataRoutes);

// Public health check endpoint
app.get('/api/v1/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Set root path
app.get('/', (req, res) => {
    try {
        console.log('Root path accessed');
        res.sendFile(path.join(__dirname, '../client/pages/AboutUs.html'));
    } catch (error) {
        console.error('Error serving root page:', error);
        res.status(500).send('Internal Server Error');
    }
});



// Set login page route
app.get('/login', (req, res) => {
    console.log('Login page accessed');
    res.sendFile(path.join(__dirname, '../client/pages/login.html'));
});

// Set signup page route
app.get('/signup', (req, res) => {
    console.log('Signup page accessed');
    res.sendFile(path.join(__dirname, '../client/pages/signup.html'));
});



// Set page route aliases
app.get('/about', (req, res) => {
    console.log('About page accessed');
    res.sendFile(path.join(__dirname, '../client/pages/AboutUs.html'));
});



// Add authentication check endpoint
app.get('/api/v1/auth/current-user', async (req, res) => {
    try {
        const { data: { user }, error } = await supabaseService.auth.getUser();
        if (error) {
            res.status(401).json({ error: 'Not authenticated' });
        } else {
            res.json({ user });
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add user info endpoint
app.get('/api/v1/users', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) {
            return res.status(400).json({ error: 'Email parameter is required' });
        }

        const { data: user, error } = await supabaseService
            .from('users')
            .select('nickname, email')
            .eq('email', email)
            .single();

        if (error) {
            console.error('Error fetching user:', error);
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user });
    } catch (error) {
        console.error('Error getting user info:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add a catch-all route for /about variations
app.get('/AboutUs*', (req, res) => {
    res.redirect('/about');
});

// Other routes...
// Redirect old collection routes to new my-space routes
app.get('/collection', (req, res) => {
    res.redirect('/spaces/my-space.html');
});

app.get('/collection.html', (req, res) => {
    res.redirect('/spaces/my-space.html');
});

// Spaces routes
app.get('/spaces/my-space.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/pages/spaces/my-space.html'));
});

// Error handling middleware
app.use(errorHandler);

// 404 handler - added after all routes
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, '../client/pages/AboutUs.html'));
});

// For Vercel deployment
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}

export default app; 