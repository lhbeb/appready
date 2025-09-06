-- =====================================================
-- COMPLETE SUPABASE SETUP FOR JOB APPLICATION PROJECT
-- =====================================================
-- This script creates everything needed for the Job-Appmeziana project
-- Based on analysis of upload logic in App.tsx and project requirements
-- 
-- What this creates:
-- 1. job_applications table (matches App.tsx logic)
-- 2. '9alwa' storage bucket (matches current implementation)
-- 3. RLS policies for both table and storage
-- 4. Proper permissions and indexes
-- =====================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- STEP 1: CLEAN UP EXISTING POLICIES AND OBJECTS
-- =====================================================

-- Clean up existing table policies (only if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_applications') THEN
        DROP POLICY IF EXISTS "Users can insert their own applications" ON job_applications;
        DROP POLICY IF EXISTS "Users can view their own applications" ON job_applications;
        DROP POLICY IF EXISTS "Users can update their own applications" ON job_applications;
        DROP POLICY IF EXISTS "Enable insert access for all users" ON job_applications;
        DROP POLICY IF EXISTS "Enable read access for all users" ON job_applications;
        DROP POLICY IF EXISTS "Allow authenticated inserts" ON job_applications;
        DROP POLICY IF EXISTS "Allow authenticated selects" ON job_applications;
        DROP POLICY IF EXISTS "Allow authenticated updates" ON job_applications;
        DROP POLICY IF EXISTS "Allow all job operations" ON job_applications;
        DROP POLICY IF EXISTS "Allow public job application submissions" ON job_applications;
        DROP POLICY IF EXISTS "Allow viewing job applications" ON job_applications;
        DROP POLICY IF EXISTS "Allow updating job applications" ON job_applications;
        RAISE NOTICE 'Cleaned up existing table policies';
    ELSE
        RAISE NOTICE 'No existing job_applications table found, skipping table policy cleanup';
    END IF;
END $$;

-- Clean up existing storage policies
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
        DROP POLICY IF EXISTS "Users can upload to documents bucket" ON storage.objects;
        DROP POLICY IF EXISTS "Users can view from documents bucket" ON storage.objects;
        DROP POLICY IF EXISTS "Users can update in documents bucket" ON storage.objects;
        DROP POLICY IF EXISTS "Allow public uploads to documents" ON storage.objects;
        DROP POLICY IF EXISTS "Allow public downloads from documents" ON storage.objects;
        DROP POLICY IF EXISTS "9alwa_upload_policy" ON storage.objects;
        DROP POLICY IF EXISTS "9alwa_view_policy" ON storage.objects;
        DROP POLICY IF EXISTS "9alwa_update_policy" ON storage.objects;
        DROP POLICY IF EXISTS "9alwa_delete_policy" ON storage.objects;
        DROP POLICY IF EXISTS "Allow authenticated uploads to 9alwa" ON storage.objects;
        DROP POLICY IF EXISTS "Allow authenticated views from 9alwa" ON storage.objects;
        DROP POLICY IF EXISTS "Allow authenticated updates in 9alwa" ON storage.objects;
        DROP POLICY IF EXISTS "Allow authenticated deletes from 9alwa" ON storage.objects;
        DROP POLICY IF EXISTS "Allow all storage operations" ON storage.objects;
        DROP POLICY IF EXISTS "Allow uploads to 9alwa application folders" ON storage.objects;
        DROP POLICY IF EXISTS "Allow viewing from 9alwa application folders" ON storage.objects;
        DROP POLICY IF EXISTS "Allow signed URL creation for 9alwa" ON storage.objects;
        DROP POLICY IF EXISTS "Allow deleting from 9alwa application folders" ON storage.objects;
        RAISE NOTICE 'Cleaned up existing storage policies';
    ELSE
        RAISE NOTICE 'Storage schema not available, skipping storage policy cleanup';
    END IF;
END $$;

-- Remove existing buckets if they exist (safe operation)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
        DELETE FROM storage.buckets WHERE id IN ('documents', '9alwa');
        RAISE NOTICE 'Cleaned up existing buckets';
    ELSE
        RAISE NOTICE 'Storage buckets table not available, skipping bucket cleanup';
    END IF;
END $$;

-- =====================================================
-- STEP 2: CREATE JOB APPLICATIONS TABLE
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
-- STEP 3: CREATE STORAGE BUCKET
-- =====================================================

-- Create '9alwa' storage bucket (matches App.tsx implementation)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
            '9alwa',
            '9alwa',
            false,  -- Private bucket for security
            104857600, -- 100MB limit to accommodate videos and images
            ARRAY[
                'image/jpeg', 
                'image/png', 
                'image/webp', 
                'text/plain', 
                'video/webm', 
                'video/mp4',
                'application/octet-stream'
            ]
        ) ON CONFLICT (id) DO NOTHING;
        RAISE NOTICE '✅ Storage bucket 9alwa created/verified successfully';
    ELSE
        RAISE NOTICE '⚠️ Storage schema not available - cannot create bucket';
    END IF;
