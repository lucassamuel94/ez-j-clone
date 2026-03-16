
-- Table to store Google Calendar OAuth tokens per user
CREATE TABLE public.google_calendar_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only access their own tokens
CREATE POLICY "Users can view own tokens"
  ON public.google_calendar_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens"
  ON public.google_calendar_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens"
  ON public.google_calendar_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens"
  ON public.google_calendar_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_google_calendar_tokens_updated_at
  BEFORE UPDATE ON public.google_calendar_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
