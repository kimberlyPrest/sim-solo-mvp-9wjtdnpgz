-- Returns all areas of a farm with their GeoJSON boundaries and basic stats
CREATE OR REPLACE FUNCTION public.get_farm_map_data(p_farm_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'gis'
AS $func$
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
      'declared_area_ha',   a.declared_area_ha,
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
      ase.area_id,
      COUNT(DISTINCT sp.id) AS point_count,
      MAX(sc.sample_date)   AS last_sample_date
    FROM public.area_seasons ase
    JOIN public.sampling_campaigns sc ON sc.area_season_id = ase.id
    LEFT JOIN public.sampling_points sp ON sp.campaign_id = sc.id
    GROUP BY ase.area_id
  ) stats ON stats.area_id = a.id
  WHERE a.farm_id = p_farm_id
    AND a.status = 'active';

  RETURN json_build_object('areas', COALESCE(v_areas, '[]'::json));
END;
$func$;

-- Returns campaign points with a numeric measurement value for one attribute + depth
CREATE OR REPLACE FUNCTION public.get_campaign_points_with_attribute(
  p_campaign_id   uuid,
  p_attribute_code text,
  p_depth_from    numeric,
  p_depth_to      numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'gis'
AS $func$
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
      'id',    sp.id,
      'code',  sp.code,
      'lat',   gis.ST_Y(sp.location),
      'lng',   gis.ST_X(sp.location),
      'value', lm.numeric_value
    )
    ORDER BY sp.code
  )
  INTO v_points
  FROM public.sampling_points sp
  LEFT JOIN public.samples s
    ON  s.sampling_point_id = sp.id
    AND s.depth_from_cm     = p_depth_from
    AND s.depth_to_cm       = p_depth_to
  LEFT JOIN public.lab_measurements lm
    ON  lm.sample_id       = s.id
    AND lm.attribute_code  = p_attribute_code
  WHERE sp.campaign_id = p_campaign_id;

  RETURN COALESCE(v_points, '[]'::json);
END;
$func$;
