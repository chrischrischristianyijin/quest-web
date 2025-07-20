import express from 'express';
import multer from 'multer';
import { 
    getUserProfile, 
    updateUserProfile, 
    getUserFollowers, 
    getUserFollowing, 
    followUser, 
    unfollowUser, 
    isFollowing,
    getUserIdByEmail
} from '../services/userService.js';
import { supabaseService } from '../../../supabase/config.js';
import { validateUser } from '../middleware/customAuth.js';

const router = express.Router();

// 配置multer用于处理文件上传
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB限制
    },
    fileFilter: (req, file, cb) => {
        // 只允许图片文件
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// 头像上传端点 - 需要用户认证
router.post('/upload-avatar', upload.single('avatar'), validateUser, async (req, res) => {
    try {
        const { fileName } = req.body;
        const file = req.file;
        const user = req.user; // 从中间件获取的用户信息
        
        if (!file) {
            return res.status(400).json({ 
                error: 'Avatar file is required' 
            });
        }
        
        console.log('处理头像上传:', { 
            email: user.email, 
            userId: user.id,
            fileName, 
            fileSize: file.size 
        });
        
        // 上传文件到Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseService.storage
            .from('avatars')
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                cacheControl: '3600',
                upsert: true
            });
        
        if (uploadError) {
            console.error('Storage upload error:', uploadError);
            return res.status(500).json({ 
                error: 'Failed to upload file to storage',
                details: uploadError.message 
            });
        }
        
        console.log('文件上传成功:', uploadData);
        
        // 获取公共URL
        const { data: urlData } = supabaseService.storage
            .from('avatars')
            .getPublicUrl(fileName);
        
        if (!urlData.publicUrl) {
            return res.status(500).json({ 
                error: 'Failed to get public URL' 
            });
        }
        
        console.log('获取到公共URL:', urlData.publicUrl);
        
        // 更新数据库中的头像URL
        const updatedProfile = await updateUserProfile(user.id, { 
            avatar_url: urlData.publicUrl 
        });
        
        console.log('数据库更新成功:', updatedProfile);
        
        res.json({
            success: true,
            message: 'Avatar uploaded successfully',
            avatar_url: urlData.publicUrl,
            profile: updatedProfile
        });
        
    } catch (error) {
        console.error('Avatar upload error:', error);
        res.status(500).json({ 
            error: 'Failed to upload avatar',
            details: error.message 
        });
    }
});

// 临时迁移端点 - 添加avatar_url字段
router.post('/migrate/add-avatar-url', async (req, res) => {
    try {
        console.log('开始添加avatar_url字段...');
        
        // 首先检查字段是否已经存在
        const { data: existingColumns, error: checkError } = await supabaseService
            .from('users')
            .select('*')
            .limit(1);
        
        if (checkError) {
            console.error('检查表结构失败:', checkError);
            return res.status(500).json({ 
                error: 'Failed to check table structure',
                details: checkError.message 
            });
        }
        
        console.log('当前表结构:', Object.keys(existingColumns[0] || {}));
        
        // 尝试更新一个用户的avatar_url字段来测试字段是否存在
        const { data: testUser } = await supabaseService
            .from('users')
            .select('id')
            .limit(1)
            .single();
        
        if (testUser) {
            const { error: updateError } = await supabaseService
                .from('users')
                .update({ avatar_url: null })
                .eq('id', testUser.id);
            
            if (updateError) {
                console.error('avatar_url字段不存在，需要添加:', updateError);
                
                // 由于无法直接执行DDL，我们将通过创建一个新表来添加字段
                // 这是一个临时的解决方案
                return res.status(500).json({ 
                    error: 'avatar_url column does not exist and cannot be added via API',
                    details: 'Please add the column manually in Supabase dashboard',
                    solution: 'Go to Supabase Dashboard > SQL Editor and run: ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url text;'
                });
            } else {
                console.log('avatar_url字段已存在');
            }
        }
        
        console.log('avatar_url字段检查完成');
        res.json({
            success: true,
            message: 'avatar_url column exists and is working'
        });
        
    } catch (error) {
        console.error('迁移执行失败:', error);
        res.status(500).json({ 
            error: 'Migration failed',
            details: error.message 
        });
    }
});

