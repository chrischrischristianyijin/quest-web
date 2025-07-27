import { supabase } from '../../../supabase/config.js';

// 基于email的自定义认证中间件
export const authenticateByEmail = async (req, res, next) => {
    try {
        // 从请求体或查询参数中获取email
        const email = req.body.email || req.query.email;
        
        if (!email) {
            return res.status(401).json({ message: 'Email is required for authentication' });
        }
        
        // 通过email查找用户
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();
        
        if (error || !user) {
            console.error('User not found for email:', email, error);
            return res.status(401).json({ message: 'User not found' });
        }
        
        // 将用户信息添加到请求对象
        req.user = user;
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(401).json({ message: 'Authentication failed' });
    }
};

// 基于Supabase session的认证（保留原有功能）
export const authenticate = async (req, res, next) => {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
};

export const authorize = (roles) => {
    return async (req, res, next) => {
        try {
            const { data: { user }, error } = await supabase.auth.getUser();
            
            if (error || !user) {
                return res.status(401).json({ message: 'Unauthorized' });
            }
            
            // 检查用户角色
            const { data: userData } = await supabase
                .from('users')
                .select('role')
                .eq('id', user.id)
                .single();
            
            if (!roles.includes(userData.role)) {
                return res.status(403).json({ message: 'Forbidden' });
            }
            
            next();
        } catch (error) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
    };
};

// 导出新的认证中间件作为默认的authMiddleware
export { authenticateByEmail as authMiddleware }; 