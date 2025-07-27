import { supabase } from '../lib/supabase.js';
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

export const getUserInsights = async (email) => {
    try {
        console.log('Getting user insights for email:', email);
        
        // Get user ID from email
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();
        
        if (userError) {
            console.error('Error getting user ID:', userError);
            if (userError.code === 'PGRST116') return [];
            throw userError;
        }
        
        if (!user) {
            console.log('User not found:', email);
            return [];
        }
        
        console.log('Found user ID:', user.id);
        
        // Get insights
        const { data: insights, error: insightsError } = await supabase
            .from('insights')
            .select('id, url, title, description, image_url, tags, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        
        if (insightsError) {
            console.error('Error getting insights:', insightsError);
            throw insightsError;
        }
        
        if (!insights || insights.length === 0) {
            console.log('No insights found');
            return [];
        }
        
        console.log(`Found ${insights.length} insights`);
        return insights;
    } catch (error) {
        console.error('Error in getUserInsights:', error);
        throw error;
    }
};

export const getInsightById = async (id) => {
    try {
        console.log('Getting insight by ID:', id);
        
        const { data, error } = await supabase
            .from('insights')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) {
            console.error('Error getting insight:', error);
            if (error.code === 'PGRST116') return null;
            throw error;
        }
        
        if (!data) {
            console.log('Insight not found:', id);
            return null;
        }
        
        return data;
    } catch (error) {
        console.error('Error in getInsightById:', error);
        throw error;
    }
};

// Function to fetch metadata
async function fetchMetadata(url) {
    try {
        console.log('Starting metadata fetch for URL:', url);
        
        // Special handling for YouTube URLs
        const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu.be\/)([^&]+)/);
        if (youtubeMatch) {
            console.log('Detected YouTube URL, fetching oEmbed data');
            const videoId = youtubeMatch[1];
            console.log('Extracted video ID:', videoId);
            
            // First try oEmbed
            try {
                const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
                console.log('Fetching from oEmbed URL:', oembedUrl);
                
                const response = await fetch(oembedUrl, {
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (compatible; QuestBot/1.0; +http://quest.com)'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`YouTube oEmbed request failed with status: ${response.status}`);
                }
                
                const text = await response.text();
                console.log('Raw response:', text);
                
                let data;
                try {
                    data = JSON.parse(text);
                } catch (parseError) {
                    console.error('Failed to parse oEmbed response:', parseError);
                    throw new Error('Invalid JSON response from YouTube oEmbed');
                }
                
                console.log('YouTube metadata fetched:', data);
                
                if (!data || typeof data !== 'object') {
                    throw new Error('Invalid response format from YouTube oEmbed');
                }
                
                const metadata = {
                    title: data.title || `YouTube Video: ${videoId}`,
                    description: data.author_name ? `By ${data.author_name}` : `YouTube Video ID: ${videoId}`,
                    image_url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
                };
                
                // Verify metadata values are not null
                Object.entries(metadata).forEach(([key, value]) => {
                    if (value === null || value === undefined) {
                        metadata[key] = key === 'image_url' ? '' : `Default ${key} for ${videoId}`;
                    }
                });
                
                console.log('Final YouTube metadata:', metadata);
                return metadata;
            } catch (error) {
                console.error('YouTube metadata fetch error:', error);
                // Fallback to basic metadata
                const fallbackMetadata = {
                    title: `YouTube Video: ${videoId}`,
                    description: `Video ID: ${videoId}`,
                    image_url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
                };
                console.log('Using fallback YouTube metadata:', fallbackMetadata);
                return fallbackMetadata;
            }
        }

        // For non-YouTube URLs
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; QuestBot/1.0; +http://quest.com)'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch URL content: ${response.status}`);
            }

            const html = await response.text();
            console.log('Successfully fetched HTML content, length:', html.length);
            
            const dom = new JSDOM(html);
            const document = dom.window.document;
            
            const metadata = {
                title: document.querySelector('meta[property="og:title"]')?.content || 
                       document.querySelector('title')?.textContent || 
                       new URL(url).hostname,
                description: document.querySelector('meta[property="og:description"]')?.content || 
                           document.querySelector('meta[name="description"]')?.content || 
                           `Content from ${new URL(url).hostname}`,
                image_url: document.querySelector('meta[property="og:image"]')?.content || 
                         document.querySelector('meta[property="twitter:image"]')?.content || 
                         ''
            };
            
            // Verify metadata values are not null
            Object.entries(metadata).forEach(([key, value]) => {
                if (value === null || value === undefined) {
                    metadata[key] = key === 'image_url' ? '' : `Content from ${new URL(url).hostname}`;
                }
            });
            
            console.log('Final metadata:', metadata);
            return metadata;
        } catch (error) {
            console.error('Error fetching URL metadata:', error);
            const fallbackMetadata = {
                title: new URL(url).hostname,
                description: `Content from ${new URL(url).hostname}`,
                image_url: ''
            };
            console.log('Using fallback metadata:', fallbackMetadata);
            return fallbackMetadata;
        }
    } catch (error) {
        console.error('Error in fetchMetadata:', error);
        // Return default metadata instead of throwing
        const defaultMetadata = {
            title: new URL(url).hostname,
            description: `Content from ${new URL(url).hostname}`,
            image_url: ''
        };
        console.log('Using default metadata:', defaultMetadata);
        return defaultMetadata;
    }
}

