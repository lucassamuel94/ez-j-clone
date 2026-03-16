
-- Add new roles to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_pos_venda';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ux_po';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'dev_chatbot';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'treinamento';
