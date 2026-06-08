CREATE OR REPLACE FUNCTION public.delete_area_cascade(p_area_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_area_count integer := 0;
  v_season_count integer := 0;
  v_point_count integer := 0;
  v_measurement_count integer := 0;
  v_set_count integer := 0;
  v_item_count integer := 0;
  v_deleted integer := 0;
BEGIN
  SELECT organization_id
  INTO v_org_id
  FROM public.areas
  WHERE id = p_area_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Área não encontrada';
  END IF;

  IF auth.uid() IS NULL OR NOT public.has_role_in_org(
    v_org_id,
    ARRAY['admin'::public.member_role, 'technician'::public.member_role]
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  DELETE FROM public.recommendation_items ri
  WHERE ri.organization_id = v_org_id
    AND ri.set_id IN (
      SELECT rs.id
      FROM public.recommendation_sets rs
      JOIN public.area_seasons s ON s.id = rs.area_season_id
      WHERE s.area_id = p_area_id
    );
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_item_count := v_item_count + v_deleted;

  DELETE FROM public.recommendation_items ri
  WHERE ri.organization_id = v_org_id
    AND ri.sampling_point_id IN (
      SELECT sp.id FROM public.sampling_points sp WHERE sp.area_id = p_area_id
    );
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_item_count := v_item_count + v_deleted;

  DELETE FROM public.recommendation_sets rs
  WHERE rs.organization_id = v_org_id
    AND rs.area_season_id IN (
      SELECT s.id FROM public.area_seasons s WHERE s.area_id = p_area_id
    );
  GET DIAGNOSTICS v_set_count = ROW_COUNT;

  DELETE FROM public.soil_measurements sm
  WHERE sm.organization_id = v_org_id
    AND sm.area_season_id IN (
      SELECT s.id FROM public.area_seasons s WHERE s.area_id = p_area_id
    );
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_measurement_count := v_measurement_count + v_deleted;

  DELETE FROM public.soil_measurements sm
  WHERE sm.organization_id = v_org_id
    AND sm.sampling_point_id IN (
      SELECT sp.id FROM public.sampling_points sp WHERE sp.area_id = p_area_id
    );
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  v_measurement_count := v_measurement_count + v_deleted;

  DELETE FROM public.area_seasons s
  WHERE s.organization_id = v_org_id
    AND s.area_id = p_area_id;
  GET DIAGNOSTICS v_season_count = ROW_COUNT;

  DELETE FROM public.sampling_points sp
  WHERE sp.organization_id = v_org_id
    AND sp.area_id = p_area_id;
  GET DIAGNOSTICS v_point_count = ROW_COUNT;

  DELETE FROM public.areas a
  WHERE a.organization_id = v_org_id
    AND a.id = p_area_id;
  GET DIAGNOSTICS v_area_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'areas', v_area_count,
    'area_seasons', v_season_count,
    'sampling_points', v_point_count,
    'soil_measurements', v_measurement_count,
    'recommendation_sets', v_set_count,
    'recommendation_items', v_item_count
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_farm_cascade(p_farm_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_area_id uuid;
  v_area_count integer := 0;
  v_farm_count integer := 0;
BEGIN
  SELECT organization_id
  INTO v_org_id
  FROM public.farms
  WHERE id = p_farm_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Fazenda não encontrada';
  END IF;

  IF auth.uid() IS NULL OR NOT public.has_role_in_org(
    v_org_id,
    ARRAY['admin'::public.member_role, 'technician'::public.member_role]
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  FOR v_area_id IN
    SELECT id FROM public.areas WHERE farm_id = p_farm_id AND organization_id = v_org_id
  LOOP
    PERFORM public.delete_area_cascade(v_area_id);
    v_area_count := v_area_count + 1;
  END LOOP;

  DELETE FROM public.farms f
  WHERE f.organization_id = v_org_id
    AND f.id = p_farm_id;
  GET DIAGNOSTICS v_farm_count = ROW_COUNT;

  RETURN jsonb_build_object('farms', v_farm_count, 'areas', v_area_count);
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_producer_cascade(p_producer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_farm_id uuid;
  v_farm_count integer := 0;
  v_producer_count integer := 0;
BEGIN
  SELECT organization_id
  INTO v_org_id
  FROM public.producers
  WHERE id = p_producer_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Produtor não encontrado';
  END IF;

  IF auth.uid() IS NULL OR NOT public.has_role_in_org(
    v_org_id,
    ARRAY['admin'::public.member_role, 'technician'::public.member_role]
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  FOR v_farm_id IN
    SELECT id FROM public.farms WHERE producer_id = p_producer_id AND organization_id = v_org_id
  LOOP
    PERFORM public.delete_farm_cascade(v_farm_id);
    v_farm_count := v_farm_count + 1;
  END LOOP;

  DELETE FROM public.producers p
  WHERE p.organization_id = v_org_id
    AND p.id = p_producer_id;
  GET DIAGNOSTICS v_producer_count = ROW_COUNT;

  RETURN jsonb_build_object('producers', v_producer_count, 'farms', v_farm_count);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.delete_area_cascade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_farm_cascade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_producer_cascade(uuid) TO authenticated;
