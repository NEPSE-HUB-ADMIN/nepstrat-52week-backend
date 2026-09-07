-- Create 52_week_range table
CREATE TABLE IF NOT EXISTS public."52_week_range" (
    symbol TEXT PRIMARY KEY,
    ltp NUMERIC,
    "52_week_high" NUMERIC NOT NULL,
    "52_week_low" NUMERIC NOT NULL,
    market_capitalization NUMERIC,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_52_week_range_symbol ON public."52_week_range" (symbol);
CREATE INDEX IF NOT EXISTS idx_52_week_range_high_low ON public."52_week_range" ("52_week_high", "52_week_low");
CREATE INDEX IF NOT EXISTS idx_52_week_range_updated_at ON public."52_week_range" (updated_at);

-- Enable RLS
ALTER TABLE public."52_week_range" ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Policy 1: Allow authenticated users to read all records
CREATE POLICY "Allow authenticated users to read 52_week_range"
    ON public."52_week_range"
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy 2: Allow public users to read all records (if frontend needs access)
CREATE POLICY "Allow public users to read 52_week_range"
    ON public."52_week_range"
    FOR SELECT
    TO public
    USING (true);

-- Policy 3: Allow service role to perform all operations
CREATE POLICY "Allow service role full access to 52_week_range"
    ON public."52_week_range"
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy 4: Allow authenticated users to update (if needed for admin)
CREATE POLICY "Allow authenticated users to update 52_week_range"
    ON public."52_week_range"
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Policy 5: Allow authenticated users to insert (if needed for admin)
CREATE POLICY "Allow authenticated users to insert 52_week_range"
    ON public."52_week_range"
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_52_week_range_updated_at
    BEFORE UPDATE ON public."52_week_range"
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();