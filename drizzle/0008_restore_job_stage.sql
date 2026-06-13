ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS stage varchar(32);

UPDATE public.jobs
SET stage = CASE
  WHEN pool = 'rejected' THEN 'rejected'
  ELSE 'no_response'
END
WHERE stage IS NULL;

ALTER TABLE public.jobs
ALTER COLUMN stage SET DEFAULT 'no_response';

ALTER TABLE public.jobs
ALTER COLUMN stage SET NOT NULL;

CREATE INDEX IF NOT EXISTS jobs_cycle_stage_idx
ON public.jobs (search_cycle_label, stage);
