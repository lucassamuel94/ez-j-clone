
-- Table for form configurations
CREATE TABLE public.forms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  fields TEXT[] NOT NULL DEFAULT ARRAY['name', 'email', 'phone', 'company'],
  title TEXT NOT NULL DEFAULT 'Entre em contato',
  subtitle TEXT NOT NULL DEFAULT 'Preencha o formulário e entraremos em contato em breve.',
  button_text TEXT NOT NULL DEFAULT 'Enviar',
  success_message TEXT NOT NULL DEFAULT 'Obrigado! Entraremos em contato em breve.',
  source TEXT NOT NULL DEFAULT 'Formulário Web',
  primary_color TEXT NOT NULL DEFAULT '#7c3aed',
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view all forms" ON public.forms FOR SELECT USING (is_manager(auth.uid()));
CREATE POLICY "Managers can create forms" ON public.forms FOR INSERT WITH CHECK (is_manager(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Managers can update forms" ON public.forms FOR UPDATE USING (is_manager(auth.uid()));
CREATE POLICY "Managers can delete forms" ON public.forms FOR DELETE USING (is_manager(auth.uid()));

-- Table for form submissions
CREATE TABLE public.form_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  source TEXT,
  ip_address TEXT,
  user_agent TEXT,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view all submissions" ON public.form_submissions FOR SELECT USING (is_manager(auth.uid()));
CREATE POLICY "Anyone can insert submissions" ON public.form_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Managers can delete submissions" ON public.form_submissions FOR DELETE USING (is_manager(auth.uid()));

CREATE TRIGGER update_forms_updated_at
BEFORE UPDATE ON public.forms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
