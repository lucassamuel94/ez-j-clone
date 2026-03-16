import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

const FormPreviewPage = () => {
  const [searchParams] = useSearchParams();
  const formId = searchParams.get('id');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!formId || !containerRef.current) return;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const scriptSrc = `${supabaseUrl}/functions/v1/lead-form-embed?id=${formId}`;

    const script = document.createElement('script');
    script.setAttribute('data-ez-form', '');
    script.src = scriptSrc;
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [formId]);

  if (!formId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <p className="text-muted-foreground">ID do formulário não informado.</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 bg-muted"
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div ref={containerRef} />
    </div>
  );
};

export default FormPreviewPage;
