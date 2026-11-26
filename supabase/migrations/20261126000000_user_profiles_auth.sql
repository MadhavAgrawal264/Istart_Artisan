-- ==============================================================================
-- ARTISAN MARKETPLACE: USER PROFILES & ACCOUNT TYPES (NON-DESTRUCTIVE MIGRATION)
-- File: supabase/migrations/20261126000000_user_profiles_auth.sql
-- Extensible for Artisan, Buyer, and future Organization accounts.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL CHECK (length(trim(full_name)) >= 2),
    email TEXT NOT NULL,
    mobile_number TEXT NOT NULL CHECK (length(trim(mobile_number)) >= 8),
    account_type TEXT NOT NULL DEFAULT 'buyer' CHECK (
        account_type IN ('artisan', 'buyer', 'organization')
    ),
    organization_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.profiles IS 'Registered user profiles linked to Supabase auth.users with extensible account_type';

CREATE INDEX IF NOT EXISTS idx_profiles_account_type ON public.profiles (account_type);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view own profile'
    ) THEN
        CREATE POLICY "Users can view own profile"
            ON public.profiles FOR SELECT
            USING (auth.uid() = id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert own profile'
    ) THEN
        CREATE POLICY "Users can insert own profile"
            ON public.profiles FOR INSERT
            WITH CHECK (auth.uid() = id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update own profile'
    ) THEN
        CREATE POLICY "Users can update own profile"
            ON public.profiles FOR UPDATE
            USING (auth.uid() = id);
    END IF;
END $$;
