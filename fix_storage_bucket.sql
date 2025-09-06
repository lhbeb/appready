-- =====================================================
-- STORAGE BUCKET FIX FOR JOB APPLICATION PROJECT
-- =====================================================
-- This script fixes the storage bucket issue
-- =====================================================

-- Check if bucket exists
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = '9alwa') 
        THEN '✅ 9alwa bucket already exists'
        ELSE '❌ 9alwa bucket missing - will create it'
    END as bucket_check;

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    '9alwa',
    '9alwa',
    false,
    104857600, -- 100MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'text/plain', 'video/webm', 'video/mp4', 'application/octet-stream']
) ON CONFLICT (id) DO NOTHING;

-- Verify bucket was created
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = '9alwa') 
        THEN '✅ 9alwa bucket created/verified successfully'
        ELSE '❌ 9alwa bucket creation failed'
    END as final_bucket_status;

-- Show bucket details
SELECT 
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
FROM storage.buckets 
WHERE id = '9alwa';