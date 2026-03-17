
-- Update trigger to map Viewer and use safer default
CREATE OR REPLACE FUNCTION public.sync_role_enum_from_role_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  role_name text;
  mapped_enum public.app_role;
BEGIN
  IF NEW.role_id IS NOT NULL THEN
    SELECT name INTO role_name FROM public.roles WHERE id = NEW.role_id;

    IF role_name IS NOT NULL THEN
      mapped_enum := CASE role_name
        WHEN 'Administrador' THEN 'admin'
        WHEN 'Gerente' THEN 'manager'
        WHEN 'SDR' THEN 'sdr'
        WHEN 'Closer' THEN 'closer'
        WHEN 'Head Pós-Venda' THEN 'head_pos_venda'
        WHEN 'UX/PO' THEN 'ux_po'
        WHEN 'Dev Chatbot' THEN 'dev_chatbot'
        WHEN 'Treinamento' THEN 'treinamento'
        WHEN 'Suporte' THEN 'suporte'
        WHEN 'Verificação BM' THEN 'verificacao_bm'
        WHEN 'Viewer' THEN 'viewer'
        ELSE 'viewer'
      END;

      NEW.role := mapped_enum;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Fix existing records
UPDATE public.user_roles
SET role = 'viewer'
WHERE role_id IN (SELECT id FROM public.roles WHERE name = 'Viewer');
