
-- Create storage bucket for project attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('project-attachments', 'project-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for project attachments
CREATE POLICY "Authenticated users can upload project attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'project-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view project attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'project-attachments');

CREATE POLICY "Authenticated users can delete own project attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'project-attachments' AND auth.role() = 'authenticated');

-- Table to track project file metadata
CREATE TABLE public.project_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  content_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.project_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments of accessible projects"
ON public.project_attachments FOR SELECT
USING (EXISTS (
  SELECT 1 FROM projects p WHERE p.id = project_attachments.project_id
  AND (is_manager(auth.uid()) OR p.created_by_user_id = auth.uid() OR p.ux_po_user_id = auth.uid()
       OR p.dev_user_id = auth.uid() OR p.treinamento_user_id = auth.uid() OR p.head_user_id = auth.uid())
));

CREATE POLICY "Authenticated users can insert attachments"
ON public.project_attachments FOR INSERT
WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Uploaders can delete own attachments"
ON public.project_attachments FOR DELETE
USING (uploaded_by = auth.uid() OR is_manager(auth.uid()));
