-- Add description column to project_integrations (already has 'notes' column but we add 'description' for integration function/purpose)
-- Note: the table already has a 'notes' column, but 'description' is semantically different (describes what the integration does)
-- Actually checking schema: notes column already exists. Let's just use that or check if description is needed.
-- The schema shows: integration_name, notes columns exist. We can repurpose 'notes' or add 'description'.
-- Since 'notes' exists but may have different purpose, let's skip adding a duplicate column and use 'notes' as the description field.
-- Actually, looking at the plan again, the table already has a 'notes' column. Let me just confirm and use it.
SELECT 1;
