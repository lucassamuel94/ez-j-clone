
-- 1. Tarefa atribuída → notificar assigned_user_id
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.assigned_user_id IS NOT NULL
     AND NEW.assigned_user_id IS DISTINCT FROM COALESCE(NEW.created_by_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
     AND (TG_OP = 'INSERT' OR OLD.assigned_user_id IS DISTINCT FROM NEW.assigned_user_id)
  THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      NEW.assigned_user_id,
      'Nova tarefa atribuída',
      'Você recebeu a tarefa "' || COALESCE(NEW.title, 'Sem título') || '".',
      'task_assigned',
      CASE 
        WHEN NEW.project_id IS NOT NULL THEN '/projects?project=' || NEW.project_id::text
        ELSE '/tasks'
      END
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_task_assigned ON project_tasks;
CREATE TRIGGER trg_notify_task_assigned
  AFTER INSERT OR UPDATE OF assigned_user_id ON project_tasks
  FOR EACH ROW EXECUTE FUNCTION notify_task_assigned();

-- 2. Tarefa concluída → notificar quem criou
CREATE OR REPLACE FUNCTION public.notify_task_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'concluída' AND OLD.status IS DISTINCT FROM 'concluída' THEN
    IF NEW.created_by_user_id IS NOT NULL 
       AND NEW.created_by_user_id IS DISTINCT FROM NEW.assigned_user_id
    THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        NEW.created_by_user_id,
        'Tarefa concluída',
        'A tarefa "' || COALESCE(NEW.title, 'Sem título') || '" foi concluída.',
        'task_completed',
        CASE 
          WHEN NEW.project_id IS NOT NULL THEN '/projects?project=' || NEW.project_id::text
          ELSE '/tasks'
        END
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_task_completed ON project_tasks;
CREATE TRIGGER trg_notify_task_completed
  AFTER UPDATE OF status ON project_tasks
  FOR EACH ROW EXECUTE FUNCTION notify_task_completed();

-- 3. Oportunidade ganha → notificar SDR
CREATE OR REPLACE FUNCTION public.notify_opportunity_won()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead_name text;
  v_lead_company text;
BEGIN
  IF NEW.stage = 'Ganho' AND OLD.stage IS DISTINCT FROM 'Ganho' THEN
    SELECT name, COALESCE(razao_social, nome_fantasia, company)
    INTO v_lead_name, v_lead_company
    FROM leads WHERE id = NEW.lead_id;

    IF NEW.sdr_user_id IS NOT NULL 
       AND NEW.sdr_user_id IS DISTINCT FROM NEW.assigned_to_user_id
    THEN
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        NEW.sdr_user_id,
        '🎉 Venda fechada!',
        'A oportunidade de "' || COALESCE(v_lead_company, v_lead_name, 'Lead') || '" foi ganha! Valor: R$ ' || COALESCE(NEW.deal_value::text, '—'),
        'opportunity_won',
        '/closer-pipeline?lead=' || COALESCE(NEW.lead_id::text, NEW.id::text)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_opportunity_won ON opportunities;
CREATE TRIGGER trg_notify_opportunity_won
  AFTER UPDATE OF stage ON opportunities
  FOR EACH ROW EXECUTE FUNCTION notify_opportunity_won();

-- 4. Lead devolvido pelo Closer → notificar SDR
CREATE OR REPLACE FUNCTION public.notify_lead_returned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'Devolvido pelo Closer' 
     AND OLD.status IS DISTINCT FROM 'Devolvido pelo Closer'
     AND NEW.owner_user_id IS NOT NULL
  THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      NEW.owner_user_id,
      'Lead devolvido pelo Closer',
      'O lead "' || COALESCE(NEW.name, NEW.company, 'Sem nome') || '" foi devolvido e precisa de ação.',
      'lead_returned',
      '/leads?lead=' || NEW.id::text
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_lead_returned ON leads;
CREATE TRIGGER trg_notify_lead_returned
  AFTER UPDATE OF status ON leads
  FOR EACH ROW EXECUTE FUNCTION notify_lead_returned();
