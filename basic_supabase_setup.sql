-- =====================================================
-- BASIC SUPABASE SETUP FOR JOB APPLICATION PROJECT
-- =====================================================
-- This version avoids storage policy creation issues
-- Create table and bucket first, then add storage policies via Supabase Dashboard
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- STEP 1: CREATE TABLE ONLY
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
-- STEP 2: CREATE STORAGE BUCKET ONLY
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
-- STEP 3: ENABLE RLS ON TABLE ONLY
-- =====================================================

-- Enable RLS on job_applications table
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 4: CREATE TABLE POLICIES ONLY
-- =====================================================

-- Allow anyone to insert job applications
CREATE POLICY "public_insert_applications"
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
CREATE POLICY "public_select_applications"
    ON job_applications
    FOR SELECT
    TO public
    USING (true);

-- Allow updates
CREATE POLICY "public_update_applications"
    ON job_applications
    FOR UPDATE
    TO public
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- STEP 5: GRANT BASIC PERMISSIONS
-- =====================================================

-- Grant necessary permissions for the table
GRANT USAGE ON SCHEMA public TO anon;
GRANT INSERT, SELECT, UPDATE ON job_applications TO anon;

-- =====================================================
-- STEP 6: CREATE INDEXES
-- =====================================================

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_applications_email ON job_applications(email);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON job_applications(status);
CREATE INDEX IF NOT EXISTS idx_job_applications_created_at ON job_applications(created_at);

-- =====================================================
-- STEP 7: VERIFICATION
-- =====================================================

-- Test insert to verify table works
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
        THEN '✅ Table setup successful!'
        ELSE '❌ Table setup failed'
    END as table_status;

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

SELECT '🎉 BASIC SETUP COMPLETED! 🎉' as message;

-- =====================================================
-- IMPORTANT: MANUAL STORAGE POLICY SETUP REQUIRED
-- =====================================================

/*
⚠️  STORAGE POLICIES NEED TO BE CREATED MANUALLY ⚠️

Since you got permission errors, you need to create storage policies via the Supabase Dashboard:

1. Go to your Supabase Dashboard
2. Navigate to: Storage > Policies
3. Click "Add Policy" for the '9alwa' bucket
4. Create these 4 policies:

POLICY 1 - Upload Policy:
Name: Allow uploads to 9alwa
Operation: INSERT
Target roles: public
Policy definition:
bucket_id = '9alwa' AND (storage.foldername(name))[1] LIKE 'application_%'

POLICY 2 - Select Policy:
Name: Allow downloads from 9alwa  
Operation: SELECT
Target roles: public
Policy definition:
bucket_id = '9alwa'

POLICY 3 - Delete Policy:
Name: Allow deletes from 9alwa
Operation: DELETE  
Target roles: public
Policy definition:
bucket_id = '9alwa' AND (storage.foldername(name))[1] LIKE 'application_%'

POLICY 4 - Update Policy (optional):
Name: Allow updates to 9alwa
Operation: UPDATE
Target roles: public  
Policy definition:
bucket_id = '9alwa' AND (storage.foldername(name))[1] LIKE 'application_%'

After creating these policies manually, your app will work perfectly!

Alternative: Make the bucket PUBLIC temporarily:
1. Go to Storage > Settings
2. Make '9alwa' bucket public
3. This bypasses RLS but reduces security
*/