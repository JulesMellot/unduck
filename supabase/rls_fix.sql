-- Suppression de la contrainte RLS existante
ALTER TABLE public.bangs DISABLE ROW LEVEL SECURITY;

-- Ou, si vous préférez garder RLS activé, ajoutez une politique qui permet toutes les opérations pour les utilisateurs authentifiés :
-- CREATE POLICY "Allow all operations for authenticated users" ON public.bangs
-- FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Si vous voulez une approche plus restrictive, vous pouvez créer des politiques spécifiques :
-- CREATE POLICY "Select for all users" ON public.bangs FOR SELECT USING (true);
-- CREATE POLICY "Insert for authenticated users" ON public.bangs FOR INSERT TO authenticated WITH CHECK (true);
-- CREATE POLICY "Update for authenticated users" ON public.bangs FOR UPDATE TO authenticated USING (true);
-- CREATE POLICY "Delete for authenticated users" ON public.bangs FOR DELETE TO authenticated USING (true);

-- Pour l'instant, nous désactivons simplement RLS pour permettre le fonctionnement de l'application