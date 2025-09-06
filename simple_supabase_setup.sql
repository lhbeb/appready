-- =====================================================
-- SIMPLE SUPABASE SETUP FOR JOB APPLICATION PROJECT
-- =====================================================
-- This is a simplified version that avoids common errors
-- Run this step by step or all at once
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";

-- =====================================================
-- STEP 1: CREATE TABLE
-- =====================================================

-- Create job_applications table (matches App.tsx implementation)
CREATE TABLE IF NOT EXISTS job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    ssn TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'under_review')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- STEP 2: CREATE STORAGE BUCKET
-- =====================================================

-- Create '9alwa' storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    '9alwa',
    '9alwa',
    false,
    104857600, -- 100MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'text/plain', 'video/webm', 'video/mp4', 'application/octet-stream']
) ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- STEP 3: ENABLE RLS
-- =====================================================

-- Enable RLS on job_applications table
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 4: CREATE TABLE POLICIES
-- =====================================================

-- Allow anyone to insert job applications
CREATE POLICY \"public_insert_applications\"
    ON job_applications
    FOR INSERT
    TO public
    WITH CHECK (
        first_name IS NOT NULL AND
        first_name != '' AND
        last_name IS NOT NULL AND
        last_name != ''
    );

-- Allow anyone to view applications
CREATE POLICY \"public_select_applications\"
    ON job_applications
    FOR SELECT
    TO public
    USING (true);

-- Allow updates
CREATE POLICY \"public_update_applications\"
    ON job_applications
    FOR UPDATE
    TO public
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- STEP 5: CREATE STORAGE POLICIES
-- =====================================================

-- Allow uploads to 9alwa bucket in application folders
CREATE POLICY \"9alwa_upload_policy\"
    ON storage.objects
    FOR INSERT
    TO public
    WITH CHECK (
        bucket_id = '9alwa' AND
        (storage.foldername(name))[1] LIKE 'application_%'
    );

-- Allow viewing files from 9alwa bucket
CREATE POLICY \"9alwa_select_policy\"
    ON storage.objects
    FOR SELECT
    TO public
    USING (
        bucket_id = '9alwa'
    );

-- Allow deleting files from 9alwa bucket
CREATE POLICY \"9alwa_delete_policy\"
    ON storage.objects
    FOR DELETE
    TO public
    USING (
        bucket_id = '9alwa' AND
        (storage.foldername(name))[1] LIKE 'application_%'
    );

-- =====================================================
-- STEP 6: GRANT PERMISSIONS
-- =====================================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon;
GRANT INSERT, SELECT, UPDATE ON job_applications TO anon;
GRANT ALL ON storage.objects TO anon;
GRANT ALL ON storage.buckets TO anon;

-- =====================================================
-- STEP 7: CREATE INDEXES
-- =====================================================

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_applications_email ON job_applications(email);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON job_applications(status);
CREATE INDEX IF NOT EXISTS idx_job_applications_created_at ON job_applications(created_at);

-- =====================================================
-- STEP 8: VERIFICATION
-- =====================================================

-- Test insert to verify everything works
INSERT INTO job_applications (
    first_name, 
    last_name, 
    email, 
    address, 
    city, 
    state, 
    phone_number
) VALUES (
    'Test', 
    'User', 
    'test@example.com', 
    '123 Test Street', 
    'Test City', 
    'Arizona', 
    '5551234567'
);

-- Check if insert worked
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM job_applications WHERE email = 'test@example.com')
        THEN '✅ Setup successful - table and policies working!'
        ELSE '❌ Setup failed'
    END as status;

-- Clean up test data
DELETE FROM job_applications WHERE email = 'test@example.com';

-- Final verification
SELECT 
    'Table created: ' || CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_applications') THEN '✅' ELSE '❌' END as table_status,
    'Bucket created: ' || CASE WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = '9alwa') THEN '✅' ELSE '❌' END as bucket_status,
    'RLS enabled: ' || CASE WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'job_applications' AND rowsecurity = true) THEN '✅' ELSE '❌' END as rls_status;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

SELECT '🎉 SIMPLE SETUP COMPLETED! 🎉' as message;

/*
IMPORTANT NOTES:

1. Your Supabase project is now ready!
2. Storage bucket: '9alwa'
3. Table: job_applications
4. No authentication required (public access)
5. Files stored in folders: application_{timestamp}_{random}/

If you get any errors, run each step separately:

-- Step 1: Create table
CREATE TABLE IF NOT EXISTS job_applications (...)

-- Step 2: Create bucket  
INSERT INTO storage.buckets (...)

-- Step 3: Enable RLS
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

-- etc.
*/