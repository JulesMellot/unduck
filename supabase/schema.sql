-- Create the bangs table
CREATE TABLE IF NOT EXISTS public.bangs (
    id SERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    domain TEXT,
    category TEXT,
    subcategory TEXT,
    rank INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bangs_key ON public.bangs (key);
CREATE INDEX IF NOT EXISTS idx_bangs_category ON public.bangs (category);
CREATE INDEX IF NOT EXISTS idx_bangs_rank ON public.bangs (rank);

-- Enable Row Level Security (RLS)
-- Note: You may want to configure RLS policies based on your needs
ALTER TABLE public.bangs ENABLE ROW LEVEL SECURITY;

-- Grant permissions (adjust as needed for your security requirements)
GRANT ALL ON TABLE public.bangs TO authenticated;
GRANT ALL ON TABLE public.bangs TO service_role;
GRANT SELECT ON TABLE public.bangs TO anon;

-- Grant permissions for sequences
GRANT ALL ON SEQUENCE public.bangs_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.bangs_id_seq TO service_role;
GRANT SELECT ON SEQUENCE public.bangs_id_seq TO anon;

-- Create the metadata table
CREATE TABLE IF NOT EXISTS public.metadata (
    key TEXT PRIMARY KEY,
    last_updated TIMESTAMP WITH TIME ZONE
);

-- Grant permissions for metadata table
GRANT ALL ON TABLE public.metadata TO authenticated;
GRANT ALL ON TABLE public.metadata TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.metadata TO anon;

-- Disable RLS for metadata table for simplicity
ALTER TABLE public.metadata DISABLE ROW LEVEL SECURITY;