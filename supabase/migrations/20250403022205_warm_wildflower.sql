/*
  # Update RLS policies for storage and applications

  1. Changes
    - Add storage policies for the documents bucket
    - Update job applications policies to allow public access
    - Remove user authentication requirement

  2. Security
    - Allow public access to upload files
    - Maintain basic data validation
*/

-- Update job_applications policies to allow public access
DROP POLICY IF EXISTS "Allow inserts with data" ON job_applications;
DROP POLICY IF EXISTS "Allow viewing applications" ON job_applications;

CREATE POLICY "Enable insert access for all users"
  ON job_applications FOR INSERT
  TO public
  WITH CHECK (
    first_name IS NOT NULL AND
    last_name IS NOT NULL AND
    address IS NOT NULL AND
    city IS NOT NULL AND
    state IS NOT NULL AND
    phone_number IS NOT NULL
  );

CREATE POLICY "Enable read access for all users"
  ON job_applications FOR SELECT
  TO public
  USING (true);

-- Create storage policies for the documents bucket
BEGIN;
  -- Drop existing policies if any
  DROP POLICY IF EXISTS "Give users access to own folder" ON storage.objects;
  DROP POLICY IF EXISTS "Enable read access to all users" ON storage.objects;

  -- Allow public uploads to the documents bucket
  CREATE POLICY "Allow public uploads to documents"
    ON storage.objects FOR INSERT
    TO public
    WITH CHECK (
      bucket_id = 'documents' AND
      (ARRAY_LENGTH(REGEXP_SPLIT_TO_ARRAY(name, '/'), 1) = 2)
    );

  -- Allow public downloads from the documents bucket
  CREATE POLICY "Allow public downloads from documents"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'documents');
COMMIT;