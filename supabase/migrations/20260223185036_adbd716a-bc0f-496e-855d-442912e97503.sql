ALTER TABLE public.api_analysis_requests 
ADD COLUMN feasibility text CHECK (feasibility IN ('possible', 'partially_possible', 'impossible'));