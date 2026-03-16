
-- Table to persist ICP chat messages per user
CREATE TABLE public.icp_chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast retrieval by user
CREATE INDEX idx_icp_chat_messages_user ON public.icp_chat_messages (user_id, created_at);

-- Enable RLS
ALTER TABLE public.icp_chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can only see their own messages
CREATE POLICY "Users can view own chat messages"
ON public.icp_chat_messages FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own messages
CREATE POLICY "Users can insert own chat messages"
ON public.icp_chat_messages FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own messages (to clear history)
CREATE POLICY "Users can delete own chat messages"
ON public.icp_chat_messages FOR DELETE
USING (auth.uid() = user_id);
