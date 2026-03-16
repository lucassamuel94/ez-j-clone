
CREATE OR REPLACE FUNCTION public.save_checkout_registration(
  p_proposal_id uuid,
  p_cnpj text DEFAULT NULL,
  p_razao_social text DEFAULT NULL,
  p_nome_fantasia text DEFAULT NULL,
  p_cep text DEFAULT NULL,
  p_logradouro text DEFAULT NULL,
  p_numero text DEFAULT NULL,
  p_complemento text DEFAULT NULL,
  p_bairro text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_rep_name text DEFAULT NULL,
  p_rep_cpf text DEFAULT NULL,
  p_rep_phone text DEFAULT NULL,
  p_rep_role text DEFAULT NULL,
  p_rep_email text DEFAULT NULL,
  p_fin_name text DEFAULT NULL,
  p_fin_email text DEFAULT NULL,
  p_fin_phone text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO checkout_sessions (
    proposal_id, status,
    cnpj, razao_social, nome_fantasia,
    cep, logradouro, numero, complemento, bairro, city, state,
    rep_name, rep_cpf, rep_phone, rep_role, rep_email,
    fin_name, fin_email, fin_phone
  ) VALUES (
    p_proposal_id, 'completed',
    p_cnpj, p_razao_social, p_nome_fantasia,
    p_cep, p_logradouro, p_numero, p_complemento, p_bairro, p_city, p_state,
    p_rep_name, p_rep_cpf, p_rep_phone, p_rep_role, p_rep_email,
    p_fin_name, p_fin_email, p_fin_phone
  )
  ON CONFLICT (proposal_id) DO UPDATE SET
    status = 'completed',
    cnpj = EXCLUDED.cnpj, razao_social = EXCLUDED.razao_social, nome_fantasia = EXCLUDED.nome_fantasia,
    cep = EXCLUDED.cep, logradouro = EXCLUDED.logradouro, numero = EXCLUDED.numero,
    complemento = EXCLUDED.complemento, bairro = EXCLUDED.bairro, city = EXCLUDED.city, state = EXCLUDED.state,
    rep_name = EXCLUDED.rep_name, rep_cpf = EXCLUDED.rep_cpf, rep_phone = EXCLUDED.rep_phone,
    rep_role = EXCLUDED.rep_role, rep_email = EXCLUDED.rep_email,
    fin_name = EXCLUDED.fin_name, fin_email = EXCLUDED.fin_email, fin_phone = EXCLUDED.fin_phone,
    updated_at = now();

  UPDATE proposals SET status = 'accepted'
  WHERE id = p_proposal_id AND status NOT IN ('accepted', 'rejected');

  RETURN true;
END;
$$;
