import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const GoogleCalendarCallbackPage = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    if (code && window.opener) {
      window.opener.postMessage(
        { type: 'google-calendar-oauth-callback', code },
        window.location.origin
      );
      window.close();
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Conectando ao Google Calendar...</p>
    </div>
  );
};

export default GoogleCalendarCallbackPage;
