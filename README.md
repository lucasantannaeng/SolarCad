# ☀️ SolarCad — Web CAD Interativo para Engenharia Fotovoltaica

[![React](https://img.shields.io/badge/React-18.3-blue.svg?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-purple.svg?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC.svg?logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Auth-green.svg?logo=supabase)](https://supabase.com/)
[![DevSecOps](https://img.shields.io/badge/DevSecOps-Audited%20%26%20Sanitized-brightgreen.svg)]()

**SolarCad** é uma aplicação Web CAD (Computer-Aided Design) desenvolvida para engenheiros e projetistas de sistemas solares fotovoltaicos. A plataforma permite a criação de esquemas elétricos unifilares e trifilares em tempo real, cálculos automatizados de dimensionamento de cabos e proteções, além da geração instantânea de memoriais descritivos de engenharia em PDF.

---

## 🚀 Principais Funcionalidades

- 📐 **Diagramação Canvas 2D Interativa**: Renderização e manipulação visual de componentes elétricos fotovoltaicos (módulos, strings, inversores, stringboxes, disjuntores, DPS e barramentos) sobre um Canvas HTML5.
- ⚡ **Dimensionamento Elétrico Inteligente**:
  - Cálculo de queda de tensão em Corrente Contínua (CC) e Corrente Alternada (CA).
  - Seleção automática da bitola ideal de cabos ($mm^2$) segundo normas técnicas.
  - Dimensionamento automático de disjuntores, fusíveis e dispositivos de proteção contra surtos (DPS).
- 📋 **Gestão de Equipamentos Solar**: Cadastro e edição completa das especificações técnicas de painéis solares ($V_{oc}, I_{sc}, V_{mp}, I_{mp}$) e inversores.
- 📄 **Geração de Memoriais Descritivos em PDF**: Exportação profissional de relatórios de engenharia com esquemas, especificações e tabelas detalhadas via `jsPDF`.
- ☁️ **Sincronização em Nuvem (Supabase)**: Autenticação de usuários, persistência segura de projetos e histórico de edições com controle de acesso por linha (RLS).
- 📲 **Suporte PWA (Progressive Web App)**: Funcionamento otimizado para uso em campo e instalações em tablets e dispositivos móveis.

---

## 🛠️ Stack Tecnológica

### **Frontend & Interface**
- **Core:** React 18 + TypeScript
- **Bundler & Build Tool:** Vite
- **Estilização:** Tailwind CSS + Radix UI (shadcn/ui) + Lucide React (Ícones)
- **Visualização & Gráficos:** Canvas HTML5 2D API + Recharts

### **Engine de Documentos & Dados**
- **PDF Export:** `jsPDF` + `jspdf-autotable`
- **Formulários & Validação:** React Hook Form + Zod
- **Gerenciamento de Estado & Cache:** TanStack React Query

### **Backend & Infraestrutura**
- **Banco de Dados & Autenticação:** Supabase PostgreSQL + Supabase Auth UI
- **PWA:** `vite-plugin-pwa`

---

## ⚙️ Configuração de Variáveis de Ambiente (`.env`)

Para executar a aplicação localmente, crie um arquivo `.env` na raiz do projeto com base no modelo fornecido no `.env.example`:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://sua-instancia.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave_publica_anonima_aqui
VITE_SUPABASE_PROJECT_ID=seu_project_id_aqui
```

> 🛡️ **DevSecOps Note:** O arquivo `.env` contendo credenciais reais está estritamente bloqueado no `.gitignore` e nunca deve ser enviado ao controle de versão.

---

## 💻 Guia de Execução Local

### Pré-requisitos
- **Node.js** v18 ou superior
- Gerenciador de pacotes: **npm**, **pnpm** ou **bun**

### Passo a Passo

1. **Clonar o Repositório:**
   ```bash
   git clone https://github.com/lucasantannaeng/SolarCad.git
   cd SolarCad
   ```

2. **Instalar Dependências:**
   ```bash
   npm install
   # ou
   bun install
   ```

3. **Configurar as Variáveis de Ambiente:**
   ```bash
   cp .env.example .env
   # Edite o arquivo .env preenchendo as credenciais do seu projeto Supabase
   ```

4. **Iniciar o Servidor de Desenvolvimento:**
   ```bash
   npm run dev
   # ou
   bun dev
   ```
   Acesse no navegador: `http://localhost:8080` (ou porta informada no terminal).

---

## 📜 Scripts Disponíveis

- `npm run dev`: Inicia o servidor de desenvolvimento Vite.
- `npm run build`: Compila e gera os artefatos otimizados de produção na pasta `dist/`.
- `npm run preview`: Executa a visualização da versão compilada de produção.
- `npm run lint`: Executa a verificação estática do código com ESLint.
- `npm run test`: Executa os testes unitários utilizando Vitest.

---

## 🔒 Conformidade DevSecOps

Este repositório passa por auditorias continuadas de segurança:
- Zero credenciais, tokens JWT ou senhas em hardcode no código-fonte.
- Bloqueio completo de artefatos temporários, `.env` e `node_modules` no `.gitignore`.
- Versionamento limpo seguindo as diretrizes recomendadas pela OWASP.
