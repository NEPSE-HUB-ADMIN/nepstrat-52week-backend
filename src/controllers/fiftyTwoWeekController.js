/**
 * Controller for 52-week range endpoints
 */

const { supabase } = require('../config/supabase');
const { fetchLiveMarketData } = require('../services/liveNepseService');
const {
    getAllRangeRecords,
    getRangeRecord,
    upsertRangeRecords,
    getNotifications,
    compareWithLiveData,
    updateNoteForSymbol,
    bulkUpdateRangeRecords
} = require('../services/fiftyTwoWeekService');
const {
    calculate52WeekRange,
    batchCalculate52WeekRange,
    getAllSymbols
} = require('../services/historicalDataService');
const {
    fetchMarketStatus,
    getCurrentDateInNepal,
    getLastCompletedTradingDay,
    normalizeSymbol,
    calculateDistance,
    formatNearNote
} = require('../utils/marketUtils');

const NEAR_THRESHOLD = parseFloat(process.env.NEAR_52_WEEK_PERCENT) || 5;

/**
 * GET /check-52-week-hit
 * Check for 52-week high/low hits based on live market data
 * To be called by cronjob.org during trading hours
 */
const check52WeekHit = async (req, res) => {
    try {
        // Fetch live market data
        let liveData;
        try {
            liveData = await fetchLiveMarketData();
        } catch (error) {
            return res.status(502).json({
                success: false,
                message: `Unable to fetch live NEPSE data: ${error.message}`
            });
        }

        if (!liveData || liveData.length === 0) {
            return res.status(502).json({
                success: false,
                message: 'Empty response from live NEPSE API'
            });
        }

        // Fetch existing 52-week range records
        let rangeRecords;
        try {
            rangeRecords = await getAllRangeRecords();
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: `Failed to fetch 52-week range data: ${error.message}`
            });
        }

        // Compare and detect hits
        const results = await compareWithLiveData(liveData, rangeRecords);

        return res.status(200).json({
            success: true,
            message: '52-week hit check completed',
            data: {
                checked: results.checked,
                high_hits: results.highHits,
                low_hits: results.lowHits,
                new_notifications: results.newNotifications,
                notifications: results.notifications.slice(0, 20),
                errors: results.errors
            }
        });

    } catch (error) {
        console.error('Error in check52WeekHit:', error);
        return res.status(500).json({
            success: false,
            message: `Internal server error: ${error.message}`
        });
    }
};

/**
 * GET /check-trading-near
 * Check if stocks are trading near 52-week high/low
 * To be called by cronjob.org during trading hours
 */
/**
 * GET /check-trading-near
 * Check if stocks are trading near 52-week high/low
 * To be called by cronjob.org during trading hours
 */
/**
 * GET /check-trading-near
 * Check if stocks are trading near 52-week high/low
 * To be called by cronjob.org during trading hours
 */
