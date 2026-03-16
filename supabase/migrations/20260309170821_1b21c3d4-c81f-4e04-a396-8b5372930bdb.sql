
-- Allow authenticated users to upload call recordings to their own folder
CREATE POLICY "Users can upload own call recordings"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'call-recordings'
  AND auth.uid() IS NOT NULL
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to view their own call recordings
CREATE POLICY "Users can view own call recordings"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'call-recordings'
  AND auth.uid() IS NOT NULL
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
