
-- Create automatic_messages table
CREATE TABLE public.automatic_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'whatsapp',
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  trigger_key TEXT,
  sender TEXT,
  schedule_type TEXT DEFAULT 'tempo_real',
  schedule_time TEXT,
  schedule_day INTEGER,
  channels TEXT[] DEFAULT '{whatsapp}',
  target_type TEXT DEFAULT 'all',
  target_departments TEXT[],
  target_roles TEXT[],
  target_user_ids UUID[],
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.automatic_messages ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read
CREATE POLICY "Authenticated users can view automatic messages"
  ON public.automatic_messages FOR SELECT TO authenticated
  USING (true);

-- Admins/managers or users with permission can insert
CREATE POLICY "Managers can insert automatic messages"
  ON public.automatic_messages FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid()) OR public.is_manager(auth.uid()) OR public.has_permission(auth.uid(), 'manage_automatic_messages')
  );

-- Admins/managers or users with permission can update
CREATE POLICY "Managers can update automatic messages"
  ON public.automatic_messages FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid()) OR public.is_manager(auth.uid()) OR public.has_permission(auth.uid(), 'manage_automatic_messages')
  );

-- Admins/managers or users with permission can delete
CREATE POLICY "Managers can delete automatic messages"
  ON public.automatic_messages FOR DELETE TO authenticated
  USING (
    public.is_admin(auth.uid()) OR public.is_manager(auth.uid()) OR public.has_permission(auth.uid(), 'manage_automatic_messages')
  );

-- Updated_at trigger
CREATE TRIGGER update_automatic_messages_updated_at
  BEFORE UPDATE ON public.automatic_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add permission
INSERT INTO public.permissions (name, category, description)
VALUES ('manage_automatic_messages', 'management', 'Gerenciar Mensagens Automáticas')
ON CONFLICT DO NOTHING;
