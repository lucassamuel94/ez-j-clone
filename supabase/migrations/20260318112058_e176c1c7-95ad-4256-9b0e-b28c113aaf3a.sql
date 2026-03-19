-- Create opportunity for LUIZ MARANHAO IMOVEIS LTDA assigned to Paulo Martins
INSERT INTO public.opportunities (lead_id, created_by_user_id, assigned_to_user_id, stage, meeting_datetime)
VALUES (
  '92249ca6-df87-4924-8881-df277ffccb71',
  'fb2375ba-776d-4fcb-b6c6-aaf97cd5939b',
  'fb2375ba-776d-4fcb-b6c6-aaf97cd5939b',
  'Demonstração',
  NOW()
);

-- Update lead status
UPDATE public.leads SET status = 'Oportunidade criada' WHERE id = '92249ca6-df87-4924-8881-df277ffccb71';
