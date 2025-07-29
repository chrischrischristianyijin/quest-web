import { supabase, supabaseService } from '../../../supabase/config.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';

// 预设标签配置
const DEFAULT_TAGS = [
    { name: 'tech', color: '#65558F' },
    { name: 'design', color: '#65558F' },
    { name: 'business', color: '#65558F' },
    { name: 'lifestyle', color: '#65558F' },
    { name: 'education', color: '#65558F' }
];

export const checkEmailExists = async (email) => {
    try {
        // Check both signup and users tables
        const [signupResult, usersResult] = await Promise.all([
            supabaseService
                .from('signup')
                .select('email')
                .eq('email', email)
                .single(),
            supabaseService
                .from('users')
                .select('email')
                .eq('email', email)
                .single()
        ]);

        // If either query returns data, the email exists
        return !!(signupResult.data || usersResult.data);
    } catch (error) {
        console.error('Error checking email:', error);
        throw error;
    }
};

export const signUp = async (email, password, nickname) => {
    try {
        const exists = await checkEmailExists(email);
        if (exists) {
            throw { status: 400, message: 'Email already registered' };
        }

        console.log('Starting signup process for email:', email);

        // Generate a UUID to be used for both tables
        const id = uuidv4();
        console.log('Generated UUID:', id);

        // Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Step 1: Insert into signup table first
        const { data: signupData, error: signupError } = await supabaseService
            .from('signup')
            .insert([{
                id: id,
                email: email,
                password: hashedPassword // Store hashed password
            }])
            .select('id, email')
            .single();

        if (signupError) {
            console.error('Signup table error details:', signupError);
            throw { status: 500, message: 'Failed to create signup record' };
        }

        // Step 2: Insert into users table with the same UUID
        const { data: userData, error: userError } = await supabaseService
            .from('users')
            .insert({
                id: id,  // Use the same UUID as signup table
                email: email,
                nickname: nickname
            })
            .select('id, email, nickname, avatar_url, created_at')
            .single();

        if (userError) {
            console.error('Users table error details:', userError);
            // If users table insert fails, cleanup signup entry
            try {
                await supabaseService
                    .from('signup')
                    .delete()
                    .eq('id', id);
            } catch (cleanupError) {
                console.error('Failed to cleanup signup after user error:', cleanupError);
            }
            throw { status: 500, message: 'Failed to create user profile' };
        }

        // Step 3: Create default tags for the new user
        try {
            await createDefaultTags(userData.id);
            console.log('Default tags created for user:', userData.id);
        } catch (tagError) {
            console.error('Error creating default tags:', tagError);
            // Don't fail the registration if tag creation fails
        }

        return {
            success: true,
            message: 'Account created successfully',
            user: {
                id: userData.id,
                email: email,
                nickname: nickname,
                avatar_url: userData.avatar_url
            }
        };

    } catch (error) {
        console.error('Full signup error:', error);
        throw error.status ? error : { status: 500, message: 'Unexpected signup error' };
    }
};

export const signIn = async (email, password) => {
    try {
        // First verify against signup table
        const { data: signupData, error: signupError } = await supabaseService
            .from('signup')
            .select('password')
            .eq('email', email)
            .single();

        if (signupError || !signupData) {
            console.error('Signup table error:', signupError);
            throw { status: 401, message: 'Email not found. Please check your email or sign up.' };
        }

        // Compare password with hashed password
        const isPasswordValid = await bcrypt.compare(password, signupData.password);
        if (!isPasswordValid) {
            throw { status: 401, message: 'Incorrect password. Please try again.' };
        }

        // Get user data from users table using email
        const { data: userData, error: userError } = await supabaseService
            .from('users')
            .select('id, email, nickname, avatar_url, created_at')
            .eq('email', email)
            .single();

        if (userError) {
            console.error('User data fetch error:', userError);
            throw { status: 500, message: 'Error fetching user data' };
        }

        if (!userData) {
            console.error('No user data found for email:', email);
            throw { status: 404, message: 'User data not found' };
        }

        return {
            success: true,
            user: userData,
            session: {
                access_token: 'dummy_token',
                user: userData
            }
        };
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
};

export const signOut = async () => {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) {
            throw error;
        }
        return { success: true };
    } catch (error) {
        console.error('Signout error:', error);
        throw error;
    }
};

export const getCurrentUser = async () => {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        return user;
    } catch (error) {
        console.error('Get current user error:', error);
        throw error;
    }
};

