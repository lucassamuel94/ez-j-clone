
-- Function: auto-insert into active_clients when opportunity is won
CREATE OR REPLACE FUNCTION public.auto_insert_active_client_on_won()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _lead_cnpj text;
  _lead record;
BEGIN
  -- Only fire when stage changes TO 'Ganho'
  IF NEW.stage = 'Ganho' AND (OLD.stage IS DISTINCT FROM 'Ganho') AND NEW.lead_id IS NOT NULL THEN
    SELECT
      regexp_replace(COALESCE(l.cnpj, ''), '\D', '', 'g') AS clean_cnpj,
      COALESCE(l.razao_social, l.nome_fantasia, l.company) AS company,
      l.cnpj, l.razao_social, l.nome_fantasia,
      l.company_segment, l.city, l.state, l.cep,
      l.capital_social, l.cnae_fiscal, l.cnae_fiscal_descricao,
      l.porte, l.employee_count, l.revenue_range,
      l.situacao_cadastral, l.data_inicio_atividade, l.website,
      l.name AS contact_name, l.email, l.phone
    INTO _lead
    FROM leads l
    WHERE l.id = NEW.lead_id;

    -- Only insert if we have a valid CNPJ and it doesn't already exist
    IF _lead.clean_cnpj IS NOT NULL AND length(_lead.clean_cnpj) = 14 THEN
      INSERT INTO active_clients (
        company, cnpj, razao_social, nome_fantasia, segment,
        city, state, cep, capital_social, cnae_fiscal, cnae_fiscal_descricao,
        porte, employee_count, revenue_range, situacao_cadastral,
        data_inicio_atividade, website, contact_name, email, phone, status
      ) VALUES (
        _lead.company, _lead.cnpj, _lead.razao_social, _lead.nome_fantasia,
        _lead.company_segment, _lead.city, _lead.state, _lead.cep,
        _lead.capital_social, _lead.cnae_fiscal, _lead.cnae_fiscal_descricao,
        _lead.porte, _lead.employee_count, _lead.revenue_range,
        _lead.situacao_cadastral, _lead.data_inicio_atividade, _lead.website,
        _lead.contact_name, _lead.email, _lead.phone, 'active'
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to opportunities table
DROP TRIGGER IF EXISTS trg_auto_insert_active_client_on_won ON opportunities;
CREATE TRIGGER trg_auto_insert_active_client_on_won
  AFTER UPDATE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION auto_insert_active_client_on_won();
