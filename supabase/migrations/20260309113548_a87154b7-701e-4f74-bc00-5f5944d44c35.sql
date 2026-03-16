-- Fix projects where current_phase is out of sync with the latest phase
UPDATE projects p
SET current_phase = (
  SELECT pp.phase_name
  FROM project_phases pp
  WHERE pp.project_id = p.id
  ORDER BY pp.sort_order DESC
  LIMIT 1
)
WHERE p.id IN ('e58e3034-d3ad-45f1-81f4-8554bdcd86a1', '0a174cbf-3dfe-4ecd-8eed-c710a069d6f5')
AND p.deleted_at IS NULL;