CREATE OR REPLACE FUNCTION public.commit_soil_analysis_import(
  p_import_id uuid,
  p_org_id uuid,
  p_area_season_id uuid,
  p_file_path text,
  p_original_name text,
  p_file_size bigint,
  p_data jsonb,
  p_metadata jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_area_id uuid;
  v_item jsonb;
  v_meas jsonb;
  v_point_id uuid;
  v_measurement_id uuid;
  v_depth_layer text;
  v_values jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role_in_org(
    p_org_id,
    ARRAY['admin'::public.member_role, 'technician'::public.member_role]
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT area_id
  INTO v_area_id
  FROM public.area_seasons
  WHERE id = p_area_season_id
    AND organization_id = p_org_id;

  IF v_area_id IS NULL THEN
    RAISE EXCEPTION 'Safra inválida';
  END IF;

  IF p_metadata IS NOT NULL THEN
    UPDATE public.area_seasons
    SET laboratory = COALESCE(NULLIF(p_metadata->>'laboratory', ''), laboratory),
        sample_date = CASE
          WHEN NULLIF(p_metadata->>'sample_date', '') IS NOT NULL THEN (p_metadata->>'sample_date')::date
          ELSE sample_date
        END,
        result_date = CASE
          WHEN NULLIF(p_metadata->>'result_date', '') IS NOT NULL THEN (p_metadata->>'result_date')::date
          ELSE result_date
        END,
        source = CASE
          WHEN NULLIF(p_metadata->>'source', '') IS NOT NULL THEN (p_metadata->>'source')::public.campaign_source
          ELSE source
        END,
        updated_at = NOW()
    WHERE id = p_area_season_id
      AND organization_id = p_org_id;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_data, '[]'::jsonb))
  LOOP
    v_point_id := (v_item->>'point_id')::uuid;
    IF v_point_id IS NULL THEN
      RAISE EXCEPTION 'point_id ausente para o ponto %', v_item->>'code';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.sampling_points sp
      WHERE sp.id = v_point_id
        AND sp.organization_id = p_org_id
        AND sp.area_id = v_area_id
    ) THEN
      RAISE EXCEPTION 'Ponto % não pertence à área ou organização', v_item->>'code';
    END IF;

    v_depth_layer := CASE
      WHEN (v_item->>'depth_from_cm')::numeric = 0
        AND (v_item->>'depth_to_cm')::numeric = 20 THEN '0_20'
      WHEN (v_item->>'depth_from_cm')::numeric = 20
        AND (v_item->>'depth_to_cm')::numeric = 40 THEN '20_40'
      ELSE NULL
    END;

    IF v_depth_layer IS NULL THEN
      RAISE EXCEPTION 'Profundidade inválida para o ponto %', v_item->>'code';
    END IF;

    SELECT id
    INTO v_measurement_id
    FROM public.soil_measurements
    WHERE organization_id = p_org_id
      AND area_season_id = p_area_season_id
      AND sampling_point_id = v_point_id
      AND depth_layer = v_depth_layer
    ORDER BY updated_at DESC
    LIMIT 1;

    IF v_measurement_id IS NULL THEN
      INSERT INTO public.soil_measurements (
        organization_id,
        area_season_id,
        sampling_point_id,
        depth_layer
      ) VALUES (
        p_org_id,
        p_area_season_id,
        v_point_id,
        v_depth_layer
      )
      RETURNING id INTO v_measurement_id;
    END IF;

    v_values := '{}'::jsonb;
    FOR v_meas IN SELECT * FROM jsonb_array_elements(COALESCE(v_item->'measurements', '[]'::jsonb))
    LOOP
      v_values := v_values || jsonb_build_object(
        v_meas->>'attribute_code',
        v_meas->>'numeric_value'
      );
    END LOOP;

    UPDATE public.soil_measurements
    SET ph_h2o = COALESCE((v_values->>'PH_H2O')::numeric, ph_h2o),
        ph_cacl2 = COALESCE((v_values->>'PH_CACL2')::numeric, ph_cacl2),
        p_rem = COALESCE((v_values->>'P_REM')::numeric, p_rem),
        mo = COALESCE((v_values->>'MO')::numeric, mo),
        p_melich = COALESCE((v_values->>'P_MELICH')::numeric, p_melich),
        p_res = COALESCE((v_values->>'P_RES')::numeric, p_res),
        k = COALESCE((v_values->>'K')::numeric, k),
        k_res = COALESCE((v_values->>'K_RES')::numeric, k_res),
        s = COALESCE((v_values->>'S')::numeric, s),
        ca = COALESCE((v_values->>'CA')::numeric, ca),
        mg = COALESCE((v_values->>'MG')::numeric, mg),
        al = COALESCE((v_values->>'AL')::numeric, al),
        h_al = COALESCE((v_values->>'H_AL')::numeric, h_al),
        sb = COALESCE((v_values->>'SB')::numeric, sb),
        t_ctc = COALESCE((v_values->>'T')::numeric, t_ctc),
        t_efetiva = COALESCE((v_values->>'T_EFETIVA')::numeric, t_efetiva),
        v_pct = COALESCE((v_values->>'V')::numeric, v_pct),
        m_pct = COALESCE((v_values->>'M')::numeric, m_pct),
        b = COALESCE((v_values->>'B')::numeric, b),
        cu = COALESCE((v_values->>'CU')::numeric, cu),
        fe = COALESCE((v_values->>'FE')::numeric, fe),
        mn = COALESCE((v_values->>'MN')::numeric, mn),
        zn = COALESCE((v_values->>'ZN')::numeric, zn),
        areia = COALESCE((v_values->>'AREIA')::numeric, areia),
        silte = COALESCE((v_values->>'SILTE')::numeric, silte),
        argila = COALESCE((v_values->>'ARGILA')::numeric, argila),
        updated_at = NOW()
    WHERE id = v_measurement_id;
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.commit_soil_analysis_import(
  uuid,
  uuid,
  uuid,
  text,
  text,
  bigint,
  jsonb,
  jsonb
) TO authenticated;
