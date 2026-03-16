
-- 1. Opportunities: Closer pode excluir oportunidade atribuída a ele
CREATE POLICY "Closers can delete assigned opportunities"
ON opportunities FOR DELETE TO authenticated
USING (assigned_to_user_id = auth.uid());

-- 2. FK constraints: trocar NO ACTION para SET NULL
ALTER TABLE ai_usage_logs DROP CONSTRAINT ai_usage_logs_lead_id_fkey,
  ADD CONSTRAINT ai_usage_logs_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;

ALTER TABLE projects DROP CONSTRAINT projects_lead_id_fkey,
  ADD CONSTRAINT projects_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;

ALTER TABLE call_analyses DROP CONSTRAINT call_analyses_lead_id_fkey,
  ADD CONSTRAINT call_analyses_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;

-- 3. lead_notes UPDATE: permitir closers editarem suas próprias notas
DROP POLICY IF EXISTS "Lead owners can update notes" ON lead_notes;
CREATE POLICY "Users can update own notes on accessible leads"
ON lead_notes FOR UPDATE TO authenticated
USING (
  user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM leads
    WHERE leads.id = lead_notes.lead_id
    AND (
      is_manager(auth.uid())
      OR leads.owner_user_id = auth.uid()
      OR leads.owner_user_id IS NULL
      OR EXISTS (
        SELECT 1 FROM opportunities
        WHERE opportunities.lead_id = leads.id
        AND opportunities.assigned_to_user_id = auth.uid()
      )
    )
  )
);
