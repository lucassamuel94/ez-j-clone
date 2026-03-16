
-- Add gmail_message_id to sent_emails for deduplication
ALTER TABLE public.sent_emails ADD COLUMN IF NOT EXISTS gmail_message_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sent_emails_gmail_message_id ON public.sent_emails (gmail_message_id) WHERE gmail_message_id IS NOT NULL;

-- Add gmail sync tracking to google_calendar_tokens
ALTER TABLE public.google_calendar_tokens ADD COLUMN IF NOT EXISTS gmail_last_sync_at timestamptz;
