/**
 * Service for 52-week range operations
 */

const { supabase } = require('../config/supabase');
const { normalizeSymbol, safeParseFloat, formatNearNote, calculateDistance } = require('../utils/marketUtils');

const TABLE_RANGE = '52_week_range';
const TABLE_NOTIFICATION = '52_week_notification';

/**
 * Get all 52-week range records
 */
const getAllRangeRecords = async () => {
    const { data, error } = await supabase
        .from(TABLE_RANGE)
        .select('*')
        .order('symbol');

    if (error) {
        throw new Error(`Failed to fetch 52-week range: ${error.message}`);
    }

    return data || [];
};

/**
 * Get 52-week range for a specific symbol
 */
const getRangeRecord = async (symbol) => {
    const normalizedSymbol = normalizeSymbol(symbol);
    if (!normalizedSymbol) {
        throw new Error('Invalid symbol');
    }

    const { data, error } = await supabase
        .from(TABLE_RANGE)
        .select('*')
        .eq('symbol', normalizedSymbol)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            return null; // Not found
        }
        throw new Error(`Failed to fetch 52-week range: ${error.message}`);
    }

    return data;
};

/**
 * Upsert 52-week range records (create or update)
 */
const upsertRangeRecords = async (records) => {
    if (!records || !records.length) {
        return { success: true, message: 'No records to upsert' };
    }

    const validRecords = records
        .filter(r => r.symbol && r['52_week_high'] && r['52_week_low'])
        .map(r => ({
            symbol: normalizeSymbol(r.symbol),
            ltp: safeParseFloat(r.ltp) || null,
            '52_week_high': safeParseFloat(r['52_week_high']),
            '52_week_low': safeParseFloat(r['52_week_low']),
            market_capitalization: safeParseFloat(r.market_capitalization) || null,
            note: r.note || null,
            updated_at: new Date().toISOString()
        }));

    if (!validRecords.length) {
        return { success: true, message: 'No valid records to upsert' };
    }

    // Use upsert with onConflict merge
    const { data, error } = await supabase
        .from(TABLE_RANGE)
        .upsert(validRecords, {
            onConflict: 'symbol',
            ignoreDuplicates: false
        })
        .select();

    if (error) {
        throw new Error(`Failed to upsert 52-week range: ${error.message}`);
    }

    return {
        success: true,
        message: `Upserted ${validRecords.length} records`,
        data
    };
};

/**
 * Bulk update range records (for updating notes and other fields)
 */
const bulkUpdateRangeRecords = async (updates) => {
    if (!updates || !updates.length) {
        return { success: true, message: 'No updates to process' };
    }

    const results = [];
    let updatedCount = 0;
    let skippedCount = 0;

    for (const update of updates) {
        const { symbol, ...fields } = update;
        const normalizedSymbol = normalizeSymbol(symbol);

        if (!normalizedSymbol || Object.keys(fields).length === 0) {
            skippedCount++;
            continue;
        }

        const { data, error } = await supabase
            .from(TABLE_RANGE)
            .update({
                ...fields,
                updated_at: new Date().toISOString()
            })
            .eq('symbol', normalizedSymbol)
            .select();

        if (error) {
            results.push({ symbol: normalizedSymbol, error: error.message });
        } else if (data && data.length) {
            updatedCount++;
        } else {
            skippedCount++;
        }
    }

    return {
        success: true,
        updated: updatedCount,
        skipped: skippedCount,
        errors: results
    };
};

/**
 * Create a notification for 52-week hit
 */
const createNotification = async (symbol, hitPrice, type, tradingDate) => {
    const normalizedSymbol = normalizeSymbol(symbol);
    if (!normalizedSymbol || !hitPrice || !type) {
        throw new Error('Invalid notification data');
    }

    const hitPriceNum = safeParseFloat(hitPrice);
    if (hitPriceNum === null) {
        throw new Error('Invalid hit price');
    }

    const note = type === 'HIGH'
        ? `${normalizedSymbol} hit 52 week high`
        : `${normalizedSymbol} hit 52 week low`;

    const notification = {
        symbol: normalizedSymbol,
        hit_price: hitPriceNum,
        note: note,
        notification_type: type,
        trading_date: tradingDate || new Date().toISOString().split('T')[0]
    };

    // Try to insert - will fail if duplicate (handled by unique constraint)
    const { data, error } = await supabase
        .from(TABLE_NOTIFICATION)
        .insert(notification)
        .select();

    if (error) {
        // Check if it's a duplicate violation
        if (error.code === '23505') {
            return {
                success: true,
                message: 'Notification already exists (duplicate prevented)',
                duplicate: true
            };
        }
        throw new Error(`Failed to create notification: ${error.message}`);
    }

    return {
        success: true,
        message: 'Notification created',
        data: data?.[0]
    };
};

/**
 * Get notifications with filters
 */
