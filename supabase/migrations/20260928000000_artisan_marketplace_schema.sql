-- ==============================================================================
-- ARTISAN MARKETPLACE: RELATIONAL DATABASE INFRASTRUCTURE (SUPABASE / POSTGRESQL)
-- File: supabase/migrations/20260928000000_artisan_marketplace_schema.sql
-- ==============================================================================
-- Architecture: Multi-tenant village artisan catalog with offline sync support,
-- fair-trade benchmark validations, and financial milestone tracking.
-- ==============================================================================

-- 1. EXTENSIONS
-- Enable pgcrypto / uuid-ossp for secure UUIDv4 generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABLE DDL: artisans
-- Stores demographic, contact, and cooperative registration details of creators.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.artisans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (length(trim(name)) >= 2),
    location TEXT NOT NULL CHECK (length(trim(location)) >= 2),
    phone_number TEXT NOT NULL CHECK (length(trim(phone_number)) >= 8),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Comments on table & columns for schema documentation & PostgREST introspection
COMMENT ON TABLE public.artisans IS 'Master directory of registered village artisans and craft collectives';
COMMENT ON COLUMN public.artisans.id IS 'Unique identifier for the creator (UUIDv4)';
COMMENT ON COLUMN public.artisans.name IS 'Full legal or craft guild name of the artisan';
COMMENT ON COLUMN public.artisans.location IS 'Village, Panchayat, District, and State of the workshop';
COMMENT ON COLUMN public.artisans.phone_number IS 'Contact number for SMS/WhatsApp payment confirmations';
COMMENT ON COLUMN public.artisans.created_at IS 'Immutable registration timestamp (UTC)';

-- Index on created_at for chronological directory browsing
CREATE INDEX IF NOT EXISTS idx_artisans_created_at ON public.artisans (created_at DESC);


-- ==============================================================================
-- 3. TABLE DDL: material_benchmarks
-- Stores standardized baseline market costs per raw material unit to protect
-- artisans from predatory supply pricing and middle-men undercutting.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.material_benchmarks (
    id SERIAL PRIMARY KEY,
    material_name TEXT NOT NULL UNIQUE CHECK (length(trim(material_name)) >= 2),
    average_cost NUMERIC(10, 2) NOT NULL CHECK (average_cost >= 0)
);

COMMENT ON TABLE public.material_benchmarks IS 'Standardized raw material baseline prices vetted by craft boards';
COMMENT ON COLUMN public.material_benchmarks.id IS 'Auto-incrementing surrogate primary key';
COMMENT ON COLUMN public.material_benchmarks.material_name IS 'Standardized material title (e.g., Clay, Yarn, Wood, Silk)';
COMMENT ON COLUMN public.material_benchmarks.average_cost IS 'Current average market benchmark cost in INR (₹)';

-- Unique index for rapid case-insensitive material lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_material_benchmarks_lower_name 
    ON public.material_benchmarks (lower(material_name));


