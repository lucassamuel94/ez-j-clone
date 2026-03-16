SELECT cron.unschedule('check-overdue-tasks-cron');

SELECT cron.schedule(
  'check-overdue-tasks-cron',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ftswdtgdvvewtaeoxpts.supabase.co/functions/v1/check-overdue-tasks',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0c3dkdGdkdnZld3RhZW94cHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2Mzk2MDksImV4cCI6MjA4NTIxNTYwOX0.rk5Y3kjjv11PB4BjoKKDE0kMww3-Uw0WD1LN5DOD8QM"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);