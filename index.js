// index.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ FIX: Use the correct path with 'src'
const fiftyTwoWeekRoutes = require('./src/routes/fiftyTwoWeekRoutes');

// Mount routes
app.use('/api', fiftyTwoWeekRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.status(200).json({
        name: 'NEPSE 52-Week Tracking API',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            market_status: '/api/market-status',
            check_hit: '/api/check-52-week-hit',
            check_near: '/api/check-trading-near',
            range: '/api/52-week-range',
            notifications: '/api/52-week-notifications',
            range_status: '/api/52-week-range/status',
            update_range: '/api/52-week-range/update (POST)',
            update_eod: '/api/update-52-week-range (POST)'
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

// Export for Vercel
module.exports = app;

// Start server if not in Vercel environment
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
}
