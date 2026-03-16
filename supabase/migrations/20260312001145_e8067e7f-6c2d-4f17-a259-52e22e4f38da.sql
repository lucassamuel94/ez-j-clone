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
      unnest(ARRAY['ux_po', 'dev_chatbot', 'treinamento']) AS role_name,
      unnest(ARRAY['ux_po_user_id', 'dev_user_id', 'treinamento_user_id']) AS field_name
  LOOP
    result := result || jsonb_build_object(
      role_rec.field_name,
      (
        SELECT ur.user_id
        FROM user_roles ur
        JOIN profiles p ON p.id = ur.user_id AND p.active = true
        LEFT JOIN projects proj
          ON proj.archived = false
          AND CASE role_rec.field_name
            WHEN 'ux_po_user_id' THEN proj.ux_po_user_id = ur.user_id
            WHEN 'dev_user_id' THEN proj.dev_user_id = ur.user_id
            WHEN 'treinamento_user_id' THEN proj.treinamento_user_id = ur.user_id
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