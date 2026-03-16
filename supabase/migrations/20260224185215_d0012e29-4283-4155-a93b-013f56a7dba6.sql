
-- Create storage bucket for lead note attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('lead-attachments', 'lead-attachments', false);

-- RLS policies for lead-attachments bucket
CREATE POLICY "Authenticated users can upload lead attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'lead-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can view lead attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'lead-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete own lead attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'lead-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add attachments column to lead_notes table
ALTER TABLE public.lead_notes ADD COLUMN attachments jsonb DEFAULT '[]'::jsonb;
