const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import routes
const fiftyTwoWeekRoutes = require('./src/routes/fiftyTwoWeekRoutes');

// ✅ Log all registered routes for debugging
console.log('=== REGISTERED ROUTES ===');
fiftyTwoWeekRoutes.stack.forEach((layer) => {
    if (layer.route) {
        const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
        console.log(`${methods} /api${layer.route.path}`);
    }
});
console.log('===========================');

// Mount routes
app.use('/api', fiftyTwoWeekRoutes);

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'NEPSE 52-Week API',
        endpoints: [
            'GET /api/check-52-week-hit',
            'GET /api/check-trading-near',
            'GET /api/52-week-range',
            'GET /api/52-week-notifications',
            'GET /api/52-week-range/status',
            'GET /api/market-status',
            'POST /api/52-week-range/update',
            'POST /api/update-52-week-range'
        ]
    });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ success: false, message: err.message });
});

// 404 handler - ADD THIS TO SEE WHAT'S BEING REQUESTED
app.use((req, res) => {
    console.log(`404 - Route not found: ${req.method} ${req.url}`);
    res.status(404).json({ 
        success: false, 
        message: `Endpoint not found: ${req.method} ${req.url}`,
        available_endpoints: [
            'GET /api/check-52-week-hit',
            'GET /api/check-trading-near',
            'GET /api/52-week-range',
            'GET /api/52-week-notifications',
            'GET /api/52-week-range/status',
            'GET /api/market-status',
            'POST /api/52-week-range/update',
            'POST /api/update-52-week-range'
        ]
    });
});

module.exports = app;

// Start server if not in Vercel
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}
