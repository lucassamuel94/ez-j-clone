
CREATE OR REPLACE FUNCTION public.check_cnpj_duplicate(p_cnpj text, p_exclude_lead_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_clean_cnpj text;
  v_result json;
BEGIN
  v_clean_cnpj := regexp_replace(p_cnpj, '[^0-9]', '', 'g');
  
  IF length(v_clean_cnpj) < 14 THEN
    RETURN json_build_object('is_duplicate', false);
  END IF;

  SELECT json_build_object(
    'is_duplicate', true,
    'existing_lead_id', id::text,
    'existing_lead_name', name,
    'existing_lead_company', company
  ) INTO v_result
  FROM leads
  WHERE regexp_replace(COALESCE(cnpj, ''), '[^0-9]', '', 'g') = v_clean_cnpj
    AND (p_exclude_lead_id IS NULL OR id != p_exclude_lead_id)
  LIMIT 1;

  IF v_result IS NULL THEN
    RETURN json_build_object('is_duplicate', false);
  END IF;

  RETURN v_result;
END;
$$;
