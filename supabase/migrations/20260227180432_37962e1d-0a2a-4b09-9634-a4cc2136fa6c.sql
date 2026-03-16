
-- 1) Trigger: auto-create or link account on lead INSERT
CREATE OR REPLACE FUNCTION auto_link_account_on_lead()
RETURNS TRIGGER AS $$
DECLARE
  _account_id uuid;
  _clean_cnpj text;
BEGIN
  -- If account_id already set, skip
  IF NEW.account_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  _clean_cnpj := regexp_replace(COALESCE(NEW.cnpj, ''), '\D', '', 'g');

  -- Try to find existing account by CNPJ
  IF length(_clean_cnpj) = 14 THEN
    SELECT id INTO _account_id
    FROM accounts
    WHERE regexp_replace(COALESCE(cnpj, ''), '\D', '', 'g') = _clean_cnpj
    LIMIT 1;
  END IF;

  -- If no account found, create one
  IF _account_id IS NULL THEN
    INSERT INTO accounts (
      company_name, cnpj, razao_social, nome_fantasia,
      company_segment, employee_count, revenue_range, porte,
      capital_social, cnae_fiscal, cnae_fiscal_descricao, cnaes_secundarios,
      situacao_cadastral, data_inicio_atividade, qsa, website,
      cep, logradouro, numero, complemento, bairro, city, state, country,
      email, phone, contact_name, lifecycle_stage
    ) VALUES (
      COALESCE(NEW.razao_social, NEW.nome_fantasia, NEW.company),
      CASE WHEN length(_clean_cnpj) = 14 THEN _clean_cnpj ELSE NULL END,
      NEW.razao_social, NEW.nome_fantasia,
      NEW.company_segment, NEW.employee_count, NEW.revenue_range, NEW.porte,
      NEW.capital_social, NEW.cnae_fiscal, NEW.cnae_fiscal_descricao, NEW.cnaes_secundarios,
      NEW.situacao_cadastral, NEW.data_inicio_atividade, NEW.qsa, NEW.website,
      NEW.cep, NEW.logradouro, NEW.numero, NEW.complemento, NEW.bairro, NEW.city, NEW.state, NEW.country,
      NEW.email, NEW.phone, NEW.name, 'lead'
    )
    RETURNING id INTO _account_id;
  END IF;

  NEW.account_id := _account_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_link_account ON leads;
CREATE TRIGGER trg_auto_link_account
  BEFORE INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_account_on_lead();

-- 2) Trigger: auto-propagate account_id from lead to opportunity on INSERT
CREATE OR REPLACE FUNCTION auto_set_opportunity_account()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.account_id IS NULL AND NEW.lead_id IS NOT NULL THEN
    SELECT account_id INTO NEW.account_id
    FROM leads
    WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_set_opp_account ON opportunities;
CREATE TRIGGER trg_auto_set_opp_account
  BEFORE INSERT ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION auto_set_opportunity_account();