const checkTradingNear = async (req, res) => {
    try {
        const { symbol } = req.query;

        // Fetch live market data
        let liveData;
        try {
            liveData = await fetchLiveMarketData();
        } catch (error) {
            return res.status(502).json({
                success: false,
                message: `Unable to fetch live NEPSE data: ${error.message}`
            });
        }

        if (!liveData || liveData.length === 0) {
            return res.status(502).json({
                success: false,
                message: 'Empty response from live NEPSE API'
            });
        }

        // Fetch 52-week range records
        let rangeRecords;
        try {
            if (symbol) {
                const record = await getRangeRecord(symbol);
                rangeRecords = record ? [record] : [];
            } else {
                rangeRecords = await getAllRangeRecords();
            }
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: `Failed to fetch 52-week range data: ${error.message}`
            });
        }

        // Create map for faster lookup
        const rangeMap = new Map();
        rangeRecords.forEach(record => {
            rangeMap.set(record.symbol, record);
        });

        // Process each stock
        const updates = [];
        const results = [];

        for (const stock of liveData) {
            const rangeRecord = rangeMap.get(stock.symbol);
            if (!rangeRecord || rangeRecord['52_week_high'] === null || rangeRecord['52_week_low'] === null) {
                continue;
            }

            const ltp = stock.ltp;
            if (ltp === null) {
                continue;
            }

            const high = rangeRecord['52_week_high'];
            const low = rangeRecord['52_week_low'];

            // Calculate distances (using absolute values)
            const distanceHigh = calculateDistance(ltp, high);
            const distanceLow = calculateDistance(ltp, low);

            // Check if within threshold (using absolute distance values)
            const isNearHigh = distanceHigh !== null && distanceHigh <= NEAR_THRESHOLD;
            const isNearLow = distanceLow !== null && distanceLow <= NEAR_THRESHOLD;

            // Determine the appropriate note using formatNearNote
            const newNote = formatNearNote(stock.symbol, isNearHigh, isNearLow);

            // Get current note
            const currentNote = rangeRecord.note;

            // Update if note has changed
            if (currentNote !== newNote) {
                updates.push({
                    symbol: stock.symbol,
                    note: newNote
                });
            }

            // Build result object for response
            results.push({
                symbol: stock.symbol,
                ltp: ltp,
                high: high,
                low: low,
                distance_high: distanceHigh,
                distance_low: distanceLow,
                is_near_high: isNearHigh,
                is_near_low: isNearLow,
                current_note: currentNote,
                new_note: newNote
            });
        }

        // Apply updates
        let updateResult = { updated: 0, skipped: 0, errors: [] };
        if (updates.length > 0) {
            try {
                updateResult = await bulkUpdateRangeRecords(updates);
            } catch (error) {
                console.error('Error updating notes:', error);
                updateResult.errors.push({ error: error.message });
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Trading near check completed',
            data: {
                threshold: NEAR_THRESHOLD,
                total_processed: results.length,
                note_updates: updates.length,
                updated: updateResult.updated || 0,
                results: results.slice(0, 100)
            }
        });

    } catch (error) {
        console.error('Error in checkTradingNear:', error);
        return res.status(500).json({
            success: false,
            message: `Internal server error: ${error.message}`
        });
    }
};

/**
 * GET /52-week-range
 * Fetch 52-week range data
 */
const get52WeekRange = async (req, res) => {
    try {
        const { symbol } = req.query;

        if (symbol) {
            const record = await getRangeRecord(symbol);
            if (!record) {
                return res.status(404).json({
                    success: false,
                    message: `Symbol ${symbol} not found`
                });
            }
            return res.status(200).json({
                success: true,
                data: record
            });
        }

        const records = await getAllRangeRecords();
        return res.status(200).json({
            success: true,
            data: records
        });

    } catch (error) {
        console.error('Error in get52WeekRange:', error);
        return res.status(500).json({
            success: false,
            message: `Failed to fetch 52-week range data: ${error.message}`
        });
    }
};

/**
 * GET /52-week-notifications
 * Fetch notifications
 */
const getNotificationsHandler = async (req, res) => {
    try {
        const { symbol, type, date, limit, offset } = req.query;

        const filters = {
            symbol: symbol,
            type: type,
            date: date,
            limit: limit ? parseInt(limit) : 50,
            offset: offset ? parseInt(offset) : 0
        };

        const notifications = await getNotifications(filters);

        return res.status(200).json({
            success: true,
            data: notifications,
            pagination: {
                limit: filters.limit,
                offset: filters.offset,
                total: notifications.length
            }
        });

    } catch (error) {
        console.error('Error in getNotificationsHandler:', error);
        return res.status(500).json({
            success: false,
            message: `Failed to fetch notifications: ${error.message}`
        });
    }
};

/**
 * POST /52-week-range/update
 * Update/upsert 52-week range data
 * Can be called manually or via cronjob.org
 */
const update52WeekRangeData = async (req, res) => {
    try {
        const { stocks } = req.body;

        // Validate input
        if (!stocks || !Array.isArray(stocks) || stocks.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid input: stocks array is required'
            });
        }

        // Validate each stock
        const validStocks = stocks.filter(stock => {
            return stock.symbol &&
                stock['52_week_high'] !== undefined &&
                stock['52_week_low'] !== undefined;
        });

        if (validStocks.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid stocks provided'
            });
        }

        const result = await upsertRangeRecords(validStocks);

        return res.status(200).json({
            success: true,
            message: result.message,
            data: {
                processed: validStocks.length,
                data: result.data
            }
        });

    } catch (error) {
        console.error('Error in update52WeekRangeData:', error);
        return res.status(500).json({
            success: false,
            message: `Failed to update 52-week range data: ${error.message}`
        });
    }
};

/**
 * POST /update-52-week-range
 * End-of-day 52-week range update
 * To be called by cronjob.org after market close (3:30 PM NPT)
 */
