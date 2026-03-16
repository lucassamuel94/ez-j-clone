-- Fix API Oficial pipeline: make intermediate statuses editable (not system)
-- Keep "Acionar" as system start (sort_order 0)
-- Make middle statuses non-system with sequential sort_order
-- Keep "Enviar Pós Venda" as system end (sort_order 90)

UPDATE pipeline_statuses SET is_system = true, sort_order = 0
WHERE pipeline = 'api_oficial' AND status_name = 'Acionar';

UPDATE pipeline_statuses SET is_system = false, sort_order = 1
WHERE pipeline = 'api_oficial' AND status_name = 'Em contato';

UPDATE pipeline_statuses SET is_system = false, sort_order = 2
WHERE pipeline = 'api_oficial' AND status_name = 'Reunião agendada';

UPDATE pipeline_statuses SET is_system = false, sort_order = 3
WHERE pipeline = 'api_oficial' AND status_name = 'Aguardando retorno';

UPDATE pipeline_statuses SET is_system = false, sort_order = 4
WHERE pipeline = 'api_oficial' AND status_name = 'Não quer agora';

UPDATE pipeline_statuses SET is_system = true, sort_order = 90
WHERE pipeline = 'api_oficial' AND status_name = 'Enviar Pós Venda';