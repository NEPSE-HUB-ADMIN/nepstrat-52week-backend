-- Create 52_week_notification table
CREATE TABLE IF NOT EXISTS public."52_week_notification" (
    id SERIAL PRIMARY KEY,
    symbol TEXT NOT NULL,
    hit_price NUMERIC NOT NULL,
    note TEXT NOT NULL,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('HIGH', 'LOW')),
    trading_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint to prevent duplicate notifications
-- A stock should only have one notification per type per trading day
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_notification_per_day 
    ON public."52_week_notification" (symbol, notification_type, trading_date);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_52_week_notification_symbol ON public."52_week_notification" (symbol);
CREATE INDEX IF NOT EXISTS idx_52_week_notification_created_at ON public."52_week_notification" (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_52_week_notification_trading_date ON public."52_week_notification" (trading_date);
CREATE INDEX IF NOT EXISTS idx_52_week_notification_type ON public."52_week_notification" (notification_type);

-- Enable RLS
ALTER TABLE public."52_week_notification" ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Policy 1: Allow authenticated users to read notifications
CREATE POLICY "Allow authenticated users to read 52_week_notification"
    ON public."52_week_notification"
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy 2: Allow public users to read notifications
CREATE POLICY "Allow public users to read 52_week_notification"
    ON public."52_week_notification"
    FOR SELECT
    TO public
    USING (true);

-- Policy 3: Allow service role full access
CREATE POLICY "Allow service role full access to 52_week_notification"
    ON public."52_week_notification"
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy 4: Allow authenticated users to insert (for admin/backend)
CREATE POLICY "Allow authenticated users to insert 52_week_notification"
    ON public."52_week_notification"
    FOR INSERT
    TO authenticated
    WITH CHECK (true);