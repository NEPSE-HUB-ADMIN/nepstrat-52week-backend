/**
 * Routes for 52-week range feature
 */

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

// Public routes
router.get('/check-52-week-hit', check52WeekHit);
router.get('/check-trading-near', checkTradingNear);
router.get('/52-week-range', get52WeekRange);
router.get('/52-week-notifications', getNotificationsHandler);
router.get('/52-week-range/status', get52WeekRangeStatus);
router.get('/market-status', getMarketStatus);

// ✅ POST routes (make sure these exist)
router.post('/52-week-range/update', update52WeekRangeData);
router.post('/update-52-week-range', updateEndOfDay52WeekRange);

module.exports = router;
