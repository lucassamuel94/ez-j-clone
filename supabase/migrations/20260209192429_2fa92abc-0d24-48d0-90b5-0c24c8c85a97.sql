
-- Change uses_platform from boolean to text to support three options
ALTER TABLE public.leads ALTER COLUMN uses_platform TYPE text USING 
  CASE 
    WHEN uses_platform = true THEN 'sim'
    WHEN uses_platform = false THEN 'nao'
    ELSE NULL
  END;
