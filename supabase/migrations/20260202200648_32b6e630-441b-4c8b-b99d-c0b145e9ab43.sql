-- Update the sources_status_check constraint to include 'ready' instead of 'completed'
ALTER TABLE public.sources DROP CONSTRAINT sources_status_check;

ALTER TABLE public.sources ADD CONSTRAINT sources_status_check 
CHECK (status = ANY (ARRAY['processing'::text, 'ready'::text, 'error'::text]));

-- Update any existing 'completed' statuses to 'ready' (if any exist)
UPDATE public.sources SET status = 'processing' WHERE status = 'completed';