/**
 * Market utility functions for NEPSE trading operations
 */

const moment = require('moment-timezone');
const axios = require('axios');

// NEPSE trading hours (Nepal Time - UTC+5:45)
const TRADING_START_HOUR = 11;
const TRADING_END_HOUR = 15;
const MARKET_STATUS_API = process.env.MARKET_STATUS_API || 'https://nepse-hub-backend.vercel.app/market-status';

/**
 * Fetch market status from the official API
 * @returns {Promise<{today: string, status: string, as_of: string}>}
 */
const fetchMarketStatus = async () => {
    try {
        const response = await axios.get(MARKET_STATUS_API, {
            timeout: 10000,
            headers: { 'Accept': 'application/json' }
        });

        if (!response.data || typeof response.data !== 'object') {
            throw new Error('Invalid market status API response');
        }

        return {
            today: response.data.today,
            status: response.data.status,
            asOf: response.data.as_of
        };
    } catch (error) {
        console.error('Failed to fetch market status:', error.message);
        return null;
    }
};

/**
 * Get current date in Nepal timezone
 */
const getCurrentDateInNepal = () => {
    return moment().tz('Asia/Kathmandu').format('YYYY-MM-DD');
};

/**
 * Get the last completed trading day (Monday-Friday)
 */
const getLastCompletedTradingDay = () => {
    let date = moment().tz('Asia/Kathmandu');
    let attempts = 0;

    while (attempts < 7) {
        const dayOfWeek = date.day();
        // Trading days: Monday(1) to Friday(5)
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            return date.format('YYYY-MM-DD');
        }
        date.subtract(1, 'day');
        attempts++;
    }

    return null;
};

/**
 * Normalize symbol to uppercase
 */
const normalizeSymbol = (symbol) => {
    if (!symbol) return null;
    return symbol.toString().trim().toUpperCase();
};

/**
 * Safely parse numeric values
 */
const safeParseFloat = (value) => {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
};

/**
 * Format note message for near-high/low
 */
// const formatNearNote = (symbol, isNearHigh, isNearLow) => {
//     if (isNearHigh && isNearLow) {
//         return `${symbol} is trading near both 52 week high and low (unusual)`;
//     } else if (isNearHigh) {
//         return `${symbol} is trading near 52 week high`;
//     } else if (isNearLow) {
//         return `${symbol} is trading near 52 week low`;
//     }
//     return null;
// };

/**
 * Calculate distance percentage
 */
const calculateDistance = (current, boundary) => {
    if (!current || !boundary || boundary === 0) return null;
    // Use absolute value to avoid negative distances
    return Math.abs(((current - boundary) / boundary) * 100);
};

module.exports = {
    fetchMarketStatus,
    getCurrentDateInNepal,
    getLastCompletedTradingDay,
    normalizeSymbol,
    safeParseFloat,
    formatNearNote,
    calculateDistance,
    TRADING_START_HOUR,
    TRADING_END_HOUR,
    MARKET_STATUS_API
};
