ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS stage varchar(32) NOT NULL DEFAULT 'applied';
