-- Setup GIS schema and extension
CREATE SCHEMA IF NOT EXISTS gis;
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA gis;

-- Create Enums
DO $$
BEGIN
  CREATE TYPE public.member_role AS ENUM ('admin', 'technician', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  CREATE TYPE public.record_status AS ENUM ('active', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  CREATE TYPE public.import_status AS ENUM ('uploaded', 'validating', 'validated', 'committed', 'failed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  CREATE TYPE public.import_kind AS ENUM ('geography', 'soil_analysis', 'recommendations');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  CREATE TYPE public.recommendation_kind AS ENUM ('corrective', 'organic', 'nutritional');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$
BEGIN
  CREATE TYPE public.campaign_source AS ENUM ('sim', 'historical_standardized');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create Tables
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organization_members (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.member_role NOT NULL DEFAULT 'viewer'::public.member_role,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.producers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  document text,
  email text,
  phone text,
  notes text,
  status public.record_status NOT NULL DEFAULT 'active'::public.record_status,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.farms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  producer_id uuid NOT NULL REFERENCES public.producers(id) ON DELETE CASCADE,
  name text NOT NULL,
  city text,
  state text,
  total_area_ha numeric,
  notes text,
  status public.record_status NOT NULL DEFAULT 'active'::public.record_status,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  farm_id uuid NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
  name text NOT NULL,
  total_area_ha numeric,
  declared_area_ha numeric,
  calculated_area_ha numeric,
  boundary gis.geometry(MultiPolygon, 4326),
  source_srid integer,
  notes text,
  status public.record_status NOT NULL DEFAULT 'active'::public.record_status,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.area_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  area_id uuid NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  season_year text NOT NULL,
  label text,
  crop text,
  previous_crop text,
  expected_yield numeric,
  expected_productivity numeric,
  actual_productivity numeric,
  productivity_unit text,
  start_date date,
  end_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS area_seasons_area_id_season_year_key ON public.area_seasons (area_id, season_year);

CREATE TABLE IF NOT EXISTS public.sampling_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  area_season_id uuid NOT NULL REFERENCES public.area_seasons(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  source public.campaign_source NOT NULL DEFAULT 'sim'::public.campaign_source,
  sample_date date,
  result_date date,
  laboratory text,
  start_date date,
  end_date date,
  notes text,
  status public.record_status NOT NULL DEFAULT 'active'::public.record_status,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sampling_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.sampling_campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  external_id text,
  sequence integer,
  location gis.geometry(Point, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sampling_points_campaign_code ON public.sampling_points (campaign_id, code);

CREATE TABLE IF NOT EXISTS public.samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sampling_point_id uuid NOT NULL REFERENCES public.sampling_points(id) ON DELETE CASCADE,
  code text NOT NULL,
  depth_top_cm numeric,
  depth_bottom_cm numeric,
  depth_from_cm numeric NOT NULL,
  depth_to_cm numeric NOT NULL,
  collection_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_samples_point_depth ON public.samples (sampling_point_id, depth_from_cm, depth_to_cm);

CREATE TABLE IF NOT EXISTS public.lab_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  unit text,
  default_unit text,
  category text,
  display_order integer DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS lab_attributes_code_key ON public.lab_attributes (code);

CREATE TABLE IF NOT EXISTS public.lab_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sample_id uuid NOT NULL REFERENCES public.samples(id) ON DELETE CASCADE,
  attribute_id uuid REFERENCES public.lab_attributes(id) ON DELETE RESTRICT,
  attribute_code text NOT NULL,
  numeric_value numeric,
  text_value text,
  unit text,
  method text,
  extractor text,
  classification text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DO $$
BEGIN
  ALTER TABLE public.lab_measurements ADD CONSTRAINT has_value CHECK (numeric_value IS NOT NULL OR text_value IS NOT NULL);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS lab_measurements_sample_id_attribute_code_key ON public.lab_measurements (sample_id, attribute_code);

CREATE TABLE IF NOT EXISTS public.recommendation_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.sampling_campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  title text,
  kind public.recommendation_kind,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recommendation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  set_id uuid NOT NULL REFERENCES public.recommendation_sets(id) ON DELETE CASCADE,
  sampling_point_id uuid REFERENCES public.sampling_points(id) ON DELETE CASCADE,
  kind public.recommendation_kind NOT NULL,
  item text NOT NULL,
  product text NOT NULL,
  dose numeric NOT NULL,
  unit text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind public.import_kind NOT NULL,
  status public.import_status NOT NULL DEFAULT 'uploaded'::public.import_status,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  uploaded_by uuid REFERENCES public.profiles(id),
  area_id uuid REFERENCES public.areas(id),
  area_season_id uuid REFERENCES public.area_seasons(id),
  source_srid integer,
  validation_summary jsonb,
  error_summary jsonb,
  log_messages jsonb,
  committed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.import_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.imports(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id),
  file_path text NOT NULL,
  storage_path text,
  original_name text NOT NULL,
  file_size bigint,
  file_kind text,
  checksum text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  user_id uuid,
  actor_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid NOT NULL,
  entity_type text,
  old_data jsonb,
  new_data jsonb,
  changes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Geometries Indexes
CREATE INDEX IF NOT EXISTS idx_areas_boundary ON public.areas USING GIST (boundary);
CREATE INDEX IF NOT EXISTS idx_sampling_points_location ON public.sampling_points USING GIST (location);

-- Helper Functions for RBAC
CREATE OR REPLACE FUNCTION public.get_user_organizations()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.has_role_in_org(org_id uuid, allowed_roles public.member_role[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id
      AND user_id = auth.uid()
      AND role = ANY(allowed_roles)
  );
$function$;

-- Updated_at Trigger Helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'organizations', 'profiles', 'organization_members', 'producers', 'farms',
    'areas', 'area_seasons', 'sampling_campaigns', 'sampling_points', 'samples',
    'lab_attributes', 'lab_measurements', 'recommendation_sets', 'recommendation_items',
    'imports'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;

-- Handle new user auth trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Audit Logs Triggers
CREATE OR REPLACE FUNCTION public.audit_log_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'producers', 'farms', 'areas', 'area_seasons', 'sampling_campaigns',
    'sampling_points', 'samples', 'lab_measurements', 'recommendation_sets',
    'recommendation_items', 'imports'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_logs_trigger ON public.%I', t);
    EXECUTE format('CREATE TRIGGER audit_logs_trigger AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger()', t);
  END LOOP;
END $$;

-- Complex Database Functions (from types)
CREATE OR REPLACE FUNCTION public.commit_geographic_import(
  p_import_id uuid,
  p_area_id uuid,
  p_campaign_id uuid,
  p_action text,
  p_boundary_geojson jsonb,
  p_points jsonb,
  p_calculated_area_ha numeric,
  p_source_srid integer,
  p_justification text,
  p_org_id uuid,
  p_file_path text,
  p_original_name text,
  p_file_size bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'gis'
AS $function$
DECLARE
  v_point jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role_in_org(
    p_org_id,
    ARRAY['admin'::public.member_role, 'technician'::public.member_role]
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.areas a
    WHERE a.id = p_area_id AND a.organization_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Área inválida';
  END IF;

  IF p_action NOT IN ('initial', 'new_points', 'update_boundary') THEN
    RAISE EXCEPTION 'Ação geográfica inválida';
  END IF;

  IF p_action IN ('initial', 'new_points') AND (
    p_campaign_id IS NULL OR COALESCE(jsonb_array_length(p_points), 0) = 0
  ) THEN
    RAISE EXCEPTION 'A campanha e os pontos são obrigatórios';
  END IF;

  IF p_campaign_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.sampling_campaigns c
    JOIN public.area_seasons s ON s.id = c.area_season_id
    WHERE c.id = p_campaign_id
      AND c.organization_id = p_org_id
      AND s.area_id = p_area_id
  ) THEN
    RAISE EXCEPTION 'A campanha não pertence à área';
  END IF;

  IF p_action = 'initial' AND p_boundary_geojson IS NULL THEN
    RAISE EXCEPTION 'O contorno é obrigatório no cadastro inicial';
  END IF;

  IF p_action = 'new_points' AND NOT EXISTS (
    SELECT 1 FROM public.areas a WHERE a.id = p_area_id AND a.boundary IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Cadastre o contorno antes de importar somente pontos';
  END IF;

  IF p_action = 'update_boundary' AND (
    p_boundary_geojson IS NULL OR NULLIF(trim(p_justification), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'Contorno e justificativa são obrigatórios';
  END IF;

  INSERT INTO public.imports (
    id, organization_id, area_id, kind, status, created_by, uploaded_by,
    source_srid, validation_summary
  ) VALUES (
    p_import_id, p_org_id, p_area_id, 'geography', 'validating', auth.uid(), auth.uid(),
    p_source_srid, jsonb_build_object('point_count', COALESCE(jsonb_array_length(p_points), 0))
  )
  ON CONFLICT (id) DO UPDATE SET status = 'validating';

  IF p_file_path IS NOT NULL THEN
    INSERT INTO public.import_files (
      import_id, organization_id, file_path, storage_path, original_name, file_size, file_kind
    ) VALUES (
      p_import_id, p_org_id, p_file_path, p_file_path, p_original_name, p_file_size, 'geography'
    );
  END IF;

  IF p_action IN ('initial', 'update_boundary') THEN
    UPDATE public.areas
    SET boundary = gis.ST_Multi(
          gis.ST_SetSRID(gis.ST_GeomFromGeoJSON(p_boundary_geojson::text), 4326)
        ),
        calculated_area_ha = p_calculated_area_ha,
        source_srid = p_source_srid,
        updated_at = NOW()
    WHERE id = p_area_id AND organization_id = p_org_id;
  END IF;

  IF p_campaign_id IS NOT NULL AND COALESCE(jsonb_array_length(p_points), 0) > 0 THEN
    FOR v_point IN SELECT * FROM jsonb_array_elements(p_points)
    LOOP
      INSERT INTO public.sampling_points (
        organization_id, campaign_id, name, code, location
      ) VALUES (
        p_org_id,
        p_campaign_id,
        v_point->>'code',
        v_point->>'code',
        gis.ST_SetSRID(
          gis.ST_MakePoint((v_point->>'lng')::numeric, (v_point->>'lat')::numeric),
          4326
        )
      );
    END LOOP;
  END IF;

  IF p_action = 'update_boundary' THEN
    INSERT INTO public.audit_logs (
      organization_id, user_id, actor_id, action, entity, entity_type, entity_id, new_data, changes
    ) VALUES (
      p_org_id, auth.uid(), auth.uid(), 'UPDATE_BOUNDARY', 'areas', 'areas', p_area_id,
      jsonb_build_object('justification', p_justification, 'calculated_area_ha', p_calculated_area_ha),
      jsonb_build_object('justification', p_justification, 'calculated_area_ha', p_calculated_area_ha)
    );
  END IF;

  UPDATE public.imports
  SET status = 'committed', committed_at = NOW()
  WHERE id = p_import_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_area_map_data(p_area_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'gis'
AS $function$
DECLARE
  v_boundary json;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.areas a
    JOIN public.organization_members om ON om.organization_id = a.organization_id
    WHERE a.id = p_area_id AND om.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT gis.ST_AsGeoJSON(a.boundary)::json
  INTO v_boundary
  FROM public.areas a
  WHERE a.id = p_area_id;

  RETURN json_build_object('boundary', v_boundary);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_campaign_points(p_campaign_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'gis'
AS $function$
DECLARE
  v_points json;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.sampling_campaigns c
    JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = p_campaign_id AND om.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT json_agg(
    json_build_object(
      'id', sp.id,
      'code', sp.code,
      'lat', gis.ST_Y(sp.location),
      'lng', gis.ST_X(sp.location)
    )
  )
  INTO v_points
  FROM public.sampling_points sp
  WHERE sp.campaign_id = p_campaign_id;

  RETURN COALESCE(v_points, '[]'::json);
END;
$function$;

CREATE OR REPLACE FUNCTION public.reuse_campaign_points(p_source_campaign_id uuid, p_target_campaign_id uuid, p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'gis'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role_in_org(
    p_org_id,
    ARRAY['admin'::public.member_role, 'technician'::public.member_role]
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_source_campaign_id = p_target_campaign_id OR NOT EXISTS (
    SELECT 1
    FROM public.sampling_campaigns source
    JOIN public.area_seasons source_season ON source_season.id = source.area_season_id
    JOIN public.sampling_campaigns target ON target.id = p_target_campaign_id
    JOIN public.area_seasons target_season ON target_season.id = target.area_season_id
    WHERE source.id = p_source_campaign_id
      AND source.organization_id = p_org_id
      AND target.organization_id = p_org_id
      AND source_season.area_id = target_season.area_id
  ) THEN
    RAISE EXCEPTION 'Campanhas incompatíveis';
  END IF;

  INSERT INTO public.sampling_points (
    organization_id, campaign_id, name, code, location, external_id, sequence
  )
  SELECT
    organization_id, p_target_campaign_id, name, code, location, external_id, sequence
  FROM public.sampling_points
  WHERE campaign_id = p_source_campaign_id AND organization_id = p_org_id;
END;
$function$;

-- Enable RLS and setup policies
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'organizations', 'profiles', 'organization_members', 'producers', 'farms',
    'areas', 'area_seasons', 'sampling_campaigns', 'sampling_points', 'samples',
    'lab_attributes', 'lab_measurements', 'recommendation_sets', 'recommendation_items',
    'imports', 'import_files', 'audit_logs'
  ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (
  id = auth.uid() OR id IN (
    SELECT user_id FROM public.organization_members WHERE organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  )
);
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

DROP POLICY IF EXISTS "org_select" ON public.organizations;
CREATE POLICY "org_select" ON public.organizations FOR SELECT TO authenticated USING (
  id IN (SELECT get_user_organizations())
);
DROP POLICY IF EXISTS "org_update" ON public.organizations;
CREATE POLICY "org_update" ON public.organizations FOR UPDATE TO authenticated USING (
  has_role_in_org(id, ARRAY['admin'::public.member_role])
);

DROP POLICY IF EXISTS "org_members_select" ON public.organization_members;
CREATE POLICY "org_members_select" ON public.organization_members FOR SELECT TO authenticated USING (
  organization_id IN (SELECT get_user_organizations())
);
DROP POLICY IF EXISTS "org_members_all" ON public.organization_members;
CREATE POLICY "org_members_all" ON public.organization_members FOR ALL TO authenticated USING (
  has_role_in_org(organization_id, ARRAY['admin'::public.member_role])
) WITH CHECK (
  has_role_in_org(organization_id, ARRAY['admin'::public.member_role])
);

DROP POLICY IF EXISTS "lab_attributes_select" ON public.lab_attributes;
CREATE POLICY "lab_attributes_select" ON public.lab_attributes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "lab_attributes_modify" ON public.lab_attributes;
CREATE POLICY "lab_attributes_modify" ON public.lab_attributes FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = auth.uid() AND role = 'admin'::public.member_role)
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = auth.uid() AND role = 'admin'::public.member_role)
);

DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
CREATE POLICY "audit_logs_select" ON public.audit_logs FOR SELECT TO authenticated USING (
  organization_id IN (SELECT get_user_organizations())
);

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'producers', 'farms', 'areas', 'area_seasons', 'sampling_campaigns',
    'sampling_points', 'samples', 'lab_measurements', 'recommendation_sets',
    'recommendation_items', 'imports', 'import_files'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%I_select" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%I_select" ON public.%I FOR SELECT TO authenticated USING (organization_id IN (SELECT get_user_organizations()))', t, t);
    
    EXECUTE format('DROP POLICY IF EXISTS "%I_insert" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%I_insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (has_role_in_org(organization_id, ARRAY[''admin''::public.member_role, ''technician''::public.member_role]))', t, t);
    
    EXECUTE format('DROP POLICY IF EXISTS "%I_update" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%I_update" ON public.%I FOR UPDATE TO authenticated USING (has_role_in_org(organization_id, ARRAY[''admin''::public.member_role, ''technician''::public.member_role]))', t, t);
    
    EXECUTE format('DROP POLICY IF EXISTS "%I_delete" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%I_delete" ON public.%I FOR DELETE TO authenticated USING (has_role_in_org(organization_id, ARRAY[''admin''::public.member_role, ''technician''::public.member_role]))', t, t);
  END LOOP;
END $$;

-- Storage
INSERT INTO storage.buckets (id, name, public) VALUES ('soil-imports', 'soil-imports', false) ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "soil_imports_select" ON storage.objects;
CREATE POLICY "soil_imports_select" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'soil-imports' AND
  (split_part(name, '/', 1))::uuid IN (SELECT get_user_organizations())
);

DROP POLICY IF EXISTS "soil_imports_insert" ON storage.objects;
CREATE POLICY "soil_imports_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'soil-imports' AND
  has_role_in_org((split_part(name, '/', 1))::uuid, ARRAY['admin'::public.member_role, 'technician'::public.member_role])
);

DROP POLICY IF EXISTS "soil_imports_update" ON storage.objects;
CREATE POLICY "soil_imports_update" ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id = 'soil-imports' AND
  has_role_in_org((split_part(name, '/', 1))::uuid, ARRAY['admin'::public.member_role, 'technician'::public.member_role])
);

DROP POLICY IF EXISTS "soil_imports_delete" ON storage.objects;
CREATE POLICY "soil_imports_delete" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'soil-imports' AND
  has_role_in_org((split_part(name, '/', 1))::uuid, ARRAY['admin'::public.member_role, 'technician'::public.member_role])
);

-- Seed Lab Attributes
DO $$
DECLARE
  v_code text;
BEGIN
  FOR v_code IN SELECT unnest(ARRAY[
    'PH_H2O', 'PH_CACL2', 'P_REM', 'MO', 'P_MELICH', 'P_RES', 'K', 'K_RES', 'S',
    'CA', 'MG', 'AL', 'H_AL', 'SB', 'T', 'T_EFETIVA', 'V', 'M', 'B', 'CU', 'FE',
    'MN', 'ZN', 'AREIA', 'SILTE', 'ARGILA'
  ])
  LOOP
    INSERT INTO public.lab_attributes (code, name)
    VALUES (v_code, v_code)
    ON CONFLICT (code) DO NOTHING;
  END LOOP;
END $$;

-- Seed Organization SIM (no user — bootstrap manually via Supabase Auth Dashboard)
-- Steps after applying this migration:
--   1. Go to Supabase Auth Dashboard → Users → Add User
--   2. Copy the new user's UUID
--   3. Run: INSERT INTO public.organization_members (organization_id, user_id, role)
--           SELECT o.id, '<your-uuid>', 'admin' FROM public.organizations o WHERE o.name = 'SIM';
INSERT INTO public.organizations (name)
SELECT 'SIM'
WHERE NOT EXISTS (SELECT 1 FROM public.organizations WHERE name = 'SIM');
