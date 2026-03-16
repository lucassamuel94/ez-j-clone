
-- Add closer goal fields to goals table
ALTER TABLE public.goals 
  ADD COLUMN goal_type TEXT NOT NULL DEFAULT 'sdr',
  ADD COLUMN setup_revenue_goal NUMERIC DEFAULT 0,
  ADD COLUMN conversion_percentage NUMERIC DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.goals.goal_type IS 'sdr or closer';
COMMENT ON COLUMN public.goals.setup_revenue_goal IS 'Closer goal: total setup revenue in R$';
COMMENT ON COLUMN public.goals.conversion_percentage IS 'Closer goal: conversion rate %';
