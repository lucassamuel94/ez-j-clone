
-- Function to recalculate leads.next_action_at from open tasks
CREATE OR REPLACE FUNCTION sync_lead_next_action_from_tasks(p_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_earliest_due timestamptz;
  v_current_next timestamptz;
BEGIN
  IF p_lead_id IS NULL THEN RETURN; END IF;

  -- Find earliest due_date among open tasks linked to this lead (directly or via opportunity)
  SELECT MIN(pt.due_date)
  INTO v_earliest_due
  FROM project_tasks pt
  WHERE pt.status = 'pendente'
    AND pt.due_date IS NOT NULL
    AND pt.due_date > now()
    AND (
      pt.lead_id = p_lead_id
      OR pt.opportunity_id IN (SELECT id FROM opportunities WHERE lead_id = p_lead_id)
    );

  IF v_earliest_due IS NULL THEN RETURN; END IF;

  SELECT next_action_at INTO v_current_next FROM leads WHERE id = p_lead_id;

  -- Update if: no current date, new is earlier, or current is overdue and new is future
  IF v_current_next IS NULL
     OR v_earliest_due < v_current_next
     OR (v_current_next < now() AND v_earliest_due >= now())
  THEN
    UPDATE leads SET next_action_at = v_earliest_due WHERE id = p_lead_id;
  END IF;
END;
$$;

-- Trigger function on project_tasks
CREATE OR REPLACE FUNCTION trg_sync_project_tasks_to_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lead_id uuid;
BEGIN
  -- Handle DELETE or UPDATE (old row)
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    v_lead_id := OLD.lead_id;
    IF v_lead_id IS NULL AND OLD.opportunity_id IS NOT NULL THEN
      SELECT lead_id INTO v_lead_id FROM opportunities WHERE id = OLD.opportunity_id;
    END IF;
    IF v_lead_id IS NOT NULL THEN
      PERFORM sync_lead_next_action_from_tasks(v_lead_id);
    END IF;
  END IF;

  -- Handle INSERT or UPDATE (new row)
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    v_lead_id := NEW.lead_id;
    IF v_lead_id IS NULL AND NEW.opportunity_id IS NOT NULL THEN
      SELECT lead_id INTO v_lead_id FROM opportunities WHERE id = NEW.opportunity_id;
    END IF;
    IF v_lead_id IS NOT NULL THEN
      PERFORM sync_lead_next_action_from_tasks(v_lead_id);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_sync_project_tasks_to_lead ON project_tasks;
CREATE TRIGGER trg_sync_project_tasks_to_lead
  AFTER INSERT OR UPDATE OR DELETE ON project_tasks
  FOR EACH ROW
  EXECUTE FUNCTION trg_sync_project_tasks_to_lead();

-- Backfill: fix leads with overdue next_action_at but open future tasks
UPDATE leads l
SET next_action_at = sub.earliest_due
FROM (
  SELECT
    l2.id AS lead_id,
    MIN(pt.due_date) AS earliest_due
  FROM leads l2
  JOIN (
    SELECT lead_id, due_date, status FROM project_tasks WHERE lead_id IS NOT NULL
    UNION ALL
    SELECT o.lead_id, pt2.due_date, pt2.status
    FROM project_tasks pt2
    JOIN opportunities o ON o.id = pt2.opportunity_id
    WHERE pt2.lead_id IS NULL AND pt2.opportunity_id IS NOT NULL
  ) pt ON pt.lead_id = l2.id
  WHERE l2.next_action_at < now()
    AND pt.status = 'pendente'
    AND pt.due_date > now()
  GROUP BY l2.id
) sub
WHERE l.id = sub.lead_id;
