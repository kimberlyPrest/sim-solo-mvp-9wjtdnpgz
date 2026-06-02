-- create bucket for soil imports
INSERT INTO storage.buckets (id, name, public) VALUES ('soil-imports', 'soil-imports', false) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "allow_admin_technician_insert" ON storage.objects;
CREATE POLICY "allow_admin_technician_insert" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'soil-imports');

DROP POLICY IF EXISTS "allow_auth_select" ON storage.objects;
CREATE POLICY "allow_auth_select" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'soil-imports');

-- insert lab attributes
INSERT INTO public.lab_attributes (code, name, active) VALUES
('PH_H2O', 'pH em Água', true),
('PH_CACL2', 'pH em CaCl2', true),
('P_REM', 'Fósforo Remanescente', true),
('MO', 'Matéria Orgânica', true),
('P_MELICH', 'Fósforo (Mehlich)', true),
('P_RES', 'Fósforo (Resina)', true),
('K', 'Potássio', true),
('K_RES', 'Potássio (Resina)', true),
('S', 'Enxofre', true),
('CA', 'Cálcio', true),
('MG', 'Magnésio', true),
('AL', 'Alumínio', true),
('H_AL', 'H + Al', true),
('SB', 'Soma de Bases', true),
('T', 'CTC Potencial', true),
('T_EFETIVA', 'CTC Efetiva', true),
('V', 'Saturação por Bases (V%)', true),
('M', 'Saturação por Alumínio (m%)', true),
('B', 'Boro', true),
('CU', 'Cobre', true),
('FE', 'Ferro', true),
('MN', 'Manganês', true),
('ZN', 'Zinco', true),
('AREIA', 'Areia', true),
('SILTE', 'Silte', true),
('ARGILA', 'Argila', true)
ON CONFLICT (code) DO NOTHING;

-- RPC for importing soil analysis transactionally
CREATE OR REPLACE FUNCTION public.commit_soil_analysis_import(
    p_import_id uuid,
    p_org_id uuid,
    p_campaign_id uuid,
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
AS $func$
DECLARE
    v_item jsonb;
    v_meas jsonb;
    v_sample_id uuid;
BEGIN
    IF auth.uid() IS NULL OR NOT public.has_role_in_org(
        p_org_id,
        ARRAY['admin'::public.member_role, 'technician'::public.member_role]
    ) THEN
        RAISE EXCEPTION 'Acesso negado';
    END IF;

    IF p_metadata IS NOT NULL THEN
        UPDATE public.sampling_campaigns
        SET laboratory = COALESCE(p_metadata->>'laboratory', laboratory),
            sample_date = CASE WHEN p_metadata->>'sample_date' IS NOT NULL THEN (p_metadata->>'sample_date')::date ELSE sample_date END,
            result_date = CASE WHEN p_metadata->>'result_date' IS NOT NULL THEN (p_metadata->>'result_date')::date ELSE result_date END,
            source = CASE WHEN p_metadata->>'source' IS NOT NULL THEN (p_metadata->>'source')::public.campaign_source ELSE source END,
            updated_at = NOW()
        WHERE id = p_campaign_id AND organization_id = p_org_id;
    END IF;

    INSERT INTO public.imports (
        id, organization_id, kind, status, created_by, uploaded_by,
        committed_at
    ) VALUES (
        p_import_id, p_org_id, 'soil_analysis', 'committed', auth.uid(), auth.uid(),
        NOW()
    );

    IF p_file_path IS NOT NULL THEN
        INSERT INTO public.import_files (
            import_id, organization_id, file_path, storage_path, original_name, file_size, file_kind
        ) VALUES (
            p_import_id, p_org_id, p_file_path, p_file_path, p_original_name, p_file_size, 'soil_analysis'
        );
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_data)
    LOOP
        SELECT id INTO v_sample_id
        FROM public.samples
        WHERE sampling_point_id = (v_item->>'point_id')::uuid
          AND depth_from_cm = (v_item->>'depth_from_cm')::numeric
          AND depth_to_cm = (v_item->>'depth_to_cm')::numeric;

        IF v_sample_id IS NULL THEN
            v_sample_id := gen_random_uuid();
            INSERT INTO public.samples (
                id, organization_id, sampling_point_id, code, depth_from_cm, depth_to_cm
            ) VALUES (
                v_sample_id,
                p_org_id,
                (v_item->>'point_id')::uuid,
                v_item->>'code',
                (v_item->>'depth_from_cm')::numeric,
                (v_item->>'depth_to_cm')::numeric
            );
        END IF;

        FOR v_meas IN SELECT * FROM jsonb_array_elements(v_item->'measurements')
        LOOP
            INSERT INTO public.lab_measurements (
                organization_id, sample_id, attribute_code, numeric_value, text_value
            ) VALUES (
                p_org_id,
                v_sample_id,
                v_meas->>'attribute_code',
                (v_meas->>'numeric_value')::numeric,
                v_meas->>'text_value'
            )
            ON CONFLICT (sample_id, attribute_code) DO UPDATE
            SET numeric_value = EXCLUDED.numeric_value,
                text_value = EXCLUDED.text_value,
                updated_at = NOW();
        END LOOP;
    END LOOP;
END;
$func$;
