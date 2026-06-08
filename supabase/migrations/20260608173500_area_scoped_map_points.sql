-- Area map data follows the current schema: sampling points belong directly to areas.

CREATE OR REPLACE FUNCTION public.get_area_map_data(p_area_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'gis'
AS $function$
DECLARE
  v_boundary json;
  v_points json;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.areas a
    JOIN public.organization_members om ON om.organization_id = a.organization_id
    WHERE a.id = p_area_id AND om.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT CASE
           WHEN a.boundary IS NOT NULL THEN gis.ST_AsGeoJSON(a.boundary)::json
           ELSE NULL
         END
  INTO v_boundary
  FROM public.areas a
  WHERE a.id = p_area_id;

  SELECT json_agg(
           json_build_object(
             'id', sp.id,
             'code', sp.code,
             'lat', gis.ST_Y(sp.location),
             'lng', gis.ST_X(sp.location),
             'value', NULL
           )
           ORDER BY sp.code
         )
  INTO v_points
  FROM public.sampling_points sp
  WHERE sp.area_id = p_area_id;

  RETURN json_build_object(
    'boundary', v_boundary,
    'points', COALESCE(v_points, '[]'::json)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_area_points_with_soil_attribute(
  p_area_id uuid,
  p_area_season_id uuid,
  p_attribute_code text,
  p_depth_layer text
)
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
    FROM public.areas a
    JOIN public.organization_members om ON om.organization_id = a.organization_id
    WHERE a.id = p_area_id AND om.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.area_seasons s
    WHERE s.id = p_area_season_id
      AND s.area_id = p_area_id
  ) THEN
    RAISE EXCEPTION 'Safra inválida para a área';
  END IF;

  SELECT json_agg(
           json_build_object(
             'id', sp.id,
             'code', sp.code,
             'lat', gis.ST_Y(sp.location),
             'lng', gis.ST_X(sp.location),
             'value', CASE p_attribute_code
               WHEN 'PH_H2O' THEN sm.ph_h2o
               WHEN 'PH_CACL2' THEN sm.ph_cacl2
               WHEN 'P_REM' THEN sm.p_rem
               WHEN 'MO' THEN sm.mo
               WHEN 'P_MELICH' THEN sm.p_melich
               WHEN 'P_RES' THEN sm.p_res
               WHEN 'K' THEN sm.k
               WHEN 'K_RES' THEN sm.k_res
               WHEN 'S' THEN sm.s
               WHEN 'CA' THEN sm.ca
               WHEN 'MG' THEN sm.mg
               WHEN 'AL' THEN sm.al
               WHEN 'H_AL' THEN sm.h_al
               WHEN 'SB' THEN sm.sb
               WHEN 'T' THEN sm.t_ctc
               WHEN 'T_EFETIVA' THEN sm.t_efetiva
               WHEN 'V' THEN sm.v_pct
               WHEN 'M' THEN sm.m_pct
               WHEN 'B' THEN sm.b
               WHEN 'CU' THEN sm.cu
               WHEN 'FE' THEN sm.fe
               WHEN 'MN' THEN sm.mn
               WHEN 'ZN' THEN sm.zn
               WHEN 'AREIA' THEN sm.areia
               WHEN 'SILTE' THEN sm.silte
               WHEN 'ARGILA' THEN sm.argila
               ELSE NULL
             END
           )
           ORDER BY sp.code
         )
  INTO v_points
  FROM public.sampling_points sp
  LEFT JOIN public.soil_measurements sm
    ON sm.sampling_point_id = sp.id
   AND sm.area_season_id = p_area_season_id
   AND sm.depth_layer = p_depth_layer
  WHERE sp.area_id = p_area_id;

  RETURN COALESCE(v_points, '[]'::json);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_farm_map_data(p_farm_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'gis'
AS $function$
DECLARE
  v_areas json;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.farms f
    JOIN public.organization_members om ON om.organization_id = f.organization_id
    WHERE f.id = p_farm_id AND om.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT json_agg(
    json_build_object(
      'id',                 a.id,
      'name',               a.name,
      'calculated_area_ha', a.calculated_area_ha,
      'declared_area_ha',   NULL,
      'boundary',           CASE WHEN a.boundary IS NOT NULL
                              THEN gis.ST_AsGeoJSON(a.boundary)::json
                              ELSE NULL END,
      'point_count',        COALESCE(stats.point_count, 0),
      'last_sample_date',   stats.last_sample_date
    )
  )
  INTO v_areas
  FROM public.areas a
  LEFT JOIN (
    SELECT
      sp.area_id,
      COUNT(DISTINCT sp.id) AS point_count,
      MAX(s.sample_date) AS last_sample_date
    FROM public.sampling_points sp
    LEFT JOIN public.area_seasons s ON s.area_id = sp.area_id
    GROUP BY sp.area_id
  ) stats ON stats.area_id = a.id
  WHERE a.farm_id = p_farm_id
    AND a.status = 'active';

  RETURN json_build_object('areas', COALESCE(v_areas, '[]'::json));
END;
$function$;
