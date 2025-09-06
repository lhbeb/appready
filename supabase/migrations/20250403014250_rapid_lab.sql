/*
  # Job Applications Schema

  1. New Tables
    - `job_applications`
      - Basic information about the applicant
      - References to uploaded documents and video
    - `application_documents`
      - Stores document metadata and URLs
    - `application_videos`
      - Stores video capture metadata and URLs

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create job applications table
CREATE TABLE IF NOT EXISTS job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  first_name text NOT NULL,
  last_name text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  phone_number text NOT NULL,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create documents table
CREATE TABLE IF NOT EXISTS application_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES job_applications(id),
  document_type text NOT NULL,
  file_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create videos table
CREATE TABLE IF NOT EXISTS application_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES job_applications(id),
  video_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_videos ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can insert their own applications"
  ON job_applications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own applications"
  ON job_applications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own documents"
  ON application_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM job_applications
    WHERE id = application_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can view their own documents"
  ON application_documents
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM job_applications
    WHERE id = application_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own videos"
  ON application_videos
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM job_applications
    WHERE id = application_id AND user_id = auth.uid()
  ));

CREATE POLICY "Users can view their own videos"
  ON application_videos
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM job_applications
    WHERE id = application_id AND user_id = auth.uid()
  ));