import { validationResult } from 'express-validator';

export const validate = (validations) => {
    return async (req, res, next) => {
        await Promise.all(validations.map(validation => validation.run(req)));
        
        const errors = validationResult(req);
        if (errors.isEmpty()) {
            return next();
        }
        
        res.status(400).json({
            message: 'Validation Error',
            errors: errors.array()
        });
    };
};

export const validateCollection = [
    body('title').notEmpty().withMessage('Title is required'),
    body('description').optional(),
    body('userId').notEmpty().withMessage('User ID is required')
];

export const validateInsight = [
    body('content').notEmpty().withMessage('Content is required'),
    body('collectionId').notEmpty().withMessage('Collection ID is required'),
    body('userId').notEmpty().withMessage('User ID is required')
]; 