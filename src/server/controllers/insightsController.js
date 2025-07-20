import {
    getUserInsights as getInsightsService,
    getInsightById as getInsightByIdService,
    createInsight as createInsightService,
    updateInsight as updateInsightService,
    deleteInsight as deleteInsightService
} from '../services/insightsService.js';

export const getUserInsights = async (req, res) => {
    try {
        const { email } = req.query;
        console.log('Getting insights for user:', email);
        
        const insights = await getInsightsService(email);
        console.log('Retrieved', insights.length, 'insights');
        
        res.json({ insights });
    } catch (error) {
        console.error('Error fetching insights:', error);
        res.status(500).json({ error: 'Failed to fetch insights' });
    }
};

export const getInsightById = async (req, res, next) => {
    try {
        const insight = await getInsightByIdService(req.params.id);
        if (!insight) {
            return res.status(404).json({ message: 'Insight not found' });
        }
        res.json(insight);
    } catch (error) {
        console.error('Error fetching insight by ID:', error);
        next(error);
    }
};

export const createInsight = async (req, res) => {
    console.log('Creating new insight with request body:', req.body);
    try {
        const result = await createInsightService(req.body);
        console.log('Insight creation result:', result);
        res.status(201).json(result);
    } catch (error) {
        console.error('Error creating insight:', error);
        res.status(400).json({ 
            success: false, 
            message: error.message || 'Failed to create insight' 
        });
    }
};

export const updateInsight = async (req, res, next) => {
    try {
        const insight = await updateInsightService(req.params.id, req.body);
        if (!insight) {
            return res.status(404).json({ message: 'Insight not found' });
        }
        res.json(insight);
    } catch (error) {
        next(error);
    }
};

export const deleteInsight = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { email } = req.body; // 从请求体获取email
        
        console.log('Delete request for insight:', id, 'by email:', email);
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required for deletion' });
        }
        
        await deleteInsightService(id, email);
        console.log('Insight deleted successfully:', id);
        res.status(204).send();
    } catch (error) {
        console.error('Delete insight error:', error);
        res.status(500).json({ error: error.message || 'Failed to delete insight' });
    }
}; 