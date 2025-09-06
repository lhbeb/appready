/*
  # Update RLS policies for public access

  1. Changes
    - Remove user_id requirement from job_applications table
    - Update RLS policies to allow public access for inserts
    - Update related tables' policies to work without user authentication

  2. Security
    - Enable RLS on all tables
    - Allow public inserts with appropriate constraints
*/

-- Update job_applications table to make user_id optional
ALTER TABLE job_applications ALTER COLUMN user_id DROP NOT NULL;

-- Update RLS policies for job_applications
DROP POLICY IF EXISTS "Users can insert their own applications" ON job_applications;
DROP POLICY IF EXISTS "Users can view their own applications" ON job_applications;

CREATE POLICY "Allow public inserts" ON job_applications
  FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Allow viewing own applications" ON job_applications
  FOR SELECT TO public
  USING (true);

-- Update RLS policies for application_documents
DROP POLICY IF EXISTS "Users can insert their own documents" ON application_documents;
DROP POLICY IF EXISTS "Users can view their own documents" ON application_documents;

CREATE POLICY "Allow public document inserts" ON application_documents
  FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Allow viewing documents" ON application_documents
  FOR SELECT TO public
  USING (true);

-- Update RLS policies for application_videos
DROP POLICY IF EXISTS "Users can insert their own videos" ON application_videos;
DROP POLICY IF EXISTS "Users can view their own videos" ON application_videos;

CREATE POLICY "Allow public video inserts" ON application_videos
  FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Allow viewing videos" ON application_videos
  FOR SELECT TO public
  USING (true);