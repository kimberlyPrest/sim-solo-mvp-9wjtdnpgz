-- create bucket for soil imports
INSERT INTO storage.buckets (id, name, public) VALUES ('soil-imports', 'soil-imports', false) ON CONFLICT (id) DO NOTHING;

-- Restore org-scoped storage policies (drop permissive flat-auth policies if they exist)
DROP POLICY IF EXISTS "allow_admin_technician_insert" ON storage.objects;
DROP POLICY IF EXISTS "allow_auth_select" ON storage.objects;

-- Ensure the correct org-scoped policies from the initial migration are present.
-- These use split_part to extract the org UUID from the path prefix (<org_id>/filename).
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

-- insert/update lab attributes with Portuguese names
-- Uses DO UPDATE so names are applied even when migration 1 already seeded the codes
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
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, active = EXCLUDED.active;

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
    v_point_id uuid;
    v_attribute_id uuid;
BEGIN
    IF auth.uid() IS NULL OR NOT public.has_role_in_org(
        p_org_id,
        ARRAY['admin'::public.member_role, 'technician'::public.member_role]
    ) THEN
        RAISE EXCEPTION 'Acesso negado';
    END IF;

    -- Create import record in 'validating' state first so any failure leaves a trace
    INSERT INTO public.imports (
        id, organization_id, kind, status, created_by, uploaded_by
    ) VALUES (
        p_import_id, p_org_id, 'soil_analysis', 'validating', auth.uid(), auth.uid()
    )
    ON CONFLICT (id) DO UPDATE SET status = 'validating', updated_at = NOW();

    IF p_file_path IS NOT NULL THEN
        INSERT INTO public.import_files (
            import_id, organization_id, file_path, storage_path, original_name, file_size, file_kind
        ) VALUES (
            p_import_id, p_org_id, p_file_path, p_file_path, p_original_name, p_file_size, 'soil_analysis'
        )
        ON CONFLICT (import_id, file_kind) DO NOTHING;
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

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_data)
    LOOP
        -- Validate point_id: must be non-null, belong to this org and this campaign
        v_point_id := (v_item->>'point_id')::uuid;
        IF v_point_id IS NULL THEN
            RAISE EXCEPTION 'point_id ausente para o ponto %', v_item->>'code';
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM public.sampling_points
            WHERE id = v_point_id
              AND organization_id = p_org_id
              AND campaign_id = p_campaign_id
        ) THEN
            RAISE EXCEPTION 'Ponto % não pertence à campanha ou organização', v_item->>'code';
        END IF;

        SELECT id INTO v_sample_id
        FROM public.samples
        WHERE sampling_point_id = v_point_id
          AND depth_from_cm = (v_item->>'depth_from_cm')::numeric
          AND depth_to_cm = (v_item->>'depth_to_cm')::numeric;

        IF v_sample_id IS NULL THEN
            v_sample_id := gen_random_uuid();
            INSERT INTO public.samples (
                id, organization_id, sampling_point_id, code, depth_from_cm, depth_to_cm
            ) VALUES (
                v_sample_id,
                p_org_id,
                v_point_id,
                v_item->>'code',
                (v_item->>'depth_from_cm')::numeric,
                (v_item->>'depth_to_cm')::numeric
            );
        END IF;

        FOR v_meas IN SELECT * FROM jsonb_array_elements(v_item->'measurements')
        LOOP
            -- Resolve attribute_id from code so joins on attribute_id work
            SELECT id INTO v_attribute_id
            FROM public.lab_attributes
            WHERE code = v_meas->>'attribute_code';

            INSERT INTO public.lab_measurements (
                organization_id, sample_id, attribute_id, attribute_code, numeric_value, text_value
            ) VALUES (
                p_org_id,
                v_sample_id,
                v_attribute_id,
                v_meas->>'attribute_code',
                (v_meas->>'numeric_value')::numeric,
                v_meas->>'text_value'
            )
            ON CONFLICT (sample_id, attribute_code) DO UPDATE
            SET numeric_value = EXCLUDED.numeric_value,
                text_value = EXCLUDED.text_value,
                attribute_id = EXCLUDED.attribute_id,
                updated_at = NOW();
        END LOOP;
    END LOOP;

    -- All rows committed — mark as done
    UPDATE public.imports
    SET status = 'committed', committed_at = NOW(), updated_at = NOW()
    WHERE id = p_import_id;

EXCEPTION WHEN OTHERS THEN
    -- Write failure status so the UI can surface it; re-raise so caller gets the error
    UPDATE public.imports
    SET status = 'failed',
        error_summary = jsonb_build_object('message', SQLERRM, 'sqlstate', SQLSTATE),
        updated_at = NOW()
    WHERE id = p_import_id;
    RAISE;
END;
$func$;
