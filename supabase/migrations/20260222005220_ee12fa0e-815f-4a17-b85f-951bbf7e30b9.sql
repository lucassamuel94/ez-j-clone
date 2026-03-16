
-- 1. Insert new permissions
INSERT INTO permissions (name, description, category) VALUES
  ('view_integrations', 'Ver Catálogo de Integrações', 'tools'),
  ('view_deliveries', 'Ver Projetos Entregues', 'tools');

-- 2. Assign permissions to relevant roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.name = 'view_integrations'
  AND r.name IN ('Administrador', 'Gerente', 'Head Pós-Venda', 'Closer', 'SDR', 'UX/PO', 'Dev Chatbot', 'Treinamento');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE p.name = 'view_deliveries'
  AND r.name IN ('Administrador', 'Gerente', 'Head Pós-Venda', 'Closer', 'UX/PO', 'Dev Chatbot', 'Treinamento');

-- 3. Add permission-based RLS policies for SELECT on project_integrations
CREATE POLICY "Users with view_integrations permission can view"
ON project_integrations FOR SELECT
USING (has_permission(auth.uid(), 'view_integrations'));

-- 4. Add permission-based RLS policies for SELECT on project_deliveries
CREATE POLICY "Users with view_deliveries permission can view"
ON project_deliveries FOR SELECT
USING (has_permission(auth.uid(), 'view_deliveries'));
