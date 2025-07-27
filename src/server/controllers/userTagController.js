import {
    getUserTags as getUserTagsService,
    createUserTag as createUserTagService,
    updateUserTag as updateUserTagService,
    deleteUserTag as deleteUserTagService,
    getTagUsageStats as getTagUsageStatsService
} from '../services/userTagService.js';

// 获取用户的所有标签
export const getUserTags = async (req, res) => {
    try {
        const { email } = req.query;
        console.log('Getting user tags for email:', email);
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        
        const tags = await getUserTagsService(email);
        res.json({ success: true, tags });
    } catch (error) {
        console.error('Error fetching user tags:', error);
        res.status(500).json({ error: 'Failed to fetch user tags' });
    }
};

// 创建新标签
export const createUserTag = async (req, res) => {
    try {
        const { email } = req.query;
        const { name, color } = req.body;
        
        console.log('Creating user tag:', { email, name, color });
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Tag name is required' });
        }
        
        const newTag = await createUserTagService(email, { name, color });
        res.status(201).json({ success: true, tag: newTag });
    } catch (error) {
        console.error('Error creating user tag:', error);
        res.status(400).json({ 
            success: false, 
            error: error.message || 'Failed to create tag' 
        });
    }
};

// 更新标签
export const updateUserTag = async (req, res) => {
    try {
        const { email } = req.query;
        const { tagId } = req.params;
        const { name, color } = req.body;
        
        console.log('Updating user tag:', { email, tagId, name, color });
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        
        if (!tagId) {
            return res.status(400).json({ error: 'Tag ID is required' });
        }
        
        const updatedTag = await updateUserTagService(email, tagId, { name, color });
        res.json({ success: true, tag: updatedTag });
    } catch (error) {
        console.error('Error updating user tag:', error);
        res.status(400).json({ 
            success: false, 
            error: error.message || 'Failed to update tag' 
        });
    }
};

// 删除标签
export const deleteUserTag = async (req, res) => {
    try {
        const { email } = req.query;
        const { tagId } = req.params;
        
        console.log('Deleting user tag:', { email, tagId });
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        
        if (!tagId) {
            return res.status(400).json({ error: 'Tag ID is required' });
        }
        
        await deleteUserTagService(email, tagId);
        res.json({ success: true, message: 'Tag deleted successfully' });
    } catch (error) {
        console.error('Error deleting user tag:', error);
        res.status(400).json({ 
            success: false, 
            error: error.message || 'Failed to delete tag' 
        });
    }
};

// 获取标签使用统计
export const getTagUsageStats = async (req, res) => {
    try {
        const { email } = req.query;
        console.log('Getting tag usage stats for email:', email);
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        
        const stats = await getTagUsageStatsService(email);
        res.json({ success: true, stats });
    } catch (error) {
        console.error('Error fetching tag usage stats:', error);
        res.status(500).json({ error: 'Failed to fetch tag usage stats' });
    }
}; 