CREATE OR REPLACE FUNCTION public.set_jobs_search_text()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_text := lower(
    trim(
      regexp_replace(
        concat_ws(' ', coalesce(NEW.company, ''), coalesce(NEW.role_title, ''), coalesce(NEW.location, '')),
        '\s+',
        ' ',
        'g'
      )
    )
  );
  RETURN NEW;
END;
$$;--> statement-breakpoint

DROP TRIGGER IF EXISTS jobs_set_search_text_before_write ON public.jobs;--> statement-breakpoint

CREATE TRIGGER jobs_set_search_text_before_write
BEFORE INSERT OR UPDATE OF company, role_title, location, search_text
ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.set_jobs_search_text();