const updateEndOfDay52WeekRange = async (req, res) => {
    try {
        // Get the trading date to process
        const tradingDate = req.body.tradingDate || getLastCompletedTradingDay();

        if (!tradingDate) {
            return res.status(400).json({
                success: false,
                message: 'Unable to determine trading date'
            });
        }

        // Get all symbols from the range table
        let symbols;
        try {
            symbols = await getAllSymbols();
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: `Failed to fetch symbols: ${error.message}`
            });
        }

        if (!symbols || symbols.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No symbols to process',
                data: {
                    trading_date: tradingDate,
                    processed: 0,
                    updated: 0,
                    unchanged: 0,
                    skipped: 0,
                    errors: 0
                }
            });
        }

        // Calculate 52-week range for all symbols
        const calculationResult = await batchCalculate52WeekRange(symbols, tradingDate);

        // Prepare updates
        const updates = [];
        let unchanged = 0;
        let skipped = 0;

        // Fetch current records to compare
        const currentRecords = await getAllRangeRecords();
        const currentMap = new Map();
        currentRecords.forEach(record => {
            currentMap.set(record.symbol, record);
        });

        for (const result of calculationResult.results) {
            if (!result.hasData || result.high === null || result.low === null) {
                skipped++;
                continue;
            }

            const current = currentMap.get(result.symbol);
            if (!current) {
                skipped++;
                continue;
            }

            const currentHigh = current['52_week_high'];
            const currentLow = current['52_week_low'];

            // Check if values have changed
            const highChanged = Math.abs(currentHigh - result.high) > 0.001;
            const lowChanged = Math.abs(currentLow - result.low) > 0.001;

            if (highChanged || lowChanged) {
                updates.push({
                    symbol: result.symbol,
                    '52_week_high': result.high,
                    '52_week_low': result.low
                });
            } else {
                unchanged++;
            }
        }

        // Apply updates
        let updateResult = { updated: 0, errors: [] };
        if (updates.length > 0) {
            try {
                updateResult = await bulkUpdateRangeRecords(updates);
            } catch (error) {
                console.error('Error updating ranges:', error);
                updateResult.errors.push({ error: error.message });
            }
        }

        return res.status(200).json({
            success: true,
            message: '52-week range update completed',
            data: {
                trading_date: tradingDate,
                processed: symbols.length,
                updated: updates.length,
                unchanged: unchanged,
                skipped: skipped + calculationResult.errors.length,
                errors: calculationResult.errors.length + updateResult.errors.length,
                details: {
                    calculation_errors: calculationResult.errors,
                    update_errors: updateResult.errors
                }
            }
        });

    } catch (error) {
        console.error('Error in updateEndOfDay52WeekRange:', error);
        return res.status(500).json({
            success: false,
            message: `Failed to update 52-week range: ${error.message}`
        });
    }
};

/**
 * GET /52-week-range/status
 * Get status of 52-week range data
 */
const get52WeekRangeStatus = async (req, res) => {
    try {
        // Get count of records
        const records = await getAllRangeRecords();

        // Get latest notification date
        const latestNotification = await supabase
            .from('52_week_notification')
            .select('created_at')
            .order('created_at', { ascending: false })
            .limit(1);

        const lastCompletedDay = getLastCompletedTradingDay();
        const marketStatus = await fetchMarketStatus();

        return res.status(200).json({
            success: true,
            data: {
                last_updated: records.length > 0 ? records[0].updated_at : null,
                symbols: records.length,
                last_completed_trading_day: lastCompletedDay,
                latest_notification: latestNotification.data && latestNotification.data.length > 0
                    ? latestNotification.data[0].created_at
                    : null,
                near_threshold: NEAR_THRESHOLD,
                market_status: marketStatus,
                current_time: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Error in get52WeekRangeStatus:', error);
        return res.status(500).json({
            success: false,
            message: `Failed to get status: ${error.message}`
        });
    }
};

/**
 * GET /market-status
 * Get current market status from the API
 */
const getMarketStatus = async (req, res) => {
    try {
        const status = await fetchMarketStatus();

        return res.status(200).json({
            success: true,
            data: {
                api_status: status,
                current_time: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error in getMarketStatus:', error);
        return res.status(500).json({
            success: false,
            message: `Failed to get market status: ${error.message}`
        });
    }
};

module.exports = {
    check52WeekHit,
    checkTradingNear,
    get52WeekRange,
    getNotificationsHandler,
    update52WeekRangeData,
    updateEndOfDay52WeekRange,
    get52WeekRangeStatus,
    getMarketStatus
};
