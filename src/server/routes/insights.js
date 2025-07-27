import express from 'express';
import { 
    getUserInsights,
    getInsightById,
    createInsight,
    updateInsight,
    deleteInsight
} from '../controllers/insightsController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Log all requests to insights routes
router.use((req, res, next) => {
    console.log('Insights route accessed:', {
        method: req.method,
        path: req.path,
        query: req.query,
        body: req.body
    });
    next();
});

// 获取用户的所有收藏
router.get('/', getUserInsights);

// 获取单个收藏
router.get('/:id', getInsightById);

// 创建新收藏
router.post('/', createInsight);

// 更新收藏
router.put('/:id', authMiddleware, updateInsight);

// 删除收藏
router.delete('/:id', deleteInsight);

export default router; 