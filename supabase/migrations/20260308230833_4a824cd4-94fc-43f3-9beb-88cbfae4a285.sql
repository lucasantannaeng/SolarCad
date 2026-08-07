
-- 1. Create app_role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 3. RLS policy: only admins can manage user_roles, users can read their own
CREATE POLICY "Admins manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can read own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 4. Seed the admin user role (lucasantannaeng@gmail.com)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'lucasantannaeng@gmail.com'
ON CONFLICT DO NOTHING;

-- 5. Update RLS policies on inverters: replace email check with has_role
DROP POLICY IF EXISTS "Admin inversores" ON public.inverters;
CREATE POLICY "Admin inversores"
ON public.inverters
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. Update RLS policies on modules: replace email check with has_role
DROP POLICY IF EXISTS "Admin módulos" ON public.modules;
CREATE POLICY "Admin módulos"
ON public.modules
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 7. Update RLS policy on projects: replace email check with has_role
DROP POLICY IF EXISTS "Acesso a projetos: Dono ou Admin" ON public.projects;
CREATE POLICY "Acesso a projetos: Dono ou Admin"
ON public.projects
FOR ALL
TO authenticated
USING ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK ((auth.uid() = user_id) OR public.has_role(auth.uid(), 'admin'));
