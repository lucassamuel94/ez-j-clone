-- Add reminder_minutes_before column to meetings table
ALTER TABLE public.meetings 
ADD COLUMN reminder_minutes_before INTEGER DEFAULT 60;

-- Add comment for clarity
COMMENT ON COLUMN public.meetings.reminder_minutes_before IS 'Time in minutes before meeting to send reminder (30, 60, or 120)';