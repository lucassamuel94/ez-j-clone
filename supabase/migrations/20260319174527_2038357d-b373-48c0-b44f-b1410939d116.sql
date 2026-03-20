
-- Step 1: Add new columns to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS verificacao_bm_user_id uuid REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS go_live_user_id uuid REFERENCES profiles(id);

-- Step 2: Update get_least_loaded_users to include verificacao_bm and go_live (head_pos_venda) roles
CREATE OR REPLACE FUNCTION public.get_least_loaded_users()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  head_id text;
  role_rec record;
BEGIN
  SELECT value INTO head_id FROM system_config WHERE key = 'default_head_user_id';
  result := result || jsonb_build_object('head_user_id', head_id);

  FOR role_rec IN
    SELECT
      unnest(ARRAY['ux_po', 'dev_chatbot', 'treinamento', 'verificacao_bm', 'head_pos_venda']) AS role_name,
      unnest(ARRAY['ux_po_user_id', 'dev_user_id', 'treinamento_user_id', 'verificacao_bm_user_id', 'go_live_user_id']) AS field_name
  LOOP
    result := result || jsonb_build_object(
      role_rec.field_name,
      (
        SELECT ur.user_id
        FROM user_roles ur
        JOIN profiles p ON p.id = ur.user_id AND p.active = true
          AND (p.exclude_from_auto_assign IS FALSE)
        LEFT JOIN projects proj
          ON proj.archived = false
          AND CASE role_rec.field_name
            WHEN 'ux_po_user_id' THEN proj.ux_po_user_id = ur.user_id
            WHEN 'dev_user_id' THEN proj.dev_user_id = ur.user_id
            WHEN 'treinamento_user_id' THEN proj.treinamento_user_id = ur.user_id
            WHEN 'verificacao_bm_user_id' THEN proj.verificacao_bm_user_id = ur.user_id
            WHEN 'go_live_user_id' THEN proj.go_live_user_id = ur.user_id
          END
        WHERE ur.role = role_rec.role_name::app_role
        GROUP BY ur.user_id
        ORDER BY count(proj.id) ASC, ur.user_id ASC
        LIMIT 1
      )
    );
  END LOOP;

  RETURN result;
END;
$$;
