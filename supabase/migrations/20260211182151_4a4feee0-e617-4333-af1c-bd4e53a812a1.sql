-- Remove phone masking (asterisks) from leads table
-- This removes the '****' suffix from phone and phone_2 fields
UPDATE public.leads 
SET phone = CASE 
  WHEN phone ~ '\*\*\*\*$' THEN regexp_replace(phone, '-\*\*\*\*$', '')
  ELSE phone
END
WHERE phone LIKE '%-****' OR phone LIKE '%-\*\*\*\*';

UPDATE public.leads 
SET phone_2 = CASE 
  WHEN phone_2 ~ '\*\*\*\*$' THEN regexp_replace(phone_2, '-\*\*\*\*$', '')
  ELSE phone_2
END
WHERE phone_2 LIKE '%-****' OR phone_2 LIKE '%-\*\*\*\*';