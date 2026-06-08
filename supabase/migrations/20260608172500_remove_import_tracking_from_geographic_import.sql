-- Geographic configuration no longer writes import tracking records.
-- The compatibility signature is kept because the deployed frontend still passes
-- p_import_id and file metadata, but those values are intentionally ignored.

DROP FUNCTION IF EXISTS public.commit_geographic_import(
  uuid,
  text,
  jsonb,
  jsonb,
  numeric,
  integer,
  uuid
);

DROP FUNCTION IF EXISTS public.commit_geographic_import(
  uuid,
  uuid,
  text,
  jsonb,
  jsonb,
  numeric,
  integer,
  uuid,
  text,
  text,
  bigint
);

CREATE OR REPLACE FUNCTION public.commit_geographic_import(
  p_area_id uuid,
  p_action text,
  p_boundary_geojson jsonb,
  p_points jsonb,
  p_calculated_area_ha numeric,
  p_source_srid integer,
  p_org_id uuid
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
    SELECT 1
    FROM public.areas a
    WHERE a.id = p_area_id
      AND a.organization_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Área inválida';
  END IF;

  IF p_action <> 'initial' THEN
    RAISE EXCEPTION 'A importação geográfica permite apenas a configuração inicial';
  END IF;

  IF p_boundary_geojson IS NULL OR COALESCE(jsonb_array_length(p_points), 0) = 0 THEN
    RAISE EXCEPTION 'A configuração inicial exige um contorno e ao menos um ponto';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.areas a
    WHERE a.id = p_area_id
      AND a.organization_id = p_org_id
      AND a.boundary IS NOT NULL
  ) OR EXISTS (
    SELECT 1
    FROM public.sampling_points sp
    WHERE sp.area_id = p_area_id
      AND sp.organization_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'A configuração geográfica inicial já foi realizada para esta área';
  END IF;

  UPDATE public.areas
  SET boundary = gis.ST_Multi(
        gis.ST_Force2D(
          gis.ST_SetSRID(gis.ST_GeomFromGeoJSON(p_boundary_geojson::text), 4326)
        )
      ),
      calculated_area_ha = p_calculated_area_ha,
      source_srid = p_source_srid,
      updated_at = NOW()
  WHERE id = p_area_id
    AND organization_id = p_org_id;

  FOR v_point IN SELECT * FROM jsonb_array_elements(p_points)
  LOOP
    INSERT INTO public.sampling_points (
      organization_id,
      area_id,
      name,
      code,
      location
    ) VALUES (
      p_org_id,
      p_area_id,
      v_point->>'code',
      v_point->>'code',
      gis.ST_SetSRID(
        gis.ST_MakePoint((v_point->>'lng')::numeric, (v_point->>'lat')::numeric),
        4326
      )
    );
  END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.commit_geographic_import(
  p_import_id uuid,
  p_area_id uuid,
  p_action text,
  p_boundary_geojson jsonb,
  p_points jsonb,
  p_calculated_area_ha numeric,
  p_source_srid integer,
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
BEGIN
  PERFORM public.commit_geographic_import(
    p_area_id,
    p_action,
    p_boundary_geojson,
    p_points,
    p_calculated_area_ha,
    p_source_srid,
    p_org_id
  );
END;
$function$;
