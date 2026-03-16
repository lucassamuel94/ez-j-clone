
-- Drop the existing insert policy
DROP POLICY "Managers can insert reassign jobs" ON public.bulk_reassign_jobs;

-- Create a new policy that allows managers AND lead owners (SDRs/Closers) to create reassign jobs
CREATE POLICY "Authenticated users can insert reassign jobs"
ON public.bulk_reassign_jobs
FOR INSERT
WITH CHECK (created_by = auth.uid());
