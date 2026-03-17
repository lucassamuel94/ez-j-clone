-- Add missing permission: view_accounts
-- Assign it to roles that currently have hardcoded access to /accounts

INSERT INTO public.permissions (id, name, category, description)
VALUES (gen_random_uuid(), 'view_accounts', 'commercial', 'Gestão de Contas')
ON CONFLICT (name) DO NOTHING;

-- Assign view_accounts to Closer, Gerente, Administrador, Head Pós-Venda
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE p.name = 'view_accounts'
  AND r.name IN ('Closer', 'Gerente', 'Administrador', 'Head Pós-Venda')
ON CONFLICT DO NOTHING;

-- Also assign view_accounts to SDR role (for "Meus Clientes" page)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE p.name = 'view_accounts'
  AND r.name = 'SDR'
ON CONFLICT DO NOTHING;
