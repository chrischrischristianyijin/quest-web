import { supabaseService } from '../../../supabase/config.js';

// 获取用户的所有标签
export const getUserTags = async (email) => {
    try {
        console.log('Getting user tags for email:', email);
        
        // 获取用户ID
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();
        
        if (userError || !user) {
            console.error('Error finding user:', userError || 'User not found');
            return [];
        }
        
        // 获取用户的标签
        const { data: tags, error: tagsError } = await supabase
            .from('user_tags')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        
        if (tagsError) {
            console.error('Error getting user tags:', tagsError);
            return [];
        }
        
        console.log(`Found ${tags.length} user tags`);
        return tags || [];
    } catch (error) {
        console.error('Error in getUserTags:', error);
        return [];
    }
};

// 创建新标签
export const createUserTag = async (email, tagData) => {
    try {
        console.log('Creating user tag:', { email, tagData });
        
        const { name, color = '#65558F' } = tagData;
        
        if (!name || !name.trim()) {
            throw new Error('Tag name is required');
        }
        
        // 获取用户ID
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();
        
        if (userError || !user) {
            throw new Error('User not found');
        }
        
        // 检查标签是否已存在
        const { data: existingTag } = await supabase
            .from('user_tags')
            .select('id')
            .eq('user_id', user.id)
            .eq('name', name.trim().toLowerCase())
            .single();
        
        if (existingTag) {
            throw new Error('Tag already exists');
        }
        
        // 创建新标签
        const { data: newTag, error: createError } = await supabase
            .from('user_tags')
            .insert([{
                user_id: user.id,
                name: name.trim().toLowerCase(),
                color: color
            }])
            .select()
            .single();
        
        if (createError) {
            console.error('Error creating user tag:', createError);
            throw new Error('Failed to create tag');
        }
        
        console.log('Successfully created user tag:', newTag);
        return newTag;
    } catch (error) {
        console.error('Error in createUserTag:', error);
        throw error;
    }
};

// 更新标签
export const updateUserTag = async (email, tagId, tagData) => {
    try {
        console.log('Updating user tag:', { email, tagId, tagData });
        
        const { name, color } = tagData;
        
        // 获取用户ID
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();
        
        if (userError || !user) {
            throw new Error('User not found');
        }
        
        // 检查标签是否属于该用户
        const { data: existingTag, error: checkError } = await supabase
            .from('user_tags')
            .select('id')
            .eq('id', tagId)
            .eq('user_id', user.id)
            .single();
        
        if (checkError || !existingTag) {
            throw new Error('Tag not found or access denied');
        }
        
        // 更新标签
        const updateData = {};
        if (name) updateData.name = name.trim().toLowerCase();
        if (color) updateData.color = color;
        
        const { data: updatedTag, error: updateError } = await supabase
            .from('user_tags')
            .update(updateData)
            .eq('id', tagId)
            .select()
            .single();
        
        if (updateError) {
            console.error('Error updating user tag:', updateError);
            throw new Error('Failed to update tag');
        }
        
        console.log('Successfully updated user tag:', updatedTag);
        return updatedTag;
    } catch (error) {
        console.error('Error in updateUserTag:', error);
        throw error;
    }
};

// 删除标签
export const deleteUserTag = async (email, tagId) => {
    try {
        console.log('Deleting user tag:', { email, tagId });
        
        // 获取用户ID
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();
        
        if (userError || !user) {
            throw new Error('User not found');
        }
        
        // 检查标签是否属于该用户
        const { data: existingTag, error: checkError } = await supabase
            .from('user_tags')
            .select('id')
            .eq('id', tagId)
            .eq('user_id', user.id)
            .single();
        
        if (checkError || !existingTag) {
            throw new Error('Tag not found or access denied');
        }
        
        // 删除标签
        const { error: deleteError } = await supabase
            .from('user_tags')
            .delete()
            .eq('id', tagId);
        
        if (deleteError) {
            console.error('Error deleting user tag:', deleteError);
            throw new Error('Failed to delete tag');
        }
        
        console.log('Successfully deleted user tag:', tagId);
        return true;
    } catch (error) {
        console.error('Error in deleteUserTag:', error);
        throw error;
    }
};

// 获取标签使用统计
export const getTagUsageStats = async (email) => {
    try {
        console.log('Getting tag usage stats for email:', email);
        
        // 获取用户ID
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();
        
        if (userError || !user) {
            console.error('Error finding user:', userError || 'User not found');
            return [];
        }
        
        // 获取用户的标签
        const { data: tags, error: tagsError } = await supabase
            .from('user_tags')
            .select('id, name, color')
            .eq('user_id', user.id);
        
        if (tagsError) {
            console.error('Error getting user tags:', tagsError);
            return [];
        }
        
        // 获取每个标签的使用次数
        const stats = await Promise.all(tags.map(async (tag) => {
            const { count, error: countError } = await supabase
                .from('insights')
                .select('id', { count: 'exact' })
                .eq('user_id', user.id)
                .contains('tags', [tag.name]);
            
            return {
                ...tag,
                usage_count: countError ? 0 : (count || 0)
            };
        }));
        
        console.log('Tag usage stats:', stats);
        return stats;
    } catch (error) {
        console.error('Error in getTagUsageStats:', error);
        return [];
    }
}; 