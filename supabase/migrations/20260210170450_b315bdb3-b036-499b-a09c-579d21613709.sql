-- Create import_jobs table to track background import progress
CREATE TABLE public.import_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_rows INTEGER NOT NULL DEFAULT 0,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  mappings JSONB NOT NULL DEFAULT '[]',
  allocation_type TEXT NOT NULL DEFAULT 'importer',
  selected_sdr_id UUID,
  import_status TEXT NOT NULL DEFAULT 'Novo',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

-- Users can see their own import jobs; admins/managers can see all
CREATE POLICY "Users can view own import jobs"
ON public.import_jobs FOR SELECT
USING (auth.uid() = user_id OR public.is_manager(auth.uid()));

CREATE POLICY "Users can create own import jobs"
ON public.import_jobs FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow edge function (service role) to update any job
CREATE POLICY "Service role can update import jobs"
ON public.import_jobs FOR UPDATE
USING (true);

-- Create storage bucket for import files
INSERT INTO storage.buckets (id, name, public) VALUES ('imports', 'imports', false);

-- Users can upload their own import files
CREATE POLICY "Users can upload import files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'imports' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can read their own import files
CREATE POLICY "Users can read own import files"
ON storage.objects FOR SELECT
USING (bucket_id = 'imports' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Service role can read all import files (for edge function)
CREATE POLICY "Service role can read import files"
ON storage.objects FOR SELECT
USING (bucket_id = 'imports');

-- Allow deletion of processed files
CREATE POLICY "Users can delete own import files"
ON storage.objects FOR DELETE
USING (bucket_id = 'imports' AND auth.uid()::text = (storage.foldername(name))[1]);