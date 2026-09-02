import { describe, it, expect } from 'vitest';
import {
  calculateMicroinverterAcCurrent,
  calculateTrunkCurrent,
  suggestTrunkBreaker,
  calculateMaxMicrosInSeries,
  getBlockEngineeringStatus,
  getProjectEngineeringStatus,
} from '../services/engineering';
import { calculateDcProtection } from '../services/dcProtection';
import { generateSolarUnifilarDxf } from '../services/dxfExporter';
import { EquipmentBlock, TechnicalData, ProjectState } from '../types';

describe('SolarCAD - Testes da Topologia de Microinversores (NBR 16690 / NBR 5410)', () => {
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. CÁLCULO DA CORRENTE NOMINAL CA DO MICROINVERSOR (In)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('1. Corrente Nominal CA Individual (In)', () => {
    it('deve calcular a corrente nominal monofásica/bifásica 220V: In = P_kw * 1000 / V_ca', () => {
      // Hoymiles HMS-2000-4T: 2.0 kW @ 220V -> 2000 / 220 = 9.09 A
      const inHoymiles2k = calculateMicroinverterAcCurrent(2.0, '127/220V' as any, 1);
      expect(inHoymiles2k).toBeCloseTo(9.09, 2);

      // Hoymiles HMS-1000-2T: 1.0 kW @ 220V -> 1000 / 220 = 4.55 A
      const inHoymiles1k = calculateMicroinverterAcCurrent(1.0, '127/220V' as any, 1);
      expect(inHoymiles1k).toBeCloseTo(4.55, 2);

      // Deye SUN-M80G3: 0.8 kW @ 220V -> 800 / 220 = 3.64 A
      const inDeye800 = calculateMicroinverterAcCurrent(0.8, '127/220V' as any, 1);
      expect(inDeye800).toBeCloseTo(3.64, 2);

      // APsystems DS3-H: 2.0 kW @ 220V -> 2000 / 220 = 9.09 A
      const inApsystems = calculateMicroinverterAcCurrent(2.0, '127/220V' as any, 1);
      expect(inApsystems).toBeCloseTo(9.09, 2);
    });

    it('deve calcular a corrente nominal trifásica 380V: In = P_kw * 1000 / (sqrt(3) * V_ca)', () => {
      // APsystems QT2 (Trifásico 380V): 2.0 kW @ 380V -> 2000 / (sqrt(3) * 380) = 3.04 A
      const inQt2 = calculateMicroinverterAcCurrent(2.0, '220/380V' as any, 3);
      expect(inQt2).toBeCloseTo(3.04, 2);

      // Microinversor Trifásico 4.0 kW @ 380V -> 4000 / (sqrt(3) * 380) = 6.08 A
      const inTri4k = calculateMicroinverterAcCurrent(4.0, '220/380V' as any, 3);
      expect(inTri4k).toBeCloseTo(6.08, 2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. CORRENTE TOTAL NO TRUNK CABLE (I_trunk = inverterQty * In)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('2. Corrente no Trunk Cable (Daisy-Chain CA)', () => {
    it('deve calcular I_trunk = inverterQty * In corretamente', () => {
      const inMicro = 9.09; // HMS-2000 @ 220V

      // 1 microinversor
      expect(calculateTrunkCurrent(1, inMicro)).toBeCloseTo(9.09, 2);

      // 2 microinversores no mesmo trunk: 2 * 9.09 = 18.18 A
      expect(calculateTrunkCurrent(2, inMicro)).toBeCloseTo(18.18, 2);

      // 3 microinversores no mesmo trunk: 3 * 9.09 = 27.27 A
      expect(calculateTrunkCurrent(3, inMicro)).toBeCloseTo(27.27, 2);

      // 4 microinversores HMS-1000 (4.55A cada): 4 * 4.55 = 18.20 A
      expect(calculateTrunkCurrent(4, 4.55)).toBeCloseTo(18.20, 2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. DIMENSIONAMENTO DO DISJUNTOR DO RAMAL TRUNK (125% da corrente de pico)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('3. Dimensionamento do Disjuntor do Ramal Trunk', () => {
    it('deve selecionar disjuntor padrão comercial para 125% da corrente acumulada dos micros', () => {
      // 1x HMS-2000 (9.09 A): 9.09 * 1.25 = 11.36 A -> Disjuntor sugerido = 16A
      expect(suggestTrunkBreaker(9.09)).toBe(16);

      // 2x HMS-2000 (18.18 A): 18.18 * 1.25 = 22.73 A -> Disjuntor sugerido = 25A
      expect(suggestTrunkBreaker(18.18)).toBe(25);

      // 3x HMS-2000 (27.27 A): 27.27 * 1.25 = 34.09 A -> Disjuntor sugerido = 40A
      expect(suggestTrunkBreaker(27.27)).toBe(40);

      // 4x HMS-1000 (18.18 A): 18.18 * 1.25 = 22.73 A -> Disjuntor sugerido = 25A
      expect(suggestTrunkBreaker(18.18)).toBe(25);

      // 1x Deye SUN-M80G3 (3.64 A): 3.64 * 1.25 = 4.55 A -> Disjuntor sugerido = 10A
      expect(suggestTrunkBreaker(3.64)).toBe(10);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. LIMITE MÁXIMO DE MICROINVERSORES POR CIRCUITO AC TRUNK
  // ─────────────────────────────────────────────────────────────────────────────
  describe('4. Limite Máximo de Microinversores em Série (Trunk Cable)', () => {
    it('deve calcular maxMicrosInSeries = floor(circuitBreakerRating / (In * 1.25))', () => {
      // HMS-2000 (In = 9.09A, In*1.25 = 11.36A)
      // Disjuntor ramal 20A -> floor(20 / 11.36) = 1
      expect(calculateMaxMicrosInSeries(9.09, 20)).toBe(1);

      // Disjuntor ramal 25A -> floor(25 / 11.36) = 2
      expect(calculateMaxMicrosInSeries(9.09, 25)).toBe(2);

      // Disjuntor ramal 40A -> floor(40 / 11.36) = 3
      expect(calculateMaxMicrosInSeries(9.09, 40)).toBe(3);

      // HMS-1000 (In = 4.55A, In*1.25 = 5.68A)
      // Disjuntor ramal 20A -> floor(20 / 5.68) = 3
      expect(calculateMaxMicrosInSeries(4.55, 20)).toBe(3);

      // Deye SUN-M80G3 (In = 3.64A, In*1.25 = 4.55A)
      // Disjuntor ramal 20A -> floor(20 / 4.55) = 4
      expect(calculateMaxMicrosInSeries(3.64, 20)).toBe(4);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. ALERTAS ESPECÍFICOS DE MICROINVERSOR
  // ─────────────────────────────────────────────────────────────────────────────
  describe('5. Alertas e Validações de Engenharia para Microinversores', () => {
    const baseModule = {
      id: 1,
      brand: 'Trina Solar',
      model: 'Vertex S+ 500W',
      power: 500,
      voc: 38.0,
      vmp: 31.5,
      isc: 16.0,
      imp: 15.0,
    };

    const baseMicroInverter = {
      id: 1,
      brand: 'Hoymiles',
      model: 'HMS-2000-4T',
      power: 2.0,
      nominalOutputVoltage: 220,
      maxDcVoltage: 65,
      maxInputCurrent: 16.0,
      mpptMin: 16,
      mpptMax: 60,
      mpptCount: 4,
      outputPhases: 1,
      inverterType: 'micro' as const,
      maxMicrosInSeries: 3,
      maxInputPowerW: 600,
    };

    const baseTechnical: TechnicalData = {
      utility: 'LIGHT' as any,
      connectionType: 'BIFASICO' as any,
      voltage: '127/220V' as any,
      mainBreaker: 63,
      distance: 15,
      dcCableDistance: 10,
    };

    it('deve aprovar com status SUCCESS bloco de microinversores dentro dos limites', () => {
      const block: EquipmentBlock = {
        id: 1,
        moduleId: 1,
        inverterId: 1,
        module: baseModule,
        inverter: baseMicroInverter,
        inverterBrand: 'Hoymiles',
        inverterModel: 'HMS-2000-4T',
        inverterPowerKw: 2.0,
        moduleBrand: 'Trina Solar',
        moduleModel: 'Vertex S+ 500W',
        modulePowerW: 500,
        moduleQty: 8,
        inverterQty: 2, // 2 <= 3 maxMicrosInSeries
        strings: [{ id: 1, count: 4 }],
      };

      const result = getBlockEngineeringStatus(block, baseTechnical);
      expect(result.status).toBe('SUCCESS');
      expect(result.isMicro).toBe(true);
      expect(result.nominalCurrent).toBeCloseTo(18.18, 1);
      expect(result.suggestedBreaker).toBe(25);
      expect(result.dcProtection.fuseRequired).toBe(false);
      expect(result.dcProtection.switchRequired).toBe(false);
      expect(result.warnings.length).toBe(0);
    });

    it('deve emitir alerta de sobrecarga quando inverterQty > maxMicrosInSeries', () => {
      const block: EquipmentBlock = {
        id: 1,
        moduleId: 1,
        inverterId: 1,
        module: baseModule,
        inverter: { ...baseMicroInverter, maxMicrosInSeries: 3 },
        inverterBrand: 'Hoymiles',
        inverterModel: 'HMS-2000-4T',
        inverterPowerKw: 2.0,
        moduleBrand: 'Trina Solar',
        moduleModel: 'Vertex S+ 500W',
        modulePowerW: 500,
        moduleQty: 20,
        inverterQty: 5, // 5 > 3 maxMicrosInSeries
        strings: [{ id: 1, count: 4 }],
      };

      const result = getBlockEngineeringStatus(block, baseTechnical);
      expect(result.warnings.some(w => w.includes('trunk cable') || w.includes('em série'))).toBe(true);
    });

    it('deve emitir alerta quando a potência do módulo excede maxInputPowerW', () => {
      const highPowerModule = {
        ...baseModule,
        power: 700, // 700W > 600W maxInputPowerW
      };

      const block: EquipmentBlock = {
        id: 1,
        moduleId: 1,
        inverterId: 1,
        module: highPowerModule,
        inverter: { ...baseMicroInverter, maxInputPowerW: 600 },
        inverterBrand: 'Hoymiles',
        inverterModel: 'HMS-2000-4T',
        inverterPowerKw: 2.0,
        moduleBrand: 'Trina Solar',
        moduleModel: 'Vertex 700W',
        modulePowerW: 700,
        moduleQty: 8,
        inverterQty: 2,
        strings: [{ id: 1, count: 4 }],
      };

      const result = getBlockEngineeringStatus(block, baseTechnical);
      expect(result.warnings.some(w => w.includes('Potência do módulo') || w.includes('máx por entrada'))).toBe(true);
    });

    it('deve bloquear com status ERROR quando Voc do módulo excede maxDcVoltage do microinversor', () => {
      const highVocModule = {
        ...baseModule,
        voc: 68.0, // 68V > 65V maxDcVoltage
      };

      const block: EquipmentBlock = {
        id: 1,
        moduleId: 1,
        inverterId: 1,
        module: highVocModule,
        inverter: { ...baseMicroInverter, maxDcVoltage: 65 },
        inverterBrand: 'Hoymiles',
        inverterModel: 'HMS-2000-4T',
        inverterPowerKw: 2.0,
        moduleBrand: 'Trina Solar',
        moduleModel: 'Vertex HighVoc',
        modulePowerW: 500,
        moduleQty: 8,
        inverterQty: 2,
        strings: [{ id: 1, count: 4 }],
      };

      const result = getBlockEngineeringStatus(block, baseTechnical);
      expect(result.status).toBe('ERROR');
      expect(result.warnings.some(w => w.includes('Voc') && (w.includes('sobretensão') || w.includes('excede')))).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. OMISSÃO DE PROTEÇÕES CC EXTERNAS (NBR 16690)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('6. Omissão de Proteções CC Externas (String Box Dispensada)', () => {
    it('deve retornar fuseRequired=false e switchRequired=false para microinversores em calculateDcProtection', () => {
      const module = {
        id: 1, brand: 'Canadian', model: '550W', power: 550,
        voc: 38.0, isc: 17.5, vmp: 31.5, imp: 16.5,
      };
      const microInverter = {
        id: 1, brand: 'Hoymiles', model: 'HMS-2000', power: 2.0,
        maxDcVoltage: 65, maxInputCurrent: 16.0, mpptMin: 16, mpptMax: 60,
        mpptCount: 4, nominalOutputVoltage: 220, outputPhases: 1,
        inverterType: 'micro' as const,
      };

      const result = calculateDcProtection(module, microInverter, [{ id: 1, count: 4 }]);
      expect(result.fuseRequired).toBe(false);
      expect(result.switchRequired).toBe(false);
      expect(result.fuseRating).toBe(0);
      expect(result.switchRating).toBe(0);
      expect(result.dpsClass).toBe('N/A');
    });

    it('deve exigir proteções CC normais para inversores string tradicionais', () => {
      const module = {
        id: 1, brand: 'Canadian', model: '550W', power: 550,
        voc: 49.8, isc: 14.0, vmp: 41.5, imp: 13.25,
      };
      const stringInverter = {
        id: 1, brand: 'Growatt', model: 'MIN 5000TL-X', power: 5.0,
        maxDcVoltage: 550, maxInputCurrent: 16.0, mpptMin: 80, mpptMax: 500,
        mpptCount: 2, nominalOutputVoltage: 220, outputPhases: 1,
        inverterType: 'string' as const,
      };

      const result = calculateDcProtection(module, stringInverter, [
        { id: 1, count: 10 },
        { id: 2, count: 10 },
        { id: 3, count: 10 },
      ]);
      expect(result.fuseRequired).toBe(true); // >= 3 strings
      expect(result.switchRequired).toBe(true);
      expect(result.switchRating).toBeGreaterThan(0);
      expect(result.dpsClass).toBe('Classe II');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. INTEGRAÇÃO COM DIAGRAMA DXF (AutoCAD R12/R2000)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('7. Exportação DXF com Topologia de Microinversores', () => {
    it('deve gerar DXF com anotações de Cabo Tronco CA e Plug&Play MC4', () => {
      const project: ProjectState = {
        client: {
          name: 'Residência Silva Micro',
          document: '123.456.789-00',
          email: 'silva@email.com',
          phone: '21999999999',
          utilityId: '87654321',
          art: 'ART-2026-MICRO',
          address: {
            street: 'Rua das Palmeiras',
            number: '42',
            neighborhood: 'Barra',
            city: 'Rio de Janeiro',
            state: 'RJ',
            zipCode: '22000-000',
          },
        },
        engineer: { name: 'Eng. Luca', crea: '123456-RJ' },
        technical: {
          utility: 'LIGHT' as any,
          connectionType: 'BIFASICO' as any,
          voltage: '127/220V' as any,
          mainBreaker: 40,
          distance: 12,
          dcCableDistance: 5,
        },
        equipmentBlocks: [
          {
            id: 1,
            moduleId: 1,
            inverterId: 1,
            module: {
              id: 1, brand: 'Trina Solar', model: 'Vertex 550W',
              power: 550, voc: 38.0, vmp: 31.5, isc: 17.5, imp: 16.5,
            },
            moduleBrand: 'Trina Solar',
            moduleModel: 'Vertex 550W',
            modulePowerW: 550,
            moduleQty: 8,
            inverter: {
              id: 1, brand: 'Hoymiles', model: 'HMS-2000-4T',
              power: 2.0, nominalOutputVoltage: 220, maxDcVoltage: 65,
              maxInputCurrent: 16.0, mpptMin: 16, mpptMax: 60, mpptCount: 4,
              outputPhases: 1, inverterType: 'micro' as const,
              maxMicrosInSeries: 3, maxInputPowerW: 600,
            },
            inverterBrand: 'Hoymiles',
            inverterModel: 'HMS-2000-4T',
            inverterPowerKw: 2.0,
            inverterQty: 2,
            strings: [{ id: 1, count: 4 }],
          },
        ],
        paperSize: 'A4',
      };

      const dxf = generateSolarUnifilarDxf(project);
      expect(dxf).toContain('MICRO');
      expect(dxf).toContain('CABO TRONCO CA');
      expect(dxf).toContain('MC4 PLUG&PLAY');
      expect(dxf).toContain('EOF');
    });
  });
});
