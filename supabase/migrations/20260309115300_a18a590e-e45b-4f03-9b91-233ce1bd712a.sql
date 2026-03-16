
-- Update is_project_member to include new roles
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('head_pos_venda', 'ux_po', 'dev_chatbot', 'treinamento', 'suporte', 'verificacao_bm')
  )
$function$;

-- Update sync_role_enum_from_role_id to handle new roles
CREATE OR REPLACE FUNCTION public.sync_role_enum_from_role_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _role_name text; _enum_value text;
BEGIN
  IF NEW.role_id IS NOT NULL THEN
    SELECT name INTO _role_name FROM roles WHERE id = NEW.role_id;
    _enum_value := CASE _role_name
      WHEN 'Administrador' THEN 'admin' WHEN 'Gerente' THEN 'manager'
      WHEN 'SDR' THEN 'sdr' WHEN 'Closer' THEN 'closer'
      WHEN 'Head Pós-Venda' THEN 'head_pos_venda' WHEN 'UX/PO' THEN 'ux_po'
      WHEN 'Dev Chatbot' THEN 'dev_chatbot' WHEN 'Treinamento' THEN 'treinamento'
      WHEN 'Suporte' THEN 'suporte' WHEN 'Verificação BM' THEN 'verificacao_bm'
      ELSE 'sdr' END;
    NEW.role := _enum_value::app_role;
  END IF;
  RETURN NEW;
END;
$function$;
