/**
 * Service for interacting with the live NEPSE market API
 */

const axios = require('axios');
const { safeParseFloat } = require('../utils/marketUtils');

const NEPSE_API_URL = process.env.NEPSE_LIVE_API_URL ||
    'https://nepse-hub-backend.vercel.app/api/core?route=live-nepse';

/**
 * Fetch live market data from NEPSE API
 * 
 * Expected API response format:
 * [
 *   {
 *     symbol: "KKHC",
 *     openPrice: 266,
 *     highPrice: 273,
 *     lowPrice: 265.1,
 *     lastTradedPrice: 267.9,
 *     ...other fields
 *   }
 * ]
 */
const fetchLiveMarketData = async () => {
    try {
        const response = await axios.get(NEPSE_API_URL, {
            timeout: 15000,
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.data || !Array.isArray(response.data)) {
            throw new Error('Invalid API response format: expected array');
        }

        // Map API fields to internal format
        return response.data.map(stock => ({
            symbol: stock.symbol?.toString().trim().toUpperCase() || '',
            open: safeParseFloat(stock.openPrice),
            high: safeParseFloat(stock.highPrice),
            low: safeParseFloat(stock.lowPrice),
            ltp: safeParseFloat(stock.lastTradedPrice),
            // Keep original fields for reference
            _original: stock
        })).filter(stock => stock.symbol); // Filter out entries without symbol

    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            throw new Error('External API timeout');
        }
        if (error.response) {
            throw new Error(`External API error: ${error.response.status}`);
        }
        throw new Error(`Failed to fetch live market data: ${error.message}`);
    }
};

/**
 * Get specific stock data from live market
 */
const fetchStockData = async (symbol) => {
    const normalizedSymbol = symbol.toString().trim().toUpperCase();
    const allStocks = await fetchLiveMarketData();
    return allStocks.find(stock => stock.symbol === normalizedSymbol) || null;
};

module.exports = {
    fetchLiveMarketData,
    fetchStockData,
    NEPSE_API_URL
};