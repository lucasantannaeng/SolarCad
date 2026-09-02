-- ==============================================================================
-- SCRIPT DE SEGURANÇA, RLS E ANTI-DUPLICIDADE — SolarCAD Supabase
-- Autor: Luca Rodrigues Gomes de Sant'Anna
-- ==============================================================================

-- 1. ÍNDICES ÚNICOS ANTI-DUPLICIDADE (Normalizados em Minúsculas e sem Espaços)
-- Impede que qualquer usuário insira inversores ou placas repetidas no sistema.

CREATE UNIQUE INDEX IF NOT EXISTS inverters_brand_model_unique 
  ON public.inverters (LOWER(TRIM(brand)), LOWER(TRIM(model)));

CREATE UNIQUE INDEX IF NOT EXISTS modules_brand_model_unique 
  ON public.modules (LOWER(TRIM(brand)), LOWER(TRIM(model)));


-- 2. HABILITAR ROW LEVEL SECURITY (RLS) NAS TABELAS DE EQUIPAMENTOS
ALTER TABLE public.inverters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;


-- 3. POLÍTICAS DE ACESSO PARA A TABELA 'inverters' (INVERSORES)

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Permitir leitura pública de inversores" ON public.inverters;
DROP POLICY IF EXISTS "Permitir inserção de inversores por usuários autenticados" ON public.inverters;
DROP POLICY IF EXISTS "Apenas admin pode atualizar ou excluir inversores" ON public.inverters;

-- LEITURA: Qualquer usuário (público, anônimo ou logado) pode consultar equipamentos
CREATE POLICY "Permitir leitura pública de inversores"
  ON public.inverters
  FOR SELECT
  USING (true);

-- INSERÇÃO: Qualquer usuário logado pode adicionar novos inversores
CREATE POLICY "Permitir inserção de inversores por usuários autenticados"
  ON public.inverters
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    brand IS NOT NULL AND TRIM(brand) <> '' AND
    model IS NOT NULL AND TRIM(model) <> '' AND
    power > 0 AND
    max_dc_voltage > 0
  );

-- ATUALIZAÇÃO / EXCLUSÃO: Apenas o administrador do sistema (via app_metadata role ou admin email configurado)
CREATE POLICY "Apenas admin pode atualizar ou excluir inversores"
  ON public.inverters
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' OR
    (auth.jwt() ->> 'email') = COALESCE(current_setting('app.admin_email', true), 'admin@solarcad.internal')
  );


-- 4. POLÍTICAS DE ACESSO PARA A TABELA 'modules' (MÓDULOS FOTOVOLTAICOS)

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Permitir leitura pública de módulos" ON public.modules;
DROP POLICY IF EXISTS "Permitir inserção de módulos por usuários autenticados" ON public.modules;
DROP POLICY IF EXISTS "Apenas admin pode atualizar ou excluir módulos" ON public.modules;

-- LEITURA: Qualquer usuário pode consultar os módulos
CREATE POLICY "Permitir leitura pública de módulos"
  ON public.modules
  FOR SELECT
  USING (true);

-- INSERÇÃO: Qualquer usuário pode cadastrar novos módulos
CREATE POLICY "Permitir inserção de módulos por usuários autenticados"
  ON public.modules
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    brand IS NOT NULL AND TRIM(brand) <> '' AND
    model IS NOT NULL AND TRIM(model) <> '' AND
    power > 0 AND
    voc > 0 AND
    isc > 0
  );

-- ATUALIZAÇÃO / EXCLUSÃO: Apenas o administrador do sistema
CREATE POLICY "Apenas admin pode atualizar ou excluir módulos"
  ON public.modules
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' OR
    (auth.jwt() ->> 'email') = COALESCE(current_setting('app.admin_email', true), 'admin@solarcad.internal')
  );


-- 5. POLÍTICAS PARA PROJETOS ('projects')

DROP POLICY IF EXISTS "Usuários gerenciam apenas seus próprios projetos" ON public.projects;

CREATE POLICY "Usuários gerenciam apenas seus próprios projetos"
  ON public.projects
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
