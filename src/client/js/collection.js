// Import Supabase client
import { supabase } from '../../../supabase/config.js';

// Function to fetch metadata from a URL through our backend proxy
async function fetchMetadata(url) {
    try {
        console.log('Fetching metadata for URL:', url);
        const response = await fetch(`/api/v1/metadata?url=${encodeURIComponent(url)}`);
        console.log('Metadata response status:', response.status);
        
        if (!response.ok) {
            throw new Error('Failed to fetch metadata');
        }
        
        const metadata = await response.json();
        console.log('Received metadata:', metadata);
        return metadata;
    } catch (error) {
        console.error('Error fetching metadata:', error);
        return {
            title: new URL(url).hostname,
            description: `Content from ${new URL(url).hostname}`,
            image_url: ''
        };
    }
}

async function createCard(insight) {
    console.log('Creating card for insight:', insight);
    const card = document.createElement('div');
    card.className = 'card';
    
    const imageContainer = document.createElement('div');
    imageContainer.className = 'image-container';
    
    const image = document.createElement('img');
    image.className = 'card-image';
    image.style.display = 'none'; // Hide by default
    
    const defaultLogo = document.createElement('div');
    defaultLogo.className = 'default-logo';
    defaultLogo.textContent = 'Quest';
    defaultLogo.style.display = 'flex'; // Show by default
    
    imageContainer.appendChild(image);
    imageContainer.appendChild(defaultLogo);
    
    const content = document.createElement('div');
    content.className = 'card-content';
    
    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = 'Loading...';
    
    const description = document.createElement('p');
    description.className = 'card-description';
    description.textContent = 'Loading...';
    
    const date = document.createElement('p');
    date.className = 'card-date';
    date.textContent = new Date(insight.created_at).toLocaleDateString();
    
    const link = document.createElement('a');
    link.className = 'card-link';
    link.href = insight.url;
    link.target = '_blank';
    link.textContent = 'Visit Link';
    
    content.appendChild(title);
    content.appendChild(description);
    content.appendChild(date);
    content.appendChild(link);
    
    card.appendChild(imageContainer);
    card.appendChild(content);

    // If insight already has metadata, use it
    if (insight.title || insight.description || insight.image_url) {
        console.log('Using existing metadata from insight:', {
            title: insight.title,
            description: insight.description,
            image_url: insight.image_url
        });
        
        title.textContent = insight.title || new URL(insight.url).hostname;
        description.textContent = insight.description || `Content from ${new URL(insight.url).hostname}`;
        
        if (insight.image_url) {
            image.src = insight.image_url;
            image.onload = () => {
                image.style.display = 'block';
                defaultLogo.style.display = 'none';
            };
            image.onerror = () => {
                image.style.display = 'none';
                defaultLogo.style.display = 'flex';
            };
        }
    } else {
        // Fetch metadata if not already present
        try {
            console.log('Fetching metadata for URL:', insight.url);
            const metadata = await fetchMetadata(insight.url);
            console.log('Fetched metadata:', metadata);
            
            if (metadata) {
                title.textContent = metadata.title || new URL(insight.url).hostname;
                description.textContent = metadata.description || `Content from ${new URL(insight.url).hostname}`;
                
                if (metadata.image_url) {
                    image.src = metadata.image_url;
                    image.onload = () => {
                        image.style.display = 'block';
                        defaultLogo.style.display = 'none';
                    };
                    image.onerror = () => {
                        image.style.display = 'none';
                        defaultLogo.style.display = 'flex';
                    };
                }
                
                // Update the insight in the database with the metadata
                try {
                    const { error: updateError } = await supabase
                        .from('insights')
                        .update({
                            title: metadata.title,
                            description: metadata.description,
                            image_url: metadata.image_url
                        })
                        .eq('id', insight.id);
                    
                    if (updateError) {
                        console.error('Error updating insight with metadata:', updateError);
                    }
                } catch (updateError) {
                    console.error('Error updating insight with metadata:', updateError);
                }
            }
        } catch (error) {
            console.error('Error updating card with metadata:', error);
            title.textContent = new URL(insight.url).hostname;
            description.textContent = `Content from ${new URL(insight.url).hostname}`;
        }
    }
    
    return card;
}

// Function to fetch insights from the backend
async function fetchInsights(email) {
    try {
        const response = await fetch(`/api/v1/insights?email=${encodeURIComponent(email)}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch insights');
        }
        
        return data.insights;
    } catch (error) {
        console.error('Error fetching insights:', error);
        throw error;
    }
}

// Function to render insights into the collection grid
async function renderInsights(email) {
    try {
        const insights = await fetchInsights(email);
        const collectionGrid = document.querySelector('.collection-grid');
        
        if (!collectionGrid) {
            console.error('Collection grid element not found');
            return;
        }
        
        collectionGrid.innerHTML = '';
        
        if (insights && insights.length > 0) {
            // Create and append cards one by one
            for (const insight of insights) {
                const card = await createCard(insight);
                collectionGrid.appendChild(card);
            }
        } else {
            collectionGrid.innerHTML = `
                <div class="no-collections">
                    <h2>No Collections Yet</h2>
                    <p>This space has no media collections yet.</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error rendering insights:', error);
        const collectionGrid = document.querySelector('.collection-grid');
        if (collectionGrid) {
            collectionGrid.innerHTML = `
                <div class="no-collections">
                    <h2>Error</h2>
                    <p>Failed to load collections. Please try again later.</p>
                </div>
            `;
        }
    }
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get('email');
    
    if (email) {
        renderInsights(email);
    } else {
        const collectionGrid = document.querySelector('.collection-grid');
        if (collectionGrid) {
            collectionGrid.innerHTML = `
                <div class="no-collections">
                    <h2>Error</h2>
                    <p>No email provided. Please return to the home page and try again.</p>
                </div>
            `;
        }
    }
}); 