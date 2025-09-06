/*
  # Update RLS policies with specific conditions

  1. Changes
    - Replace existing open RLS policies with more specific conditions
    - Add data validation checks for each table
    - Ensure public access is still maintained but with basic validation

  2. Security
    - Policies now check for required fields
    - Maintains public access but prevents empty/invalid data
*/

-- Update RLS policies for job_applications
DROP POLICY IF EXISTS "Allow public inserts" ON job_applications;
DROP POLICY IF EXISTS "Allow viewing own applications" ON job_applications;

CREATE POLICY "Allow inserts with data" ON job_applications
  FOR INSERT TO public
  WITH CHECK (
    first_name IS NOT NULL AND 
    last_name IS NOT NULL AND 
    address IS NOT NULL AND
    city IS NOT NULL AND
    state IS NOT NULL AND
    phone_number IS NOT NULL
  );

CREATE POLICY "Allow viewing applications" ON job_applications
  FOR SELECT TO public
  USING (true);

-- Update RLS policies for application_documents
DROP POLICY IF EXISTS "Allow public document inserts" ON application_documents;
DROP POLICY IF EXISTS "Allow viewing documents" ON application_documents;

CREATE POLICY "Allow document inserts with data" ON application_documents
  FOR INSERT TO public
  WITH CHECK (
    application_id IS NOT NULL AND 
    document_type IS NOT NULL AND
    file_url IS NOT NULL
  );

CREATE POLICY "Allow viewing all documents" ON application_documents
  FOR SELECT TO public
  USING (true);

-- Update RLS policies for application_videos
DROP POLICY IF EXISTS "Allow public video inserts" ON application_videos;
DROP POLICY IF EXISTS "Allow viewing videos" ON application_videos;

CREATE POLICY "Allow video inserts with data" ON application_videos
  FOR INSERT TO public
  WITH CHECK (
    application_id IS NOT NULL AND 
    video_url IS NOT NULL
  );

CREATE POLICY "Allow viewing all videos" ON application_videos
  FOR SELECT TO public
  USING (true);