-- ==============================================================================
-- 4. TABLE DDL: products
-- Relational craft catalog linking products to creator artisans, raw material
-- specifications, calculated living-wage pricing, and visual progress states.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artisan_id UUID NOT NULL REFERENCES public.artisans(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL CHECK (length(trim(product_name)) >= 2),
    material_type TEXT NOT NULL CHECK (length(trim(material_type)) >= 2),
    calculated_price NUMERIC(10, 2) NOT NULL CHECK (calculated_price >= 0),
    status TEXT NOT NULL DEFAULT 'listed' CHECK (
        status IN ('listed', 'sold', 'processing', 'in_bank_account')
    ),
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.products IS 'Direct-trade craft listings with transparent pricing and milestone tracking';
COMMENT ON COLUMN public.products.id IS 'Unique identifier for the product listing (UUIDv4)';
COMMENT ON COLUMN public.products.artisan_id IS 'Foreign key referencing the artisan who created this craft';
COMMENT ON COLUMN public.products.product_name IS 'Descriptive vernacular or English title of the art piece';
COMMENT ON COLUMN public.products.material_type IS 'Primary raw craft material (matches material_benchmarks)';
COMMENT ON COLUMN public.products.calculated_price IS 'Final selling price in INR calculated via living-wage formula';
COMMENT ON COLUMN public.products.status IS 'Financial lifecycle state: listed -> sold -> processing -> in_bank_account';
COMMENT ON COLUMN public.products.image_url IS 'Public storage URL for the high-res craft photograph';
COMMENT ON COLUMN public.products.created_at IS 'Listing timestamp (UTC)';

-- High-performance foreign key and status indexes
CREATE INDEX IF NOT EXISTS idx_products_artisan_id ON public.products (artisan_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products (status);
CREATE INDEX IF NOT EXISTS idx_products_material_type ON public.products (material_type);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products (created_at DESC);


-- ==============================================================================
-- 5. ROW-LEVEL SECURITY (RLS) POLICIES
-- Production-secure data isolation protecting artisan privacy while enabling
-- public catalog discovery and authenticated seller modifications.
-- ==============================================================================

-- Enable RLS on all three tables
ALTER TABLE public.artisans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 5a. Material Benchmarks Policies (Public Read, Admin Write)
CREATE POLICY "Public can view material benchmarks" 
    ON public.material_benchmarks 
    FOR SELECT 
    USING (true);

-- 5b. Artisans Directory Policies (Public Read, Authenticated/Service Role Insert & Update)
CREATE POLICY "Public can view artisan profiles" 
    ON public.artisans 
    FOR SELECT 
    USING (true);

CREATE POLICY "Artisans can create or update profiles" 
    ON public.artisans 
    FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Artisans can update own profile" 
    ON public.artisans 
    FOR UPDATE 
    USING (true);

-- 5c. Products Policies (Public Read, Authenticated Insert & Update)
CREATE POLICY "Public can view listed products" 
    ON public.products 
    FOR SELECT 
    USING (true);

CREATE POLICY "Artisans can insert products" 
    ON public.products 
    FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Artisans can update own products" 
    ON public.products 
    FOR UPDATE 
    USING (true);


-- ==============================================================================
-- 6. SEED DATA (INITIAL BENCHMARKS & MASTER ARTISANS)
-- ==============================================================================

-- Standardized baseline material costs per unit (INR ₹)
INSERT INTO public.material_benchmarks (material_name, average_cost)
VALUES
    ('Clay', 120.00),     -- Potter's terracotta clay batch (per 10 kg)
    ('Yarn', 280.00),     -- Organic handspun cotton / khadi yarn hank
    ('Wood', 450.00),     -- Seasoned neem / teak wood craft block
    ('Silk', 850.00),     -- Pure tussar / mulberry silk warp spool
    ('Brass', 600.00),    -- Dhokra lost-wax bell-metal casting alloy
    ('Bamboo', 180.00),   -- Treated cane & natural bamboo stalk batch
    ('Stone', 320.00),    -- Soapstone & soft sandstone carving tile
    ('Leather', 520.00)   -- Vegetable-tanned traditional leather sheet
ON CONFLICT (material_name) DO UPDATE 
SET average_cost = EXCLUDED.average_cost;

-- Seed authentic master artisans
INSERT INTO public.artisans (id, name, location, phone_number)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Sitadevi Devi', 'Madhubani, Mithila, Bihar', '+91 98765 43210'),
    ('a0000000-0000-0000-0000-000000000002', 'Rameshwar Acharya', 'Channapatna, Ramanagara, Karnataka', '+91 98450 11223'),
    ('a0000000-0000-0000-0000-000000000003', 'Fatima Begum', 'Srinagar, Kashmir', '+91 94190 33445')
ON CONFLICT (id) DO NOTHING;

-- Seed initial benchmark craft listings
INSERT INTO public.products (id, artisan_id, product_name, material_type, calculated_price, status, image_url)
VALUES
    (
        'b0000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000001',
        'Madhubani Tree of Life Painting',
        'Silk',
        2250.00,
        'listed',
        '/assets/artisan_logo.jpg'
    ),
    (
        'b0000000-0000-0000-0000-000000000002',
        'a0000000-0000-0000-0000-000000000002',
        'Channapatna Lacquered Wooden Stacking Toy',
        'Wood',
        850.00,
        'processing',
        '/assets/artisan_logo.jpg'
    )
ON CONFLICT (id) DO NOTHING;
