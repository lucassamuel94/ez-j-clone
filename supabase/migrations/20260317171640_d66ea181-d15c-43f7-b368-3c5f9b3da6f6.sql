
CREATE OR REPLACE FUNCTION public.get_lead_by_id(p_lead_id uuid)
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT row_to_json(r) FROM (
    SELECT l.*, p.name AS owner_name
    FROM leads l
    LEFT JOIN profiles p ON p.id = l.owner_user_id
    WHERE l.id = p_lead_id
  ) r;
$$;