export const createInsight = async (insightData) => {
    console.log('Starting insight creation with data:', insightData);
    const { url, email, tags = [] } = insightData;
    
    if (!url || !email) {
        console.error('Missing required fields:', { url: !!url, email: !!email });
        throw new Error('Missing required fields: url and email are required');
    }
    
    try {
        // Get user ID from email
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (userError || !user) {
            console.error('Error finding user:', userError || 'User not found');
            throw new Error('Failed to find user account');
        }

        // Check if URL already exists for this user
        const { data: existingInsight } = await supabase
            .from('insights')
            .select('id')
            .eq('user_id', user.id)
            .eq('url', url)
            .single();
            
        if (existingInsight) {
            return { success: true, message: 'URL already saved' };
        }

        // Fetch metadata
        let metadata;
        try {
            metadata = await fetchMetadata(url);
            console.log('Fetched metadata:', metadata);
            
            // Ensure no null values
            if (!metadata.title) metadata.title = new URL(url).hostname;
            if (!metadata.description) metadata.description = `Content from ${new URL(url).hostname}`;
            if (!metadata.image_url) metadata.image_url = '';
            
        } catch (error) {
            console.error('Error fetching metadata:', error);
            metadata = {
                title: new URL(url).hostname,
                description: `Content from ${new URL(url).hostname}`,
                image_url: ''
            };
        }

        // Create new insight with metadata
        const { data: newInsight, error: insightError } = await supabase
            .from('insights')
            .insert([{
                user_id: user.id,
                url: url,
                title: metadata.title,
                description: metadata.description, // 使用自动获取的元数据
                image_url: metadata.image_url,
                tags: tags
            }])
            .select()
            .single();

        if (insightError) {
            console.error('Error creating insight:', insightError);
            throw new Error('Failed to save insight');
        }

        console.log('Successfully created insight:', newInsight);
        return { success: true, message: 'Insight saved successfully', insight: newInsight };
    } catch (error) {
        console.error('Error in createInsight:', error);
        throw error;
    }
};

export const updateInsight = async (id, insightData) => {
    const { data, error } = await supabase
        .from('insights')
        .update(insightData)
        .eq('id', id)
        .select()
        .single();
    
    if (error) throw error;
    return data;
};

export const deleteInsight = async (id, email) => {
    try {
        console.log('Deleting insight:', id, 'for email:', email);
        
        // Get user ID from email
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();
        
        if (userError || !user) {
            console.error('Error finding user for deletion:', userError || 'User not found');
            throw new Error('Failed to find user account');
        }
        
        console.log('Found user ID for deletion:', user.id);
        
        // Delete the insight
        const { error: deleteError } = await supabase
        .from('insights')
        .delete()
        .eq('id', id)
            .eq('user_id', user.id);
    
        if (deleteError) {
            console.error('Error deleting insight:', deleteError);
            throw deleteError;
        }
        
        console.log('Insight deleted successfully:', id);
    return true;
    } catch (error) {
        console.error('Error in deleteInsight:', error);
        throw error;
    }
}; 