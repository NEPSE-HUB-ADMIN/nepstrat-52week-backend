/**
 * Service for historical market data operations
 * 
 * NOTE: This is a placeholder implementation. The actual implementation
 * should use the existing project's historical data source.
 * 
 * This service assumes there is a 'historical_prices' table or similar
 * that stores daily OHLC data for each symbol.
 */

const { supabase } = require('../config/supabase');
const { normalizeSymbol, safeParseFloat } = require('../utils/marketUtils');
const { fetchLiveMarketData } = require('./liveNepseService');

const HISTORICAL_TABLE = 'historical_prices'; // Adjust based on existing project

/**
 * Fetch historical OHLC data for a symbol over a period
 * 
 * @param {string} symbol - Stock symbol
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} Array of historical records
 */
const fetchHistoricalDataForSymbol = async (symbol, startDate, endDate) => {
    const normalizedSymbol = normalizeSymbol(symbol);
    if (!normalizedSymbol) {
        throw new Error('Invalid symbol');
    }

    // Try to fetch from existing historical table
    try {
        const { data, error } = await supabase
            .from(HISTORICAL_TABLE)
            .select('*')
            .eq('symbol', normalizedSymbol)
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: true });

        if (error) {
            throw new Error(`Failed to fetch historical data: ${error.message}`);
        }

        return data || [];
    } catch (error) {
        // If the table doesn't exist, try an alternative approach
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
            console.warn('Historical table not found, using fallback data');
            return fetchFallbackHistoricalData(symbol, startDate, endDate);
        }
        throw error;
    }
};

/**
 * Fallback method to get historical data from live API over time
 * NOTE: This is NOT ideal and should be replaced with proper historical data
 */
const fetchFallbackHistoricalData = async (symbol, startDate, endDate) => {
    // This is a placeholder - in production, this should use a real historical data source
    // For demo purposes, we'll return mock data
    console.warn('Using fallback historical data - this should be replaced with real data');

    // Try to get current day's data
    const liveData = await fetchLiveMarketData();
    const currentStock = liveData.find(s => s.symbol === normalizeSymbol(symbol));

    if (!currentStock) {
        return [];
    }

    // Return a single record for the current day
    return [{
        symbol: normalizeSymbol(symbol),
        date: new Date().toISOString().split('T')[0],
        open: currentStock.open,
        high: currentStock.high,
        low: currentStock.low,
        close: currentStock.ltp
    }];
};

/**
 * Calculate 52-week range from historical data
 */
const calculate52WeekRange = async (symbol, tradingDate = null) => {
    const normalizedSymbol = normalizeSymbol(symbol);
    if (!normalizedSymbol) {
        throw new Error('Invalid symbol');
    }

    // Calculate date range (52 weeks back from trading date)
    const endDate = tradingDate || new Date().toISOString().split('T')[0];
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 365); // Approximately 52 weeks
    const startDateStr = startDate.toISOString().split('T')[0];

    // Fetch historical data
    const historicalData = await fetchHistoricalDataForSymbol(
        normalizedSymbol,
        startDateStr,
        endDate
    );

    if (!historicalData || historicalData.length === 0) {
        return {
            symbol: normalizedSymbol,
            high: null,
            low: null,
            hasData: false,
            message: 'No historical data available'
        };
    }

    // Calculate high and low from historical data
    let maxHigh = -Infinity;
    let minLow = Infinity;
    let daysWithData = 0;

    for (const record of historicalData) {
        const high = safeParseFloat(record.high || record.highPrice);
        const low = safeParseFloat(record.low || record.lowPrice);

        if (high !== null && high > 0) {
            maxHigh = Math.max(maxHigh, high);
        }
        if (low !== null && low > 0) {
            minLow = Math.min(minLow, low);
        }
        daysWithData++;
    }

    // If no valid data found
    if (maxHigh === -Infinity || minLow === Infinity) {
        return {
            symbol: normalizedSymbol,
            high: null,
            low: null,
            hasData: false,
            message: 'No valid price data in historical records'
        };
    }

    return {
        symbol: normalizedSymbol,
        high: maxHigh,
        low: minLow,
        hasData: true,
        daysWithData,
        startDate: startDateStr,
        endDate: endDate
    };
};

/**
 * Batch calculate 52-week range for all symbols
 */
const batchCalculate52WeekRange = async (symbols, tradingDate = null) => {
    const results = [];
    const errors = [];

    for (const symbol of symbols) {
        try {
            const result = await calculate52WeekRange(symbol, tradingDate);
            results.push(result);
        } catch (error) {
            errors.push({
                symbol: symbol,
                error: error.message
            });
        }
    }

    return {
        results,
        errors,
        totalProcessed: symbols.length,
        successful: results.length,
        failed: errors.length
    };
};

/**
 * Get all unique symbols from the 52_week_range table
 */
const getAllSymbols = async () => {
    const { data, error } = await supabase
        .from('52_week_range')
        .select('symbol');

    if (error) {
        throw new Error(`Failed to fetch symbols: ${error.message}`);
    }

    return (data || []).map(record => record.symbol);
};

module.exports = {
    fetchHistoricalDataForSymbol,
    calculate52WeekRange,
    batchCalculate52WeekRange,
    getAllSymbols
};