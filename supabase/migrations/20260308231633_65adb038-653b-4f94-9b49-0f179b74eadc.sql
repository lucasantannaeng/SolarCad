
-- Fix: All RLS policies are RESTRICTIVE (non-functional). Recreate as PERMISSIVE.

-- 1. inverters
DROP POLICY IF EXISTS "Admin inversores" ON public.inverters;
DROP POLICY IF EXISTS "Leitura de inversores" ON public.inverters;

CREATE POLICY "Admin inversores"
ON public.inverters FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Leitura de inversores"
ON public.inverters FOR SELECT TO authenticated
USING (true);

-- 2. modules
DROP POLICY IF EXISTS "Admin módulos" ON public.modules;
DROP POLICY IF EXISTS "Leitura de módulos" ON public.modules;

CREATE POLICY "Admin módulos"
ON public.modules FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Leitura de módulos"
ON public.modules FOR SELECT TO authenticated
USING (true);

-- 3. projects
DROP POLICY IF EXISTS "Acesso a projetos: Dono ou Admin" ON public.projects;

CREATE POLICY "Acesso a projetos: Dono ou Admin"
ON public.projects FOR ALL TO authenticated
USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'));

-- 4. project_equipment
DROP POLICY IF EXISTS "Usuários gerenciam equipamentos de seus projetos" ON public.project_equipment;

CREATE POLICY "Usuários gerenciam equipamentos de seus projetos"
ON public.project_equipment FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = project_equipment.project_id
    AND projects.user_id = auth.uid()
));

-- 5. user_roles
DROP POLICY IF EXISTS "Admins manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;

CREATE POLICY "Admins manage all roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);
