
-- Trigger function to notify when call analysis is completed
CREATE OR REPLACE FUNCTION public.notify_call_analysis_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      NEW.uploaded_by,
      'Análise de ligação concluída',
      'A análise da ligação foi finalizada com score ' || COALESCE(NEW.call_score::text, '—') || '. Clique para ver os detalhes.',
      'call_analysis',
      '/admin?tab=call-intelligence'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_call_analysis_completed
AFTER UPDATE ON public.call_analyses
FOR EACH ROW
EXECUTE FUNCTION public.notify_call_analysis_completed();
