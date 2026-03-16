INSERT INTO public.permissions (name, category, description)
VALUES ('view_reports', 'management', 'Visualizar Relatórios')
ON CONFLICT DO NOTHING;