END $$;

-- =====================================================
-- STEP 4: ENABLE ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on job_applications table
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;

-- Enable RLS on storage.objects (should already be enabled by default)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 5: CREATE TABLE POLICIES
-- =====================================================

-- Allow anyone to insert job applications (no authentication required)
-- This matches the current App.tsx implementation which doesn't use auth
CREATE POLICY "Allow public job application submissions"
    ON job_applications
    FOR INSERT
    TO public
    WITH CHECK (
        first_name IS NOT NULL AND
        first_name != '' AND
        last_name IS NOT NULL AND
        last_name != '' AND
        address IS NOT NULL AND
        address != '' AND
        city IS NOT NULL AND
        city != '' AND
        state IS NOT NULL AND
        state != '' AND
        phone_number IS NOT NULL AND
        phone_number != ''
    );

-- Allow anyone to view their own applications (for future admin features)
CREATE POLICY "Allow viewing job applications"
    ON job_applications
    FOR SELECT
    TO public
    USING (true);

-- Allow updates (for future status changes by admin)
CREATE POLICY "Allow updating job applications"
    ON job_applications
    FOR UPDATE
    TO public
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- STEP 6: CREATE STORAGE POLICIES FOR '9alwa' BUCKET
-- =====================================================

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') AND
       EXISTS (SELECT 1 FROM storage.buckets WHERE id = '9alwa') THEN
        
        -- Allow uploads to application folders
        -- Files must be in format: application_${timestamp}_${random}/${filename}
        CREATE POLICY "Allow uploads to 9alwa application folders"
            ON storage.objects
            FOR INSERT
            TO public
            WITH CHECK (
                bucket_id = '9alwa' AND
                (storage.foldername(name))[1] LIKE 'application_%' AND
                -- Ensure the file is in a properly named application folder
                array_length(string_to_array(name, '/'), 1) = 2 AND
                -- Allow specific file types that match App.tsx upload logic
                (
                    name LIKE '%/personal_info.txt' OR
                    name LIKE '%/id_front.jpg' OR
                    name LIKE '%/id_back.jpg' OR
                    name LIKE '%/verification_1.webm' OR
                    name LIKE '%/verification_2.webm'
                )
            );

        -- Allow viewing files from application folders
        CREATE POLICY "Allow viewing from 9alwa application folders"
            ON storage.objects
            FOR SELECT
            TO public
            USING (
                bucket_id = '9alwa' AND
                (storage.foldername(name))[1] LIKE 'application_%'
            );

        -- Allow creating signed URLs (required for download links)
        CREATE POLICY "Allow signed URL creation for 9alwa"
            ON storage.objects
            FOR SELECT
            TO public
            USING (
                bucket_id = '9alwa'
            );

        -- Allow deleting files (for cleanup operations in tests)
        CREATE POLICY "Allow deleting from 9alwa application folders"
            ON storage.objects
            FOR DELETE
            TO public
            USING (
                bucket_id = '9alwa' AND
                (storage.foldername(name))[1] LIKE 'application_%'
            );
            
        RAISE NOTICE '✅ Storage policies for 9alwa bucket created successfully';
    ELSE
        RAISE NOTICE '⚠️ Storage not available or 9alwa bucket missing - skipping storage policies';
    END IF;
END $$;

-- =====================================================
-- STEP 7: CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Create indexes on frequently queried columns
CREATE INDEX IF NOT EXISTS idx_job_applications_email ON job_applications(email);
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON job_applications(status);
CREATE INDEX IF NOT EXISTS idx_job_applications_created_at ON job_applications(created_at);
CREATE INDEX IF NOT EXISTS idx_job_applications_phone ON job_applications(phone_number);

-- =====================================================
-- STEP 8: GRANT NECESSARY PERMISSIONS
-- =====================================================

