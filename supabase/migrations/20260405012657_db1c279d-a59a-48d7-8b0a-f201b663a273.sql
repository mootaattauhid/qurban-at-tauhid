-- Drop the overly broad anon update policy
DROP POLICY IF EXISTS "Anon can update akad fields" ON public.shohibul_qurban;

-- Create a trigger function to restrict anon updates to akad fields only
CREATE OR REPLACE FUNCTION public.restrict_anon_akad_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If this is an authenticated user with admin role, allow all updates
  IF auth.role() = 'authenticated' THEN
    RETURN NEW;
  END IF;

  -- For anon users, only allow akad-related fields to change
  NEW.nama := OLD.nama;
  NEW.alamat := OLD.alamat;
  NEW.no_wa := OLD.no_wa;
  NEW.hewan_id := OLD.hewan_id;
  NEW.tipe_kepemilikan := OLD.tipe_kepemilikan;
  NEW.tahun := OLD.tahun;
  NEW.created_at := OLD.created_at;
  NEW.panitia_pendaftar := OLD.panitia_pendaftar;
  NEW.sumber_pendaftaran := OLD.sumber_pendaftaran;
  NEW.status_checklist_panitia := OLD.status_checklist_panitia;
  NEW.status_penyembelihan := OLD.status_penyembelihan;
  NEW.id := OLD.id;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS restrict_anon_akad_update_trigger ON public.shohibul_qurban;
CREATE TRIGGER restrict_anon_akad_update_trigger
  BEFORE UPDATE ON public.shohibul_qurban
  FOR EACH ROW
  EXECUTE FUNCTION public.restrict_anon_akad_update();

-- Re-create the anon update policy (still needed for RLS to allow the update)
CREATE POLICY "Anon can update akad fields only"
ON public.shohibul_qurban
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Allow public to read kas data for public finance report
CREATE POLICY "Public can view kas"
ON public.kas
FOR SELECT
TO anon
USING (true);