import winston from 'winston';

// 创建日志记录器
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

// 如果不是生产环境，也输出到控制台
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

export const requestLogger = (req, res, next) => {
    const start = new Date();
    
    // 原始的end方法
    const originalEnd = res.end;
    
    // 重写end方法
    res.end = function(chunk, encoding) {
        const duration = new Date() - start;
        const logData = {
            method: req.method,
            url: req.originalUrl || req.url,
            status: res.statusCode,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString()
        };
        
        // 打印更详细的日志
        console.log(`${req.method} ${req.originalUrl || req.url} - ${res.statusCode} in ${duration}ms`);
        
        // 调用原始的end方法
        originalEnd.call(this, chunk, encoding);
    };
    
    next();
};

export const errorLogger = (err, req, res, next) => {
    logger.error({
        error: err.message,
        stack: err.stack,
        method: req.method,
        url: req.url
    });
    next(err);
}; 