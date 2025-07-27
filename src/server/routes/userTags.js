import express from 'express';
import {
    getUserTags,
    createUserTag,
    updateUserTag,
    deleteUserTag,
    getTagUsageStats
} from '../controllers/userTagController.js';

const router = express.Router();

// 获取用户的所有标签
router.get('/', getUserTags);

// 创建新标签
router.post('/', createUserTag);

// 更新标签
router.put('/:tagId', updateUserTag);

// 删除标签
router.delete('/:tagId', deleteUserTag);

// 获取标签使用统计
router.get('/stats', getTagUsageStats);

export default router; 