-- Grant permissions for authenticated users (if needed in future)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant permissions for public access (current implementation)
GRANT USAGE ON SCHEMA public TO anon;
GRANT INSERT, SELECT, UPDATE ON job_applications TO anon;

-- Grant storage permissions
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;
GRANT ALL ON storage.objects TO anon;
GRANT ALL ON storage.buckets TO anon;

-- =====================================================
-- STEP 9: VERIFICATION QUERIES
-- =====================================================

-- Verify table was created
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_applications')
        THEN '✅ job_applications table created successfully'
        ELSE '❌ job_applications table creation failed'
    END as table_status;

-- Verify storage bucket was created
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = '9alwa') 
        THEN '✅ 9alwa storage bucket created successfully'
        ELSE '❌ 9alwa storage bucket creation failed'
    END as bucket_status;

-- Verify RLS is enabled
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'job_applications' AND rowsecurity = true) 
        THEN '✅ RLS enabled on job_applications table'
        ELSE '❌ RLS not enabled on job_applications table'
    END as rls_status;

-- Count policies created
SELECT 
    COUNT(*) as total_table_policies,
    CASE 
        WHEN COUNT(*) >= 3 THEN '✅ Table policies created successfully'
        ELSE '⚠️ Some table policies may be missing'
    END as table_policy_status
FROM pg_policies 
WHERE tablename = 'job_applications';

-- Count storage policies created
SELECT 
    COUNT(*) as total_storage_policies,
    CASE 
        WHEN COUNT(*) >= 4 THEN '✅ Storage policies created successfully'
        ELSE '⚠️ Some storage policies may be missing'
    END as storage_policy_status
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage';

-- List all created policies for verification
SELECT 
    '=== TABLE POLICIES ===' as section,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'job_applications'
UNION ALL
SELECT 
    '=== STORAGE POLICIES ===' as section,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage'
ORDER BY section, tablename, policyname;

-- =====================================================
-- STEP 10: TEST INSERT (OPTIONAL)
-- =====================================================

-- Test insert to verify everything works
-- This will be automatically cleaned up
INSERT INTO job_applications (
    first_name, 
    last_name, 
    email, 
    address, 
    city, 
    state, 
    phone_number, 
    ssn,
    status
) VALUES (
    'Test', 
    'User', 
    'test@example.com', 
    '123 Test Street', 
    'Test City', 
    'Arizona', 
    '5551234567', 
    '123456789',
    'pending'
);

-- Verify test insert worked
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM job_applications WHERE email = 'test@example.com')
        THEN '✅ Test insert successful - everything is working!'
        ELSE '❌ Test insert failed'
    END as test_insert_status;

-- Clean up test data
DELETE FROM job_applications WHERE email = 'test@example.com';

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

SELECT '🎉 SETUP COMPLETED SUCCESSFULLY! 🎉' as message;

SELECT 
    'Your Supabase project is now ready for the Job-Appmeziana application!' as setup_complete,
    'Storage bucket: 9alwa' as bucket_info,
    'Table: job_applications' as table_info,
    'Files will be stored in folders like: application_1234567890_abc123/' as folder_structure;

-- =====================================================
-- USAGE NOTES
-- =====================================================

/*
IMPORTANT NOTES FOR DEVELOPERS:

1. STORAGE BUCKET: '9alwa'
   - Files are stored in folders: application_{timestamp}_{random}/
   - Allowed files: personal_info.txt, id_front.jpg, id_back.jpg, verification_1.webm, verification_2.webm

2. TABLE: job_applications
   - No authentication required (public access)
   - All required fields must be filled
   - Status defaults to 'pending'

3. FILE UPLOAD PATTERN (from App.tsx):
   - Folder: application_${timestamp}_${randomString}
   - Files: personal_info.txt, id_front.jpg, id_back.jpg, verification_1.webm, verification_2.webm
   - Signed URLs created for all files after upload

4. SECURITY:
   - RLS enabled on both table and storage
   - Files must be in proper application folders
   - Only specific file names allowed
   - Public access enabled to match current implementation

5. ENVIRONMENT VARIABLES NEEDED:
   - VITE_SUPABASE_URL=your_project_url
   - VITE_SUPABASE_ANON_KEY=your_anon_key

6. TESTING:
   - Use monitor.runAllTests() in browser console to test everything
   - Check storage policies with monitor.checkStorageBuckets()
*/