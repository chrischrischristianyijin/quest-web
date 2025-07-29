import { createClient } from '@supabase/supabase-js';

// Emergency Supabase service - bypass configuration issues
let emergencyClient = null;

export const getEmergencySupabaseClient = () => {
    if (!emergencyClient) {
        console.log('🚨 Creating emergency Supabase client...');
        console.log('- URL exists:', !!process.env.SUPABASE_URL);
        console.log('- Service key exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
        
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error('Emergency Supabase client: Missing environment variables');
        }
        
        emergencyClient = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        
        console.log('✅ Emergency Supabase client created');
    }
    
    return emergencyClient;
};

// Emergency getUserByEmail function
export const emergencyGetUserByEmail = async (email) => {
    try {
        console.log('🚨 EMERGENCY getUserByEmail for:', email);
        const client = getEmergencySupabaseClient();
        
        const { data, error } = await client
            .from('users')
            .select('id, email, nickname, avatar_url, created_at')
            .eq('email', email)
            .single();
        
        if (error) {
            console.error('❌ Emergency query error:', error);
            if (error.code === 'PGRST116') {
                console.log('✅ User not found (normal case)');
                return null;
            }
            throw error;
        }
        
        console.log('✅ Emergency query successful');
        return data;
    } catch (error) {
        console.error('❌ Emergency getUserByEmail failed:', error);
        throw error;
    }
};

// Emergency signIn function
export const emergencySignIn = async (email, password) => {
    try {
        console.log('🚨 EMERGENCY signIn for:', email);
        const client = getEmergencySupabaseClient();
        
        // Import bcrypt for password verification
        const bcrypt = await import('bcrypt');
        
        // First verify against signup table
        const { data: signupData, error: signupError } = await client
            .from('signup')
            .select('password')
            .eq('email', email)
            .single();

        if (signupError || !signupData) {
            console.error('❌ Emergency signup table error:', signupError);
            throw { status: 401, message: 'Email not found. Please check your email or sign up.' };
        }

        // Compare password with hashed password
        const isPasswordValid = await bcrypt.compare(password, signupData.password);
        if (!isPasswordValid) {
            throw { status: 401, message: 'Incorrect password. Please try again.' };
        }

        // Get user data from users table
        const { data: userData, error: userError } = await client
            .from('users')
            .select('id, email, nickname, avatar_url, created_at')
            .eq('email', email)
            .single();

        if (userError || !userData) {
            console.error('❌ Emergency user data error:', userError);
            throw { status: 404, message: 'User data not found' };
        }

        console.log('✅ Emergency signIn successful');
        return {
            success: true,
            user: userData,
            session: {
                access_token: 'emergency_token',
                user: userData
            }
        };
    } catch (error) {
        console.error('❌ Emergency signIn failed:', error);
        throw error;
    }
}; 