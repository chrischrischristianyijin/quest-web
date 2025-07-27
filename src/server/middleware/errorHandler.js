export const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
    
    // 处理不同类型的错误
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            message: 'Validation Error',
            errors: err.errors
        });
    }
    
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({
            message: 'Unauthorized'
        });
    }
    
    // 默认错误处理
    res.status(500).json({
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
}; 