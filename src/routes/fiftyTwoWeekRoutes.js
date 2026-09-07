const express = require('express');
const router = express.Router();
const {
    check52WeekHit,
    checkTradingNear,
    get52WeekRange,
    getNotificationsHandler,
    update52WeekRangeData,
    updateEndOfDay52WeekRange,
    get52WeekRangeStatus,
    getMarketStatus
} = require('../controllers/fiftyTwoWeekController');

// GET routes
router.get('/check-52-week-hit', check52WeekHit);
router.get('/check-trading-near', checkTradingNear);
router.get('/52-week-range', get52WeekRange);
router.get('/52-week-notifications', getNotificationsHandler);
router.get('/52-week-range/status', get52WeekRangeStatus);
router.get('/market-status', getMarketStatus);

// POST routes
router.post('/52-week-range/update', update52WeekRangeData);
router.post('/update-52-week-range', updateEndOfDay52WeekRange);
router.post('/update-range-from-live', updateRangeFromLive);

// Log routes
console.log('✅ Routes registered in router:');
console.log('  GET  /api/check-52-week-hit');
console.log('  GET  /api/check-trading-near');
console.log('  GET  /api/52-week-range');
console.log('  GET  /api/52-week-notifications');
console.log('  GET  /api/52-week-range/status');
console.log('  GET  /api/market-status');
console.log('  POST /api/52-week-range/update');
console.log('  POST /api/update-52-week-range');

module.exports = router;