const getNotifications = async (filters = {}) => {
    let query = supabase
        .from(TABLE_NOTIFICATION)
        .select('*')
        .order('created_at', { ascending: false });

    if (filters.symbol) {
        query = query.eq('symbol', normalizeSymbol(filters.symbol));
    }

    if (filters.type) {
        const type = filters.type.toUpperCase();
        if (type === 'HIGH' || type === 'LOW') {
            query = query.eq('notification_type', type);
        }
    }

    if (filters.date) {
        query = query.eq('trading_date', filters.date);
    }

    if (filters.limit) {
        const limit = parseInt(filters.limit);
        if (limit > 0 && limit <= 1000) {
            query = query.limit(limit);
        }
    }

    if (filters.offset) {
        const offset = parseInt(filters.offset);
        if (offset >= 0) {
            query = query.range(offset, offset + (filters.limit || 50) - 1);
        }
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(`Failed to fetch notifications: ${error.message}`);
    }

    return data || [];
};

/**
 * Update note field for a symbol based on near-high/low status
 */
const updateNoteForSymbol = async (symbol, isNearHigh, isNearLow) => {
    const normalizedSymbol = normalizeSymbol(symbol);
    if (!normalizedSymbol) {
        throw new Error('Invalid symbol');
    }

    const note = formatNearNote(normalizedSymbol, isNearHigh, isNearLow);

    const { data, error } = await supabase
        .from(TABLE_RANGE)
        .update({
            note: note,
            updated_at: new Date().toISOString()
        })
        .eq('symbol', normalizedSymbol)
        .select();

    if (error) {
        throw new Error(`Failed to update note: ${error.message}`);
    }

    return {
        success: true,
        symbol: normalizedSymbol,
        note: note,
        updated: data && data.length > 0
    };
};

/**
 * Compare live data with stored 52-week range and detect hits
 */
const compareWithLiveData = async (liveData, rangeRecords) => {
    const results = {
        checked: 0,
        highHits: 0,
        lowHits: 0,
        newNotifications: 0,
        notifications: [],
        errors: []
    };

    // Create a map for faster lookup
    const rangeMap = new Map();
    rangeRecords.forEach(record => {
        rangeMap.set(record.symbol, record);
    });

    // Process each stock from live data
    for (const stock of liveData) {
        try {
            const rangeRecord = rangeMap.get(stock.symbol);

            // Skip if no 52-week range data available
            if (!rangeRecord) {
                continue;
            }

            results.checked++;

            const high = rangeRecord['52_week_high'];
            const low = rangeRecord['52_week_low'];

            // Skip if high/low are null
            if (high === null || low === null) {
                continue;
            }

            // Check for 52-week high hit
            let hitPrice = null;
            let hitType = null;

            // Check high condition: open >= high OR high >= high OR ltp >= high
            if (stock.open !== null && stock.open >= high) {
                hitPrice = stock.open;
                hitType = 'HIGH';
            } else if (stock.high !== null && stock.high >= high) {
                hitPrice = stock.high;
                hitType = 'HIGH';
            } else if (stock.ltp !== null && stock.ltp >= high) {
                hitPrice = stock.ltp;
                hitType = 'HIGH';
            }

            // Check low condition: open <= low OR low <= low OR ltp <= low
            if (!hitType) {
                if (stock.open !== null && stock.open <= low) {
                    hitPrice = stock.open;
                    hitType = 'LOW';
                } else if (stock.low !== null && stock.low <= low) {
                    hitPrice = stock.low;
                    hitType = 'LOW';
                } else if (stock.ltp !== null && stock.ltp <= low) {
                    hitPrice = stock.ltp;
                    hitType = 'LOW';
                }
            }

            // If a hit was detected, create notification
            if (hitType && hitPrice !== null) {
                const tradingDate = new Date().toISOString().split('T')[0];
                const result = await createNotification(
                    stock.symbol,
                    hitPrice,
                    hitType,
                    tradingDate
                );

                if (result.success && !result.duplicate) {
                    results.newNotifications++;
                    results.notifications.push({
                        symbol: stock.symbol,
                        hitPrice: hitPrice,
                        type: hitType
                    });

                    if (hitType === 'HIGH') {
                        results.highHits++;
                    } else {
                        results.lowHits++;
                    }
                } else if (result.success && result.duplicate) {
                    // Duplicate notification prevented - still count as a hit but not a new notification
                    if (hitType === 'HIGH') {
                        results.highHits++;
                    } else {
                        results.lowHits++;
                    }
                }
            }
        } catch (error) {
            results.errors.push({
                symbol: stock.symbol,
                error: error.message
            });
        }
    }

    return results;
};

/**
 * Get the latest completed trading day
 */
const getLatestCompletedTradingDay = async () => {
    const { data, error } = await supabase
        .from(TABLE_NOTIFICATION)
        .select('trading_date')
        .order('trading_date', { ascending: false })
        .limit(1);

    if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to get latest trading day: ${error.message}`);
    }

    return data && data.length > 0 ? data[0].trading_date : null;
};

module.exports = {
    getAllRangeRecords,
    getRangeRecord,
    upsertRangeRecords,
    bulkUpdateRangeRecords,
    createNotification,
    getNotifications,
    updateNoteForSymbol,
    compareWithLiveData,
    getLatestCompletedTradingDay
};