
-- Fix storage upload policy for project-attachments: use auth.uid() IS NOT NULL instead of auth.role()
DROP POLICY IF EXISTS "Authenticated users can upload project attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload project attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'project-attachments' AND auth.uid() IS NOT NULL);

-- Also fix the DELETE policy to be consistent
DROP POLICY IF EXISTS "Authenticated users can delete own project attachments" ON storage.objects;
CREATE POLICY "Authenticated users can delete own project attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'project-attachments' AND auth.uid() IS NOT NULL);