// 获取用户资料
router.get('/profile/:email', async (req, res) => {
    try {
        const { email } = req.params;
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const profile = await getUserProfile(email);
        
        if (!profile) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            success: true,
            profile: profile
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ 
            error: 'Failed to fetch user profile',
            details: error.message 
        });
    }
});

// 更新用户资料
router.put('/profile/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const updates = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // 获取用户ID
        const userId = await getUserIdByEmail(email);
        
        // 过滤允许更新的字段
        const allowedFields = ['nickname', 'avatar_url', 'bio'];
        const filteredUpdates = Object.keys(updates)
            .filter(key => allowedFields.includes(key))
            .reduce((obj, key) => {
                obj[key] = updates[key];
                return obj;
            }, {});

        if (Object.keys(filteredUpdates).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        const updatedProfile = await updateUserProfile(userId, filteredUpdates);
        
        res.json({
            success: true,
            profile: updatedProfile
        });
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ 
            error: 'Failed to update user profile',
            details: error.message 
        });
    }
});

// 获取用户的关注者列表
router.get('/followers/:email', async (req, res) => {
    try {
        const { email } = req.params;
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const userId = await getUserIdByEmail(email);
        const followers = await getUserFollowers(userId);
        
        res.json({
            success: true,
            followers: followers
        });
    } catch (error) {
        console.error('Error fetching followers:', error);
        res.status(500).json({ 
            error: 'Failed to fetch followers',
            details: error.message 
        });
    }
});

// 获取用户的关注列表
router.get('/following/:email', async (req, res) => {
    try {
        const { email } = req.params;
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const userId = await getUserIdByEmail(email);
        const following = await getUserFollowing(userId);
        
        res.json({
            success: true,
            following: following
        });
    } catch (error) {
        console.error('Error fetching following:', error);
        res.status(500).json({ 
            error: 'Failed to fetch following',
            details: error.message 
        });
    }
});

// 关注用户
router.post('/follow', async (req, res) => {
    try {
        const { followerEmail, followingEmail } = req.body;
        
        if (!followerEmail || !followingEmail) {
            return res.status(400).json({ error: 'Both follower and following emails are required' });
        }

        const followerId = await getUserIdByEmail(followerEmail);
        const followingId = await getUserIdByEmail(followingEmail);
        
        const result = await followUser(followerId, followingId);
        
        res.json({
            success: true,
            follow: result
        });
    } catch (error) {
        console.error('Error following user:', error);
        res.status(500).json({ 
            error: 'Failed to follow user',
            details: error.message 
        });
    }
});

// 取消关注用户
router.delete('/follow', async (req, res) => {
    try {
        const { followerEmail, followingEmail } = req.body;
        
        if (!followerEmail || !followingEmail) {
            return res.status(400).json({ error: 'Both follower and following emails are required' });
        }

        const followerId = await getUserIdByEmail(followerEmail);
        const followingId = await getUserIdByEmail(followingEmail);
        
        const result = await unfollowUser(followerId, followingId);
        
        res.json({
            success: true,
            unfollow: result
        });
    } catch (error) {
        console.error('Error unfollowing user:', error);
        res.status(500).json({ 
            error: 'Failed to unfollow user',
            details: error.message 
        });
    }
});

// 检查关注状态
router.get('/follow-status', async (req, res) => {
    try {
        const { followerEmail, followingEmail } = req.query;
        
        if (!followerEmail || !followingEmail) {
            return res.status(400).json({ error: 'Both follower and following emails are required' });
        }

        const followerId = await getUserIdByEmail(followerEmail);
        const followingId = await getUserIdByEmail(followingEmail);
        
        const isFollowingUser = await isFollowing(followerId, followingId);
        
        res.json({
            success: true,
            isFollowing: isFollowingUser
        });
    } catch (error) {
        console.error('Error checking follow status:', error);
        res.status(500).json({ 
            error: 'Failed to check follow status',
            details: error.message 
        });
    }
});

export default router; 