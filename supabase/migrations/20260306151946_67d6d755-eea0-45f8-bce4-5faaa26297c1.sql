
-- Email Sequences
CREATE TABLE public.email_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read sequences" ON public.email_sequences
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins/managers can manage sequences" ON public.email_sequences
  FOR ALL TO authenticated USING (public.is_manager(auth.uid()));

-- Email Sequence Steps
CREATE TABLE public.email_sequence_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid REFERENCES public.email_sequences(id) ON DELETE CASCADE NOT NULL,
  step_number int NOT NULL,
  delay_hours int NOT NULL DEFAULT 24,
  subject text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sequence_id, step_number)
);

ALTER TABLE public.email_sequence_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read steps" ON public.email_sequence_steps
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins/managers can manage steps" ON public.email_sequence_steps
  FOR ALL TO authenticated USING (public.is_manager(auth.uid()));

-- Email Sequence Enrollments
CREATE TYPE public.enrollment_status AS ENUM ('active', 'completed', 'replied', 'unsubscribed');

CREATE TABLE public.email_sequence_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid REFERENCES public.email_sequences(id) ON DELETE CASCADE NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  current_step int NOT NULL DEFAULT 1,
  status public.enrollment_status NOT NULL DEFAULT 'active',
  next_send_at timestamptz,
  enrolled_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sequence_id, lead_id)
);

ALTER TABLE public.email_sequence_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read enrollments" ON public.email_sequence_enrollments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert enrollments" ON public.email_sequence_enrollments
  FOR INSERT TO authenticated WITH CHECK (enrolled_by = auth.uid());

CREATE POLICY "Admins/managers or enroller can update" ON public.email_sequence_enrollments
  FOR UPDATE TO authenticated USING (enrolled_by = auth.uid() OR public.is_manager(auth.uid()));

-- Email Sequence Logs
CREATE TABLE public.email_sequence_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid REFERENCES public.email_sequence_enrollments(id) ON DELETE CASCADE NOT NULL,
  step_id uuid REFERENCES public.email_sequence_steps(id) ON DELETE CASCADE NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  opened_at timestamptz,
  replied_at timestamptz,
  resend_message_id text
);

ALTER TABLE public.email_sequence_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read logs" ON public.email_sequence_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "System can insert logs" ON public.email_sequence_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- Auto-unenroll on lead discard
CREATE OR REPLACE FUNCTION public.auto_unenroll_on_lead_discard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status IN ('Descartado', 'Oportunidade criada') AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE email_sequence_enrollments
    SET status = 'unsubscribed', updated_at = now()
    WHERE lead_id = NEW.id AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_unenroll_lead
AFTER UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.auto_unenroll_on_lead_discard();
