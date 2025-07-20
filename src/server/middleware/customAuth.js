import { getUserProfile } from '../services/userService.js';

// 自定义用户验证中间件
export const validateUser = async (req, res, next) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ 
                error: 'Email is required for authentication' 
            });
        }
        
        // 验证用户是否存在
        const userProfile = await getUserProfile(email);
        if (!userProfile) {
            return res.status(401).json({ 
                error: 'User not found or not authenticated' 
            });
        }
        
        // 将用户信息添加到请求对象
        req.user = userProfile;
        next();
    } catch (error) {
        console.error('User validation error:', error);
        return res.status(401).json({ 
            error: 'Authentication failed' 
        });
    }
};

// 可选用户验证中间件（用户可能不存在）
export const validateUserOptional = async (req, res, next) => {
    try {
        const { email } = req.body;
        
        if (email) {
            const userProfile = await getUserProfile(email);
            if (userProfile) {
                req.user = userProfile;
            }
        }
        
        next();
    } catch (error) {
        console.error('Optional user validation error:', error);
        next(); // 继续执行，不阻止请求
    }
}; 