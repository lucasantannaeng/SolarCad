-- Fix RESTRICTIVE-only RLS policies by converting them to PERMISSIVE
-- This migration recreates all policies without the AS RESTRICTIVE clause

-- Drop and recreate policies for modules table
DROP POLICY IF EXISTS "Admin módulos" ON public.modules;
DROP POLICY IF EXISTS "Leitura de módulos" ON public.modules;

CREATE POLICY "Admin módulos"
  ON public.modules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Leitura de módulos"
  ON public.modules FOR SELECT TO authenticated
  USING (true);

-- Drop and recreate policies for inverters table
DROP POLICY IF EXISTS "Admin inversores" ON public.inverters;
DROP POLICY IF EXISTS "Leitura de inversores" ON public.inverters;

CREATE POLICY "Admin inversores"
  ON public.inverters FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Leitura de inversores"
  ON public.inverters FOR SELECT TO authenticated
  USING (true);

-- Drop and recreate policies for projects table
DROP POLICY IF EXISTS "Acesso a projetos: Dono ou Admin" ON public.projects;

CREATE POLICY "Acesso a projetos: Dono ou Admin"
  ON public.projects FOR ALL TO authenticated
  USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

-- Drop and recreate policies for project_equipment table
DROP POLICY IF EXISTS "Usuários gerenciam equipamentos de seus projetos" ON public.project_equipment;

CREATE POLICY "Usuários gerenciam equipamentos de seus projetos"
  ON public.project_equipment FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projects
    WHERE projects.id = project_equipment.project_id
      AND projects.user_id = auth.uid()
  ));

-- Drop and recreate policies for user_roles table
DROP POLICY IF EXISTS "Admins manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;

CREATE POLICY "Admins manage all roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);