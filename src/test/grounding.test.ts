import { describe, it, expect } from 'vitest';
import {
  TABLE_40_FCT_PVC,
  TABLE_40_FCT_EPR_XLPE,
  TABLE_42_FCA,
  getFCT,
  getFCA,
  calculateCorrectedCurrent,
  calculateShortCircuitAndI2t,
  calculateNominalCurrent,
  suggestBreaker,
  getBlockEngineeringStatus,
  getProjectEngineeringStatus,
} from '../services/engineering';
import {
  getCableForCurrent,
  getDcCable,
  cableTable,
  dcCableTable,
} from '../components/diagram/cableCalculations';
import {
  calculateSingleRodResistance,
  calculateGridResistance,
  dimensionGroundingConductor,
  specifyInspectionBox,
  calculateGroundingGrid,
} from '../services/groundingCalculation';
import { ProjectState, UtilityCompany, ConnectionType, VoltageLevel } from '../types';

describe('SolarCAD - Cálculos Elétricos e Normas NBR (NBR 5410, NBR 16690, NBR 5419)', () => {
  // ═════════════════════════════════════════════════════════════════
  // 1. FATORES DE CORREÇÃO TÉRMICA E AGRUPAMENTO (FCT & FCA — NBR 5410)
  // ═════════════════════════════════════════════════════════════════
  describe('Fatores de Correção Térmica (FCT) — Tabela 40 NBR 5410', () => {
    it('deve retornar fatores corretos da Tabela 40 para condutores com isolação PVC (70°C)', () => {
      expect(getFCT(10, 'PVC')).toBe(1.22);
      expect(getFCT(15, 'PVC')).toBe(1.17);
      expect(getFCT(20, 'PVC')).toBe(1.12);
      expect(getFCT(25, 'PVC')).toBe(1.06);
      expect(getFCT(30, 'PVC')).toBe(1.00); // Temperatura de referência
      expect(getFCT(35, 'PVC')).toBe(0.94);
      expect(getFCT(40, 'PVC')).toBe(0.87);
      expect(getFCT(45, 'PVC')).toBe(0.79);
      expect(getFCT(50, 'PVC')).toBe(0.71);
      expect(getFCT(55, 'PVC')).toBe(0.61);
      expect(getFCT(60, 'PVC')).toBe(0.50); // Sob telhado / exposição solar direta
      expect(getFCT(65, 'PVC')).toBe(0.35);
    });

    it('deve retornar fatores corretos da Tabela 40 para cabos solares CC e cabos XLPE/EPR (90°C)', () => {
      expect(getFCT(10, 'XLPE')).toBe(1.15);
      expect(getFCT(20, 'XLPE')).toBe(1.08);
      expect(getFCT(30, 'XLPE')).toBe(1.00); // Temperatura de referência
      expect(getFCT(35, 'XLPE')).toBe(0.96);
      expect(getFCT(40, 'XLPE')).toBe(0.91);
      expect(getFCT(45, 'XLPE')).toBe(0.87);
      expect(getFCT(50, 'XLPE')).toBe(0.82);
      expect(getFCT(55, 'XLPE')).toBe(0.76);
      expect(getFCT(60, 'XLPE')).toBe(0.71); // Sob telhado fotovoltaico
      expect(getFCT(70, 'XLPE')).toBe(0.58);
      expect(getFCT(80, 'XLPE')).toBe(0.41);
    });

    it('deve interpolar linearmente para temperaturas não tabeladas', () => {
      // Entre 30°C (1.00) e 35°C (0.94) para PVC -> 32.5°C = 0.97
      const fct32_5 = getFCT(32.5, 'PVC');
      expect(fct32_5).toBeCloseTo(0.97, 2);
    });
  });

  describe('Fatores de Agrupamento (FCA) — Tabela 42 NBR 5410', () => {
    it('deve retornar fatores de agrupamento corretos para condutos fechados / eletrodutos', () => {
      expect(getFCA(1)).toBe(1.00);
      expect(getFCA(2)).toBe(0.80);
      expect(getFCA(3)).toBe(0.70);
      expect(getFCA(4)).toBe(0.65);
      expect(getFCA(5)).toBe(0.60);
      expect(getFCA(6)).toBe(0.57);
      expect(getFCA(7)).toBe(0.54);
      expect(getFCA(8)).toBe(0.52);
      expect(getFCA(9)).toBe(0.50);
      expect(getFCA(12)).toBe(0.45);
      expect(getFCA(16)).toBe(0.41);
      expect(getFCA(20)).toBe(0.38);
    });
  });

  describe('Cálculo de Corrente Corrigida Iz = In / (FCT * FCA)', () => {
    it('deve calcular a corrente corrigida de projeto conforme ABNT NBR 5410', () => {
      // Exemplo: Corrente nominal In = 32 A, Temp = 40°C PVC (FCT = 0.87), 2 circuitos agrupados (FCA = 0.80)
      // Iz_req = 32 / (0.87 * 0.80) = 32 / 0.696 = 45.98 A
      const fct = getFCT(40, 'PVC');
      const fca = getFCA(2);
      const izReq = calculateCorrectedCurrent(32, fct, fca);
      expect(izReq).toBeCloseTo(45.98, 1);
    });

    it('deve dimensionar condutores CA garantindo Iz >= In sob condições térmicas e de agrupamento severas', () => {
      const mockTech: any = {
        voltage: VoltageLevel.V_127_220,
        connectionType: ConnectionType.TRIPHASIC,
        distance: 20,
        mainBreaker: 63,
      };

      // 10 kW em 220/380V -> In = 10000 / (sqrt(3)*220) = 26.24A
      const inNominal = 26.24;

      // Condição padrão (30°C, 1 circuito): FCT=1.0, FCA=1.0
      const standardCable = getCableForCurrent(inNominal, mockTech);
      expect(standardCable.fct).toBe(1.0);
      expect(standardCable.fca).toBe(1.0);

      // Condição sob telhado (45°C, 3 circuitos agrupados): FCT=0.79, FCA=0.70
      const harshCable = getCableForCurrent(inNominal, mockTech, {
        ambientTemp: 45,
        circuitCount: 3,
        insulation: 'PVC',
      });

      expect(harshCable.fct).toBe(0.79);
      expect(harshCable.fca).toBe(0.70);
      // Iz requerido = 26.24 / (0.79 * 0.70) = 47.45 A
      expect(parseFloat(harshCable.correctedCurrent)).toBeGreaterThanOrEqual(47.0);

      // A seção do cabo sob condição severa deve ser superior à condição padrão
      const standardSection = parseFloat(standardCable.cableSimple.replace('mm²', '').replace(',', '.'));
      const harshSection = parseFloat(harshCable.cableSimple.replace('mm²', '').replace(',', '.'));
      expect(harshSection).toBeGreaterThanOrEqual(standardSection);
    });

    it('deve dimensionar condutores CC para strings solares com correção a 60°C sob telhado', () => {
      // Módulo 550W: Isc = 14.0A, 2 strings em paralelo
      // I_projeto = 14.0 * 1.25 * 2 = 35.0 A
      // A 60°C sob telhado em XLPE: FCT = 0.71, 1 circuito -> FCA = 1.0
      // I_corrigida = 35.0 / 0.71 = 49.30 A
      const dcCable = getDcCable(14.0, 2, 800, 20, { temp: 60, circuitCount: 1 });
      expect(dcCable.fct).toBe(0.71);
      expect(dcCable.fca).toBe(1.0);
      expect(dcCable.correctedDesignCurrent).toBeCloseTo(49.30, 1);
      // Cabo mínimo de 10mm² tem capacidade 61A > 49.30A
      expect(dcCable.section).toBeGreaterThanOrEqual(10.0);
      expect(dcCable.voltageDrop).toBeLessThanOrEqual(1.5);
    });
  });

  // ═════════════════════════════════════════════════════════════════
  // 2. DIMENSIONAMENTO DA MALHA E ELETRODOS DE ATERRAMENTO (NBR 5419 / NBR 16690)
  // ═════════════════════════════════════════════════════════════════
  describe('Dimensionamento de Aterramento e Eletrodos (groundingCalculation.ts)', () => {
    it('deve calcular a resistência elétrica de uma única haste de aterramento 5/8" x 2,40m pela fórmula de Dwight', () => {
      // Para solo com resistividade de 150 Ω·m:
      // R1 = (150 / (2 * pi * 2.4)) * (ln(4 * 2.4 / 0.015875) - 1) = 9.947 * (6.4047 - 1) = 9.947 * 5.4047 = 53.76 Ω
      const r1 = calculateSingleRodResistance(150, 2.40, 0.015875);
      expect(r1).toBeCloseTo(53.76, 1);
    });

    it('deve calcular a resistência equivalente da malha em arranjo triângulo e alinhado', () => {
      const r1 = 53.76;
      // 3 hastes em triângulo: eta = 0.85 -> Req = 53.76 / (3 * 0.85) = 21.08 Ω
      const rTri = calculateGridResistance(r1, 3, 'TRIANGLE');
      expect(rTri).toBeCloseTo(21.08, 1);

      // 4 hastes: eta = 0.80 -> Req = 53.76 / (4 * 0.80) = 16.80 Ω
      const r4 = calculateGridResistance(r1, 4, 'ALIGNED');
      expect(r4).toBeCloseTo(16.80, 1);
    });

    it('deve dimensionar os condutores de aterramento e proteção PE conforme NBR 5410 Tabela 58 e NBR 16690', () => {
      // Para circuito de fase de 10mm²:
      // Cabo enterrado cobre nu: 25mm² (mínimo NBR 5419 / NBR 5410)
      // Condutor PE verde: Spe = S = 10mm² (mínimo 6mm² para solar)
      // Equipotencialização de módulos: 6mm²
      const cond10 = dimensionGroundingConductor(10.0, false, true);
      expect(cond10.mainBareCopperSectionMm2).toBe(25);
      expect(cond10.peProtectionSectionMm2).toBe(10);
      expect(cond10.moduleEquipotentialSectionMm2).toBe(6);

      // Para circuito de fase de 50mm² (> 35mm²):
      // Condutor PE verde: Spe = S / 2 = 25mm²
      // Condutor cobre nu enterrado: 35mm²
      const cond50 = dimensionGroundingConductor(50.0, false, true);
      expect(cond50.mainBareCopperSectionMm2).toBe(35);
      expect(cond50.peProtectionSectionMm2).toBe(25);
    });

    it('deve especificar adequadamente a caixa de inspeção de solo com tampa de concreto e suspensa PVC', () => {
      const concreteBox = specifyInspectionBox('GROUND_CONCRETE');
      expect(concreteBox.type).toBe('Caixa de Inspeção Solo com Tampa de Concreto');
      expect(concreteBox.cover).toContain('concreto');
      expect(concreteBox.measurementConnector).toContain('cabo-haste');

      const wallBox = specifyInspectionBox('WALL_PVC');
      expect(wallBox.type).toBe('Caixa de Inspeção Suspensa PVC');
      expect(wallBox.material).toContain('PVC');
      expect(wallBox.measurementConnector).toContain('BEP');
    });

    it('deve executar o cálculo completo da malha de aterramento para um projeto fotovoltaico comercial', () => {
      const mockProject: ProjectState = {
        client: {
          name: 'Empresa Solar RJ',
          document: '11.222.333/0001-44',
          email: 'contato@empresa.com',
          phone: '2199999999',
          utilityId: '88776655',
          art: 'ART-2026-99',
          address: { street: 'Av. Brasil', number: '1000', neighborhood: 'Centro', city: 'Rio de Janeiro', state: 'RJ', zipCode: '20000-000' },
        },
        engineer: { name: 'Eng. Luca', crea: '123456-RJ' },
        technical: {
          utility: UtilityCompany.LIGHT,
          connectionType: ConnectionType.TRIPHASIC,
          voltage: VoltageLevel.V_127_220,
          mainBreaker: 100,
          distance: 25,
          dcCableDistance: 15,
        },
        equipmentBlocks: [
          {
            id: 1,
            moduleId: 1,
            inverterId: 1,
            module: { id: 1, brand: 'Canadian', model: 'CS6W-550MS', power: 550, voc: 49.8, vmp: 41.5, isc: 14.0, imp: 13.25 },
            moduleBrand: 'Canadian',
            moduleModel: 'CS6W-550MS',
            modulePowerW: 550,
            moduleQty: 40, // 22 kWp
            inverter: { id: 1, brand: 'Growatt', model: 'MAX 20K', power: 20.0, nominalOutputVoltage: 220, maxDcVoltage: 1000, maxInputCurrent: 30.0, mpptMin: 200, mpptMax: 850, mpptCount: 2, outputPhases: 3, inverterType: 'string' },
            inverterBrand: 'Growatt',
            inverterModel: 'MAX 20K',
            inverterPowerKw: 20.0,
            inverterQty: 1,
            strings: [{ id: 1, count: 20 }, { id: 2, count: 20 }],
          },
        ],
        paperSize: 'A3',
      };

      const groundingResult = calculateGroundingGrid(mockProject, {
        soilResistivity: 150,
        targetResistance: 10.0,
        arrangementPreference: 'AUTO',
      });

      expect(groundingResult.rodSpec.quantity).toBeGreaterThanOrEqual(3);
      expect(groundingResult.rodSpec.lengthMeters).toBe(2.40);
      expect(groundingResult.rodSpec.diameterInches).toBe('5/8"');
      expect(groundingResult.conductorSpec.mainBareCopperSectionMm2).toBe(25);
      expect(groundingResult.inspectionBoxSpec.type).toContain('Caixa de Inspeção');
      expect(groundingResult.credits.some(c => c.includes('NBR 5410') || c.includes('NBR 16690') || c.includes('PROJETO MICRO INVERSOR-3.xlsm'))).toBe(true);
    });
  });

  // ═════════════════════════════════════════════════════════════════
  // 3. VERIFICAÇÃO DE CORRENTE DE CURTO-CIRCUITO E I²t DO DISJUNTOR
  // ═════════════════════════════════════════════════════════════════
  describe('Verificação de Corrente de Curto-Circuito e I²t do Disjuntor', () => {
    it('deve calcular a corrente de curto-circuito presumida no barramento CA e contribuição do inversor (1.1x In)', () => {
      // Inversor de 15kW 220V trifásico -> In = 15000 / (sqrt(3) * 220) = 39.36 A
      // Contribuição do inversor: 1.1 * 39.36 = 43.30 A = 0.043 kA
      // Icc presumida da rede: ~4.5 kA
      const scResult = calculateShortCircuitAndI2t(39.36, VoltageLevel.V_127_220, 16.0, 4.5, 15, 'PVC');

      expect(scResult.gridShortCircuitCurrentKa).toBeGreaterThan(1.0);
      expect(scResult.inverterContributionCurrentA).toBeCloseTo(43.30, 1);
      expect(scResult.totalShortCircuitCurrentKa).toBeGreaterThanOrEqual(scResult.gridShortCircuitCurrentKa);
      expect(scResult.minBreakerIcnKa).toBeGreaterThanOrEqual(3.0);
    });

    it('deve validar a capacidade de interrupção nominal (Icn em kA) e alertar caso Icc supere Icn', () => {
      // Simulando corrente de curto presumida alta com disjuntor de capacidade insuficiente (Icn = 3.0 kA quando Icc = 4.5 kA)
      const scInvalid = calculateShortCircuitAndI2t(50.0, VoltageLevel.V_220_380, 10.0, 3.0, 5, 'PVC');
      expect(scInvalid.breakerIcnValid).toBe(false);
      expect(scInvalid.warnings.some(w => w.includes('supera a capacidade de interrupção') || w.includes('Icn'))).toBe(true);
      expect(scInvalid.minBreakerIcnKa).toBeGreaterThanOrEqual(4.5);

      // Com disjuntor de 6.0 kA
      const scValid = calculateShortCircuitAndI2t(50.0, VoltageLevel.V_220_380, 10.0, 6.0, 5, 'PVC');
      expect(scValid.breakerIcnValid).toBe(true);
    });

    it('deve verificar a suportabilidade térmica k²S² >= I²t do condutor conforme NBR 5410 §5.3.4', () => {
      // Cabo de 1.5mm² com isolamento PVC (k=115): k²S² = (115 * 1.5)² = 29,756 A²s
      // Se Icc = 4.0 kA (4000A) e t = 0.02s: I²t = 4000² * 0.02 = 320,000 A²s > 29,756 A²s -> Cabo não suporta!
      const scThermal = calculateShortCircuitAndI2t(10.0, VoltageLevel.V_127_220, 1.5, 4.5, 5, 'PVC');
      expect(scThermal.cableThermalValid).toBe(false);
      expect(scThermal.warnings.some(w => w.includes('Energia passante') || w.includes('suportabilidade térmica'))).toBe(true);

      // Cabo de 16mm² com PVC: k²S² = (115 * 16)² = 3,385,600 A²s > 320,000 A²s -> Cabo suporta com folga!
      const scThermalOk = calculateShortCircuitAndI2t(10.0, VoltageLevel.V_127_220, 16.0, 4.5, 15, 'PVC');
      expect(scThermalOk.cableThermalValid).toBe(true);
    });

    it('deve integrar os cálculos de curto-circuito e normas no status de engenharia do projeto', () => {
      const mockBlocks: any[] = [
        {
          id: 1,
          module: { id: 1, brand: 'Trina', model: 'Vertex', power: 550, voc: 38.0, vmp: 31.5, isc: 17.5, imp: 16.5 },
          moduleBrand: 'Trina',
          moduleModel: 'Vertex',
          modulePowerW: 550,
          moduleQty: 20,
          inverter: { id: 1, brand: 'Deye', model: 'SUN-10K', power: 10.0, nominalOutputVoltage: 380, maxDcVoltage: 1000, maxInputCurrent: 26.0, mpptMin: 200, mpptMax: 850, mpptCount: 2, outputPhases: 3, inverterType: 'string' },
          inverterBrand: 'Deye',
          inverterModel: 'SUN-10K',
          inverterPowerKw: 10.0,
          inverterQty: 1,
          strings: [{ id: 1, count: 10 }, { id: 2, count: 10 }],
        },
      ];

      const mockTech: any = {
        voltage: VoltageLevel.V_220_380,
        connectionType: ConnectionType.TRIPHASIC,
        mainBreaker: 63,
        distance: 20,
        dcCableDistance: 15,
        utility: UtilityCompany.LIGHT,
      };

      const projectEng = getProjectEngineeringStatus(mockBlocks, mockTech);
      expect(projectEng.fct).toBe(1.0);
      expect(projectEng.fca).toBe(1.0);
      expect(projectEng.correctedCurrent).toBeGreaterThan(0);
      expect(projectEng.shortCircuitResult).toBeDefined();
      expect(projectEng.shortCircuitResult?.gridShortCircuitCurrentKa).toBeGreaterThan(0);
    });
  });
});
