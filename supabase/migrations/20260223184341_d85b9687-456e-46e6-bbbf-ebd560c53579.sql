
-- Add documentation_files column (array of {type, name, url})
ALTER TABLE public.api_analysis_requests 
ADD COLUMN documentation_files jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Create storage bucket for API analysis attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('api-analysis-docs', 'api-analysis-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users can upload
CREATE POLICY "Authenticated users can upload api analysis docs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'api-analysis-docs' AND auth.uid() IS NOT NULL);

-- Authenticated users can view
CREATE POLICY "Authenticated users can view api analysis docs"
ON storage.objects FOR SELECT
USING (bucket_id = 'api-analysis-docs' AND auth.uid() IS NOT NULL);

-- Authenticated users can delete their own uploads
CREATE POLICY "Authenticated users can delete api analysis docs"
ON storage.objects FOR DELETE
USING (bucket_id = 'api-analysis-docs' AND auth.uid() IS NOT NULL);
