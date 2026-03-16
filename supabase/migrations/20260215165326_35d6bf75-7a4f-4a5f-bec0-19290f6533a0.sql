-- Allow authenticated users to update accepted_at on their own invitation (matching email)
CREATE POLICY "Users can accept their own invitation"
ON public.user_invitations
FOR UPDATE
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
)
WITH CHECK (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);