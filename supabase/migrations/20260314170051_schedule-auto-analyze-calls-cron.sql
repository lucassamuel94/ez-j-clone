-- Agenda a edge function auto-analyze-calls para rodar diariamente às 21h BRT (00:00 UTC)
SELECT cron.unschedule('auto-analyze-calls-cron');

SELECT cron.schedule(
  'auto-analyze-calls-cron',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ftswdtgdvvewtaeoxpts.supabase.co/functions/v1/auto-analyze-calls',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0c3dkdGdkdnZld3RhZW94cHRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2Mzk2MDksImV4cCI6MjA4NTIxNTYwOX0.rk5Y3kjjv11PB4BjoKKDE0kMww3-Uw0WD1LN5DOD8QM"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
