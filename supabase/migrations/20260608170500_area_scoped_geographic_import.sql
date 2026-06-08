-- Geographic setup now belongs directly to an area.
-- Sampling points are stored with sampling_points.area_id; campaigns are not used.

DROP FUNCTION IF EXISTS public.commit_geographic_import(
  uuid,
  uuid,
  uuid,
  text,
  jsonb,
  jsonb,
  numeric,
  integer,
  text,
  uuid,
  text,
  text,
  bigint
);

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

  INSERT INTO public.imports (
    id, organization_id, area_id, kind, status, created_by, uploaded_by,
    source_srid, validation_summary
  ) VALUES (
    p_import_id, p_org_id, p_area_id, 'geography', 'validating', auth.uid(), auth.uid(),
    p_source_srid, jsonb_build_object('point_count', COALESCE(jsonb_array_length(p_points), 0))
  )
  ON CONFLICT (id) DO UPDATE SET status = 'validating', updated_at = NOW();

  IF p_file_path IS NOT NULL THEN
    INSERT INTO public.import_files (
      import_id, organization_id, file_path, storage_path, original_name, file_size, file_kind
    ) VALUES (
      p_import_id, p_org_id, p_file_path, p_file_path, p_original_name, p_file_size, 'geography'
    )
    ON CONFLICT (import_id, file_kind) DO NOTHING;
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
      organization_id, area_id, name, code, location
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

  UPDATE public.imports
  SET status = 'committed', committed_at = NOW(), updated_at = NOW()
  WHERE id = p_import_id;

EXCEPTION WHEN OTHERS THEN
  UPDATE public.imports
  SET status = 'failed',
      error_summary = jsonb_build_object('message', SQLERRM, 'sqlstate', SQLSTATE),
      updated_at = NOW()
  WHERE id = p_import_id;
  RAISE;
END;
$function$;
