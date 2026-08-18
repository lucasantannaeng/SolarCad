# ☀️ SolarCad — Interactive Web CAD for Photovoltaic Engineering

[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Vitest-Passing-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![AutoCAD DXF](https://img.shields.io/badge/AutoCAD-DXF%20R12%20Export-red.svg)]()
[![NBR Standards](https://img.shields.io/badge/Standards-NBR%205410%20%7C%20NBR%2016690-blue.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Cloud-native Web CAD for Solar PV Single-Line Diagrams (SLD), regulatory compliance sizing (NBR 5410 & NBR 16690), interactive Pan/Zoom, and automated AutoCAD DXF / PDF export.**

---

## 🌟 Overview

**SolarCad** is a purpose-built Computer-Aided Design (CAD) platform engineered for photovoltaic design engineers. It automates the generation of compliant Single-Line Diagrams (SLD), sizing calculations for DC/AC protection devices, conductor cross-sections, and utility approval documentation for Brazilian distribution companies (Enel, CPFL, Light, Cemig, Equatorial).

---

## 🚀 Key Features

* 📐 **Interactive Canvas CAD Workspace (`DiagramCanvas.tsx`)**:
  * Real-time 2D rendering of PV modules, string arrays, central/micro-inverters, stringboxes, AC distribution boards, and utility meter connection points.
  * **Interactive Pan & Zoom (50% to 250%)**: Smooth navigation, zoom controls, and instant 100% canvas reset.
  * Line weight hierarchy adhering to technical drawing standards (Power conductors `0.55mm`, Symbols `0.30mm`, Border `0.40mm`).
* ⚡ **Automated Engineering Calculations (`engineering.ts`)**:
  * **Conductor Sizing & Ampacity:** Automatic cross-section determination ($mm^2$) based on current capacity and thermal correction factors.
  * **Circuit Breakers (NBR 5410):** Sizing curves ($1.25\times I_n$) with standard commercial ratings (40A, 50A, 63A, 70A, etc.) and polarity detection (Bipolar/Tripolar).
  * **DC Voltage & Thermal Limits (NBR 16690):** String $V_{oc}$ calculation with low-temperature safety factor ($1.15\times$) against inverter maximum DC input voltage.
* 📄 **Multi-Format Export Engine**:
  * **AutoCAD DXF (R12/R2000):** Vector export with structured layers (`FRAME`, `EQUIPMENT`, `POWER`, `DC_CABLE`, `TEXT`) ready for direct import into AutoCAD.
  * **Print-Ready PDF Memorial:** Landscape A4 high-resolution PDF generation with technical title blocks and client metadata.
* ☁️ **Cloud Projects & Database Persistence**: Supabase PostgreSQL with user-isolated Row-Level Security (RLS).

---

## 🏗️ Architecture

```
SolarCad/
├── src/
│   ├── components/
│   │   ├── DiagramCanvas.tsx       # 2D Interactive Canvas with Pan/Zoom & DXF exports
│   │   ├── ProjectForm.tsx         # Client, engineering, and utility input form
│   │   └── EquipmentBlockForm.tsx  # Inverter and string configuration form
│   ├── services/
│   │   ├── dxfExporter.ts          # AutoCAD DXF R12 ASCII vector generator
│   │   ├── engineering.ts          # NBR 5410 & NBR 16690 calculation engine
│   │   └── pdfService.ts           # jsPDF engineering report generator
│   ├── test/
│   │   └── engineering.test.ts     # Vitest automated test suite for electrical calculations
│   ├── constants/                  # Standard breakers, paper sizes & voltage levels
│   └── types/                      # TypeScript schemas & interfaces
├── package.json
└── vite.config.ts
```

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Framework** | React 18, TypeScript 5.8 |
| **Build & Tooling** | Vite 5, Tailwind CSS, Shadcn UI / Radix |
| **CAD & Vector Engines** | HTML5 Canvas 2D API, Custom DXF R12 Serializer, jsPDF |
| **State & Persistence** | TanStack React Query, Supabase PostgreSQL |
| **Testing** | Vitest |

---

## ⚡ Getting Started

### 1. Prerequisites
* Node.js `>= 18.0.0`
* npm or pnpm

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/lucasantannaeng/SolarCad.git
cd SolarCad

# Install dependencies
npm install

# Setup environment configuration
cp .env.example .env
```

### 3. Development Server

```bash
npm run dev
```

The application will run locally at `http://localhost:5173`.

---

## 🧪 Testing

```bash
# Run Vitest test suite
npm test

# Build production bundle
npm run build
```

---

## 📄 License

Licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
Authored by **Luca Rodrigues Gomes de Sant'Anna**.
