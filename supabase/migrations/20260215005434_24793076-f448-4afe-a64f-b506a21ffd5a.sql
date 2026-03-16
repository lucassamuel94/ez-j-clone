
-- Create storage bucket for email attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('email-attachments', 'email-attachments', false);

-- Users can upload their own attachments
CREATE POLICY "Users can upload email attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'email-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can view their own attachments
CREATE POLICY "Users can view own email attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'email-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete their own attachments
CREATE POLICY "Users can delete own email attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'email-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
