# ☀️ SolarCad — Interactive Web CAD & Desktop Suite for Photovoltaic Engineering

[![Version](https://img.shields.io/badge/Version-1.3.0-blue.svg)](package.json)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-34.0-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Vitest-179%20Passed%20(100%25)-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![AutoCAD DXF](https://img.shields.io/badge/AutoCAD-DXF%20R12%20Export-red.svg)]()
[![Standards](https://img.shields.io/badge/Standards-NBR%205410%20%7C%20NBR%2016690%20%7C%20Lei%2014.300-blue.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Enterprise-grade Computer-Aided Design (CAD) & Sizing Suite for Solar PV Single-Line Diagrams (SLD), regulatory compliance (NBR 5410 & NBR 16690), automated Utility Access Forms (ENEL, LIGHT, CERCI, ENERGISA), Marco Legal da GD (Lei 14.300) rateio generation, and AutoCAD DXF / PDF export.**

---

## 🌟 Overview

**SolarCad** is a professional-grade engineering platform built for photovoltaic engineers, EPC contractors, and design consultancies. It automates the generation of Single-Line Diagrams (SLD), technical calculation dossiers, electrical protection device sizing, and utility grid access documentation across Brazilian energy distributors.

Available as both a **Cloud-Native Web Application** and a **Standalone Offline Desktop Application (Windows .exe)**.

---

## 🚀 Key Features

* 📐 **Interactive Multi-Mode CAD Workspace (`DiagramCanvas.tsx`)**:
  * **Modo 1 — Unifilar Padrão NBR:** Linha única com simbologia normatizada, String Box CC, QDS CA, barramentos e padrão da concessionária.
  * **Modo 2 — Multifilar / Trifilar (NBR 5410):** Esquema de fases detalhado com condutores individuais (R - Preto, S - Cinza, T - Vermelho), Neutro (Azul Claro) e Terra/PE (Verde).
  * **Modo 3 — Comunicação & Modbus RTU (Modbus-IDA / IEC 60870-5):** Topologia serial Daisy-Chain de par trançado blindado STP 2x24 AWG com terminação 120Ω, régua de bornes A(+)/B(-)/SHD, Smart Meter 4 quadrantes e TCs toroidais bipartidos.
  * **Interactive Pan & Zoom (40% a 300%)** com alternador A4/A3 instantâneo e botão de ajuste automático à tela.

* 🧠 **Deterministic String Optimization Engine (`stringOptimizer.ts`)**:
  * Dimensionamento fotovoltaico determinístico NBR 16690 com correção térmica de $V_{oc,max}$ (-0.28%/°C) e $V_{mp,min}$ (-0.35%/°C).
  * Overpowering/FDI ideal de 120% a 130% e balanceamento simétrico de strings por MPPT.
  * Suporte nativo completo a Microinversores (Hoymiles, Deye Micro, APsystems, NEP, TSUN) por canal independente.

* 🏠 **2D Interactive Roof & String Mapping (`StringRoofMapping.tsx`)**:
  * Planta esquemática 2D organizada por águas reais da cobertura e solo.
  * Parametrização completa: Estrutura (Cerâmica, Metálica, Fibrocimento, Laje, Solo, Carport), Azimute Solar (0° a 359°) com rosa dos ventos e Inclinação Tilt (10° a 25°).

* ⚖️ **Executive Power of Attorney Generator (`powerOfAttorneyService.ts`)**:
  * Emissão de Procuração Específica para Homologação GD em PDF executivo (Lei Federal 14.300/2022 e REN ANEEL 1.000/2021).
  * Cards institucionais para Outorgante e Outorgado, alíneas de poderes específicos e assinaturas desobstruídas.

* ⚡ **Regulatory Electrical Sizing Engines (`engineering.ts`, `groundingCalculation.ts`, `dcProtection.ts`)**:
  * **Proteção CC (NBR 16690):** Fusíveis gPV ($1.5\times I_{sc}$), chave seccionadora CC e DPS Classe II (1000V).
  * **Aterramento NBR 5419:** Dimensionamento de malha e hastes de aço cobreado 5/8" x 2.40m com caixa de inspeção.
  * **Correção FCT & FCA:** Fatores de agrupamento e temperatura sob telhado da NBR 5410.

* 📋 **Multi-Utility Grid Access Suite (Homologação GD)**:
  * Formulários oficiais automatizados para **Light (RECON-BT)**, **Enel RJ (CNC-GD)**, **CERCI** e **Energisa (NDU-013)**.
  * Preenchimento direto de planilhas oficiais de rateio (`Formulario_Rateio_ENEL_Rj.xlsm`).
  * Validador Pré-Protocolo com 5 pilares e alerta normativo de endereço completo das distribuidoras.

* 📄 **Multi-Format Export Engine**:
  * **AutoCAD DXF com Blocos Nomeados:** Exportação em camadas com blocos padrão oficiais do AutoCAD (`BLOCK_INVERSOR`, `BLOCK_DISJUNTOR`, `BLOCK_MEDIDOR`, etc.).
  * **Dossiê PDF de Engenharia:** Relatório de alta resolução com pranchas A4/A3, memorial de cálculo e ART/TRT.

---

## 🏗️ System Architecture

```
SolarCad/
├── electron/                   # Desktop application main process & IPC handlers
│   ├── main.cjs
│   └── preload.cjs
├── public/templates/           # Official utility access form templates (.xlsm, .pdf)
├── src/
│   ├── components/
│   │   ├── DiagramCanvas.tsx   # 2D Interactive Vector Canvas with Pan/Zoom
│   │   ├── ProjectForm.tsx     # Client, grid voltage, and utility metadata
│   │   └── EquipmentBlockForm.tsx # Inverter string & module parameterization
│   ├── services/
│   │   ├── cerciFormService.ts       # CERCI utility form generator
│   │   ├── creditDistribution.ts     # Lei 14.300 credit allocation engine
│   │   ├── dcProtection.ts           # NBR 16690 DC stringbox & fuse sizing
│   │   ├── dxfExporter.ts            # AutoCAD DXF R12 vector generator
│   │   ├── enelAccessFormService.ts  # ENEL RJ access form generator
│   │   ├── enelFormService.ts        # ENEL RJ official Excel rateio generator
│   │   ├── energisaFormService.ts    # ENERGISA utility form generator
│   │   ├── engineering.ts            # NBR 5410 electrical calculations engine
│   │   ├── lightFormService.ts       # LIGHT S.A. utility form generator
│   │   ├── pdfService.ts             # jsPDF technical drawing & memorial generator
│   │   └── transformerDecision.ts    # Trafo & phase matrix sizing engine
│   ├── test/                         # Vitest automated test suite (69 tests)
│   ├── constants/                    # Standard breakers, cables & utility catalogs
│   └── types/                        # Strongly-typed TypeScript interfaces
├── package.json
└── vite.config.ts
```

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | React 18.3, TypeScript 5.8 |
| **Desktop Runtime** | Electron 34, Electron Builder |
| **Build & Styling** | Vite 5.4, Tailwind CSS 3.4, Radix UI / Lucide Icons |
| **CAD & Vector Engines** | HTML5 Canvas 2D API, Custom DXF R12 Serializer, jsPDF, ExcelJS |
| **Testing & Quality** | Vitest 3.2 (69 unit/integration tests, 100% pass) |
| **Backend & Cloud** | Supabase PostgreSQL, Row-Level Security (RLS) |

---

## ⚡ Quickstart & Installation

### 1. Prerequisites
* Node.js `>= 18.0.0`
* npm or pnpm

### 2. Setup
```bash
# Clone the repository
git clone https://github.com/lucasantannaeng/SolarCad.git
cd SolarCad

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
```

### 3. Run Development Web Server
```bash
npm run dev
```

### 4. Run Automated Test Suite
```bash
npm test
```

### 5. Build Desktop Application (Windows .exe)
```bash
npm run electron:build
```

---

## 🔒 Security & DevSecOps

This repository enforces **Zero-Trust DevSecOps standards**:
- All secret environment keys (`.env*`, `credentials.json`) are excluded from version control.
- Desktop compilation binaries (`release/`, `dist-electron/`, `*.exe`, `*.asar`) are blocked from commits.
- Automated static analysis and TypeScript compile checks (`npx tsc --noEmit`) run before every release.

---

## 👤 Author

**Luca Rodrigues Gomes de Sant'Anna**
* Mechanical Engineer (CREA-RJ) | Full-Stack Developer
* Email: [lucasantannaeng@gmail.com](mailto:lucasantannaeng@gmail.com)
* GitHub: [@lucasantannaeng](https://github.com/lucasantannaeng)

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
