const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Import routes
const fiftyTwoWeekRoutes = require('./src/routes/fiftyTwoWeekRoutes');

// ✅ Mount routes
app.use('/api', fiftyTwoWeekRoutes);

// ✅ ALSO add direct routes (for Vercel compatibility)
// Import the controller functions directly
const {
    update52WeekRangeData,
    updateEndOfDay52WeekRange,
    check52WeekHit,
    checkTradingNear,
    get52WeekRange,
    getNotificationsHandler,
    get52WeekRangeStatus,
    getMarketStatus
} = require('./src/controllers/fiftyTwoWeekController');

// ✅ Direct route registration (works around Vercel routing issues)
app.post('/api/update-52-week-range', updateEndOfDay52WeekRange);
app.post('/api/52-week-range/update', update52WeekRangeData);
app.get('/api/check-52-week-hit', check52WeekHit);
app.get('/api/check-trading-near', checkTradingNear);
app.get('/api/52-week-range', get52WeekRange);
app.get('/api/52-week-notifications', getNotificationsHandler);
app.get('/api/52-week-range/status', get52WeekRangeStatus);
app.get('/api/market-status', getMarketStatus);

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint with available endpoints
app.get('/', (req, res) => {
    res.json({
        name: 'NEPSE 52-Week Tracking API',
        version: '1.0.0',
        endpoints: {
            GET: [
                '/api/market-status',
                '/api/check-52-week-hit',
                '/api/check-trading-near',
                '/api/52-week-range',
                '/api/52-week-notifications',
                '/api/52-week-range/status',
                '/health'
            ],
            POST: [
                '/api/52-week-range/update',
                '/api/update-52-week-range'
            ]
        }
    });
});

// 404 handler
app.use((req, res) => {
    console.log(`404 - Not found: ${req.method} ${req.url}`);
    res.status(404).json({
        success: false,
        message: `Endpoint not found: ${req.method} ${req.url}`,
        available_endpoints: {
            GET: [
                '/api/market-status',
                '/api/check-52-week-hit',
                '/api/check-trading-near',
                '/api/52-week-range',
                '/api/52-week-notifications',
                '/api/52-week-range/status'
            ],
            POST: [
                '/api/52-week-range/update',
                '/api/update-52-week-range'
            ]
        }
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});

module.exports = app;

// Start server if not in Vercel
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log('\nAvailable endpoints:');
        console.log('  GET  /api/market-status');
        console.log('  GET  /api/check-52-week-hit');
        console.log('  GET  /api/check-trading-near');
        console.log('  GET  /api/52-week-range');
        console.log('  GET  /api/52-week-notifications');
        console.log('  GET  /api/52-week-range/status');
        console.log('  POST /api/52-week-range/update');
        console.log('  POST /api/update-52-week-range');
    });
}