// Get user by email for Google OAuth
export const getUserByEmail = async (email) => {
    try {
        console.log('🔍 getUserByEmail called for:', email);
        console.log('🔧 Supabase config check:', {
            hasUrl: !!process.env.SUPABASE_URL,
            hasAnonKey: !!process.env.SUPABASE_ANON_KEY,
            hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            urlDomain: process.env.SUPABASE_URL?.match(/https:\/\/([^.]+)/)?.[1],
            anonKeyPrefix: process.env.SUPABASE_ANON_KEY?.substring(0, 20),
            serviceKeyPrefix: process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20)
        });
        
        // Test basic connection first
        console.log('🧪 Testing basic Supabase connection...');
        console.log('🔧 Connection details:');
        console.log('- Supabase URL:', process.env.SUPABASE_URL?.substring(0, 50) + '...');
        console.log('- Service key exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
        console.log('- Service key length:', process.env.SUPABASE_SERVICE_ROLE_KEY?.length);
        
        try {
            const { data: testData, error: testError } = await supabaseService
                .from('users')
                .select('count')
                .limit(1);
            
            if (testError) {
                console.error('❌ Basic connection test failed:', testError);
                console.error('🔧 Error details:', {
                    code: testError.code,
                    message: testError.message,
                    details: testError.details,
                    hint: testError.hint
                });
                
                // Try to reinitialize Supabase client if connection fails
                console.log('🔄 Attempting to reinitialize Supabase client...');
                const { createClient } = await import('@supabase/supabase-js');
                const freshClient = createClient(
                    process.env.SUPABASE_URL, 
                    process.env.SUPABASE_SERVICE_ROLE_KEY,
                    {
                        auth: {
                            autoRefreshToken: false,
                            persistSession: false,
                            detectSessionInUrl: false
                        }
                    }
                );
                
                const { data: retestData, error: retestError } = await freshClient
                    .from('users')
                    .select('count')
                    .limit(1);
                    
                if (retestError) {
                    console.error('❌ Fresh client test also failed:', retestError);
                    console.error('🔧 Fresh client error details:', {
                        code: retestError.code,
                        message: retestError.message,
                        details: retestError.details
                    });
                } else {
                    console.log('✅ Fresh client test passed - using fresh client');
                }
            } else {
                console.log('✅ Basic connection test passed');
            }
        } catch (connectionError) {
            console.error('❌ Connection test exception:', connectionError.message);
            
            // Log network-related information
            console.log('🌐 Network diagnostics:');
            console.log('- Error name:', connectionError.name);
            console.log('- Error code:', connectionError.code);
            console.log('- Error cause:', connectionError.cause);
            console.log('- Error stack (first 300 chars):', connectionError.stack?.substring(0, 300));
        }
        
        // Add timeout to prevent hanging
        const queryPromise = supabaseService
            .from('users')
            .select('id, email, nickname, avatar_url, created_at')
            .eq('email', email)
            .single();
            
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Supabase query timeout after 10 seconds')), 10000);
        });
        
        const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
        
        if (error) {
            console.error('❌ Supabase query error:', {
                code: error.code,
                message: error.message,
                details: error.details
            });
            
            if (error.code === 'PGRST116') {
                console.log('✅ User not found (normal case)');
                return null;
            }
            throw error;
        }
        
        console.log('✅ User found successfully');
        return data;
    } catch (error) {
        console.error('❌ getUserByEmail error:', {
            name: error.name,
            message: error.message,
            code: error?.code,
            stack: error.stack?.substring(0, 300)
        });
        
        // If it's a timeout or fetch error, throw a more specific error
        if (error.message?.includes('timeout') || error.message?.includes('fetch failed')) {
            throw new Error(`Database connection failed: ${error.message}`);
        }
        
        throw error;
    }
};

// 为用户创建预设标签
async function createDefaultTags(userId) {
    try {
        console.log('Creating default tags for user:', userId);
        
        const tagData = DEFAULT_TAGS.map(tag => ({
            user_id: userId,
            name: tag.name,
            color: tag.color
        }));
        
        const { data: tags, error } = await supabaseService
            .from('user_tags')
            .insert(tagData)
            .select();
        
        if (error) {
            console.error('Error creating default tags:', error);
            throw error;
        }
        
        console.log(`Created ${tags.length} default tags for user ${userId}`);
        return tags;
    } catch (error) {
        console.error('Error in createDefaultTags:', error);
        throw error;
    }
}

export const updateUserProfile = async (userId, userData) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .update(userData)
            .eq('id', userId)
            .select()
            .single();
        
        if (error) {
            console.error('Update profile error:', error);
            throw new Error(error.message);
        }
        
        return {
            success: true,
            message: 'Profile updated successfully',
            data
        };
    } catch (error) {
        console.error('Update profile process error:', error);
        throw error;
    }
};

export const recreateAuthTables = async () => {
    try {
        console.log('Dropping existing tables...');
        // Drop the existing tables if they exist
        const { error: dropError } = await supabaseService.rpc('drop_auth_tables');
        if (dropError) {
            console.error('Error dropping tables:', dropError);
            throw dropError;
        }

        console.log('Creating new tables...');
        // Create the new tables with the correct structure
        const { error: createError } = await supabaseService.rpc('create_auth_tables');
        if (createError) {
            console.error('Error creating tables:', createError);
            throw createError;
        }

        return {
            success: true,
            message: 'Auth tables recreated successfully'
        };
    } catch (error) {
        console.error('Error recreating auth tables:', error);
        throw error;
    }
};

export const addNicknameColumn = async () => {
    try {
        console.log('Adding nickname column to users table...');
        const { error } = await supabaseService.rpc('add_nickname_column');
        
        if (error) {
            console.error('Error adding nickname column:', error);
            throw error;
        }

        return {
            success: true,
            message: 'Nickname column added successfully'
        };
    } catch (error) {
        console.error('Error adding nickname column:', error);
        throw error;
    }
};

export const forgotPassword = async (email) => {
    try {
        // Check if email exists in signup table
        const { data: signupData, error: signupError } = await supabaseService
            .from('signup')
            .select('email')
            .eq('email', email)
            .single();

        if (signupError || !signupData) {
            throw { status: 404, message: 'Email not found. Please check your email or sign up.' };
        }

        // Generate a reset token (in a real implementation, you would use a proper JWT or UUID)
        const resetToken = uuidv4();
        const resetExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

        // Store the reset token in the database (you might want to create a separate table for this)
        // For now, we'll just return success
        // In a real implementation, you would:
        // 1. Store the reset token in a password_resets table
        // 2. Send an email with the reset link
        // 3. Create a reset password page

        console.log(`Password reset requested for email: ${email}`);
        console.log(`Reset token: ${resetToken}`);
        console.log(`Reset expires: ${resetExpiry}`);

        // For now, we'll just return success
        // In a real implementation, you would send an email here
        return {
            success: true,
            message: 'Password reset link sent to your email',
            resetToken: resetToken // In production, don't return this
        };
    } catch (error) {
        console.error('Forgot password error:', error);
        throw error;
    }
}; 