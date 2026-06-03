-- Corrective migration: adds missing constraints and fixes unsafe SECURITY DEFINER functions.

-- 1. Add unique constraint on import_files(import_id, file_kind) so the RPC's
--    ON CONFLICT clause can work for idempotent retries.
ALTER TABLE public.import_files
  ADD CONSTRAINT import_files_import_id_file_kind_key UNIQUE (import_id, file_kind);

-- 2. Add SET search_path to SECURITY DEFINER functions that were missing it.
--    Prevents schema injection via public.* object creation.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

CREATE OR REPLACE FUNCTION public.audit_log_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  old_data JSONB := NULL;
  new_data JSONB := NULL;
  org_id UUID := NULL;
  ent_id UUID := NULL;
BEGIN
  IF (TG_OP = 'UPDATE') THEN
      old_data := to_jsonb(OLD);
      new_data := to_jsonb(NEW);
      org_id := (new_data->>'organization_id')::UUID;
      ent_id := (new_data->>'id')::UUID;
  ELSIF (TG_OP = 'INSERT') THEN
      new_data := to_jsonb(NEW);
      org_id := (new_data->>'organization_id')::UUID;
      ent_id := (new_data->>'id')::UUID;
  ELSIF (TG_OP = 'DELETE') THEN
      old_data := to_jsonb(OLD);
      org_id := (old_data->>'organization_id')::UUID;
      ent_id := (old_data->>'id')::UUID;
  END IF;

  IF ent_id IS NOT NULL THEN
      INSERT INTO public.audit_logs (
          organization_id, user_id, action, entity, entity_id, old_data, new_data
      ) VALUES (
          org_id, auth.uid(), TG_OP, TG_TABLE_NAME, ent_id, old_data, new_data
      );
  END IF;

  IF (TG_OP = 'DELETE') THEN
      RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;
