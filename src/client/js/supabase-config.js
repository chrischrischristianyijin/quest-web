// Import Supabase createClient
import { createClient } from 'https://esm.sh/@supabase/supabase-js';

console.log('Supabase config initializing...');

// Initialize Supabase client with proper configuration
const supabaseUrl = 'https://wlpitstgjomynzfnqkye.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscGl0c3Rnam9teW56Zm5xa3llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxMzMyNzIsImV4cCI6MjA1OTcwOTI3Mn0.7HpEjNdnfOIeYn4nnooaAhDUqrA8q07nWtxFzVwzHck';

// Initialize and export the Supabase client
const supabaseClient = createClient(supabaseUrl, supabaseKey);
console.log('Supabase client initialized with config');

export const supabase = supabaseClient;
console.log('Supabase client exported:', !!supabase);

// Export other configurations
export const config = {
    UNSPLASH_ACCESS_KEY: 'LuatR6_w0eebDPTHP-ia9fTSXIyg3Inj4kvUVcPztss'
}; 