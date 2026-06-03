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
    )
    ON CONFLICT (import_id, file_kind) DO NOTHING;
  END IF;

  IF p_action IN ('initial', 'update_boundary') THEN
    UPDATE public.areas
    SET boundary = gis.ST_Multi(
          gis.ST_Force2D(
            gis.ST_SetSRID(gis.ST_GeomFromGeoJSON(p_boundary_geojson::text), 4326)
          )
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

EXCEPTION WHEN OTHERS THEN
  UPDATE public.imports
  SET status = 'failed',
      error_summary = jsonb_build_object('message', SQLERRM, 'sqlstate', SQLSTATE),
      updated_at = NOW()
  WHERE id = p_import_id;
  RAISE;
END;
$function$;
