import { supabaseService } from '../../../supabase/config.js';

// 获取用户资料信息
export const getUserProfile = async (email) => {
    try {
        const { data, error } = await supabaseService
            .from('users')
            .select(`
                id,
                email,
                nickname,
                avatar_url,
                bio,
                followers_count,
                following_count,
                created_at,
                updated_at
            `)
            .eq('email', email)
            .single();

        if (error) {
            console.error('Error fetching user profile:', error);
            throw error;
        }

        return data;
    } catch (error) {
        console.error('Error in getUserProfile:', error);
        throw error;
    }
};

// 更新用户资料
export const updateUserProfile = async (userId, updates) => {
    try {
        const { data, error } = await supabaseService
            .from('users')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            console.error('Error updating user profile:', error);
            throw error;
        }

        return data;
    } catch (error) {
        console.error('Error in updateUserProfile:', error);
        throw error;
    }
};

// 获取用户的关注者列表
export const getUserFollowers = async (userId) => {
    try {
        const { data, error } = await supabaseService
            .from('follows')
            .select(`
                follower_id,
                created_at,
                follower:users!follows_follower_id_fkey (
                    id,
                    email,
                    nickname,
                    avatar_url
                )
            `)
            .eq('following_id', userId);

        if (error) {
            console.error('Error fetching followers:', error);
            throw error;
        }

        return data.map(follow => ({
            ...follow.follower,
            followed_at: follow.created_at
        }));
    } catch (error) {
        console.error('Error in getUserFollowers:', error);
        throw error;
    }
};

// 获取用户的关注列表
export const getUserFollowing = async (userId) => {
    try {
        const { data, error } = await supabaseService
            .from('follows')
            .select(`
                following_id,
                created_at,
                following:users!follows_following_id_fkey (
                    id,
                    email,
                    nickname,
                    avatar_url
                )
            `)
            .eq('follower_id', userId);

        if (error) {
            console.error('Error fetching following:', error);
            throw error;
        }

        return data.map(follow => ({
            ...follow.following,
            followed_at: follow.created_at
        }));
    } catch (error) {
        console.error('Error in getUserFollowing:', error);
        throw error;
    }
};

// 关注用户
export const followUser = async (followerId, followingId) => {
    try {
        // 检查是否已经关注
        const { data: existingFollow } = await supabaseService
            .from('follows')
            .select('id')
            .eq('follower_id', followerId)
            .eq('following_id', followingId)
            .single();

        if (existingFollow) {
            throw new Error('Already following this user');
        }

        // 不能关注自己
        if (followerId === followingId) {
            throw new Error('Cannot follow yourself');
        }

        const { data, error } = await supabaseService
            .from('follows')
            .insert([{
                follower_id: followerId,
                following_id: followingId
            }])
            .select()
            .single();

        if (error) {
            console.error('Error following user:', error);
            throw error;
        }

        return data;
    } catch (error) {
        console.error('Error in followUser:', error);
        throw error;
    }
};

// 取消关注用户
export const unfollowUser = async (followerId, followingId) => {
    try {
        const { data, error } = await supabaseService
            .from('follows')
            .delete()
            .eq('follower_id', followerId)
            .eq('following_id', followingId)
            .select()
            .single();

        if (error) {
            console.error('Error unfollowing user:', error);
            throw error;
        }

        return data;
    } catch (error) {
        console.error('Error in unfollowUser:', error);
        throw error;
    }
};

// 检查是否关注某用户
export const isFollowing = async (followerId, followingId) => {
    try {
        const { data, error } = await supabaseService
            .from('follows')
            .select('id')
            .eq('follower_id', followerId)
            .eq('following_id', followingId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('Error checking follow status:', error);
            throw error;
        }

        return !!data;
    } catch (error) {
        console.error('Error in isFollowing:', error);
        throw error;
    }
};

// 获取用户ID通过邮箱
export const getUserIdByEmail = async (email) => {
    try {
        const { data, error } = await supabaseService
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (error) {
            console.error('Error fetching user ID:', error);
            throw error;
        }

        return data.id;
    } catch (error) {
        console.error('Error in getUserIdByEmail:', error);
        throw error;
    }
}; 