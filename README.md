# ☀️ SolarCad — Interactive Web CAD & Desktop Suite for Photovoltaic Engineering

[![Version](https://img.shields.io/badge/Version-1.2.0-blue.svg)](package.json)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-34.0-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Vitest-69%20Passed-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
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

* 📐 **Interactive Canvas CAD Workspace (`DiagramCanvas.tsx`)**:
  * Real-time 2D vector rendering of PV module strings, central string inverters, microinverter trunks (daisy-chain), stringboxes, AC distribution boards, and bidirectional utility meters.
  * **Interactive Pan & Zoom (50% to 250%)** with hardware-accelerated rendering and smooth viewport resets.
  * Technical drawing hierarchy adhering to ABNT standards (Conductors `0.55mm`, Symbols `0.30mm`, Border `0.40mm`).

* ⚡ **Regulatory Electrical Sizing Engines (`engineering.ts`, `dcProtection.ts`, `transformerDecision.ts`)**:
  * **DC Protection (NBR 16690):** Automatic calculation of gPV string fuses ($1.5\times I_{sc}$), DC disconnect switches, and Class II Surge Protection Devices (DPS CC 600V/1000V/1500V).
  * **DC/AC Conductor Sizing:** Iterative voltage drop ($\Delta V \le 1.5\%$) and current capacity calculations for PV Solar 1.5kV/1.8kV and XLPE/PVC AC cables.
  * **Substation & Transformer Decision Engine:** Phase matrix algorithm (12 combinatorial scenarios) with automatic kVA sizing ($P_{trafo} \ge 1.2\times P_{inv}$).
  * **MPPT Thermal & Clipping Verifications:** Real-time validation of string currents against inverter limits, preventing thermal tripping and clipping.

* 📋 **Automated Utility Grid Access Forms Generator (Formulários de Homologação GD)**:
  * **ENEL Distribuição RJ:** Direct filling of official Excel rateio sheets (`Formulario_Rateio_ENEL_Rj.xlsm`) and access requests.
  * **LIGHT Serviços de Eletricidade:** Automated generation of Annex IV access request forms.
  * **CERCI & ENERGISA:** Automated PDF form population adhering to specific concessionaire requirements.

* 💰 **Marco Legal da GD Credit Distribution Engine (Lei 14.300 / ANEEL)**:
  * Beneficiary consumer unit registration, credit percentage allocation matrix, and monthly energy generation simulation ($kWh/\text{month}$).

* 📄 **Multi-Format Export Engine**:
  * **AutoCAD DXF (R12/R2000):** Clean layered vector export (`FRAME`, `EQUIPMENT`, `POWER`, `DC_CABLE`, `TEXT`) for seamless CAD import.
  * **Print-Ready PDF Dossier:** High-resolution Landscape A4 engineering report with technical title block, calculation memorial, and client metadata.

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
* Mechanical Engineer (CREA-RJ) | Senior Full-Stack & AI Systems Engineer
* Email: [lucasantannaeng@gmail.com](mailto:lucasantannaeng@gmail.com)
* GitHub: [@lucasantannaeng](https://github.com/lucasantannaeng)

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
