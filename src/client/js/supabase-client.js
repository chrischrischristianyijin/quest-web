// Supabase client configuration
import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js';

const supabaseUrl = 'https://wlpitstgjomynzfnqkye.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndscGl0c3Rnam9teW56Zm5xa3llIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxMzMyNzIsImV4cCI6MjA1OTcwOTI3Mn0.N8pDEMHZWZrNpQxVGHvQUO5XeVHdvOTDjdLRpVnHZHw';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

export { supabase }; 