import { describe, it, expect } from 'vitest';
import { calculateNominalCurrent, suggestBreaker, getBreakerPolarity, getBlockEngineeringStatus } from '../services/engineering';
import { generateSolarUnifilarDxf, sanitizeDxfText } from '../services/dxfExporter';
import { ProjectState } from '../types';

describe('SolarCad - Testes de Cálculos de Engenharia (NBR 5410 / NBR 16690)', () => {
  it('deve calcular corrente nominal monofásica e trifásica corretamente', () => {
    // Monofásico 220V (127/220V) - 5 kW -> 5000 / 220 = 22.72 A
    const currentMono = calculateNominalCurrent(5.0, '127/220V' as any, 1);
    expect(currentMono).toBeCloseTo(22.72, 1);

    // Trifásico 380V (220/380V) - 15 kW -> 15000 / (sqrt(3) * 380) = 22.79 A
    const currentTri = calculateNominalCurrent(15.0, '220/380V' as any, 3);
    expect(currentTri).toBeCloseTo(22.79, 1);
  });

  it('deve calcular correntes e sugerir disjuntores para grandes usinas comerciais (50kW a 100kW)', () => {
    // Trifásico 380V - 75 kW -> 75000 / (sqrt(3) * 380) = 113.95 A -> * 1.25 = 142.4 A -> Próximo comercial 150A
    const current75k = calculateNominalCurrent(75.0, '220/380V' as any, 3);
    expect(current75k).toBeCloseTo(113.95, 1);
    const breaker75k = suggestBreaker(current75k);
    expect(breaker75k).toBe(150);

    // Trifásico 380V - 100 kW -> 100000 / (sqrt(3) * 380) = 151.93 A -> * 1.25 = 189.9 A -> Próximo comercial 200A
    const current100k = calculateNominalCurrent(100.0, '220/380V' as any, 3);
    expect(current100k).toBeCloseTo(151.93, 1);
    const breaker100k = suggestBreaker(current100k);
    expect(breaker100k).toBe(200);
  });

  it('deve sugerir disjuntor padrão comercial com fator de segurança de 1.25x', () => {
    // 22.72 A * 1.25 = 28.4 A -> Próximo comercial é 32 A
    const breaker = suggestBreaker(22.72);
    expect(breaker).toBe(32);

    // 45 A * 1.25 = 56.25 A -> Próximo comercial é 63 A
    const breaker63 = suggestBreaker(45.0);
    expect(breaker63).toBe(63);
  });

  it('deve determinar polaridade correta para conexões monofásicas e trifásicas', () => {
    expect(getBreakerPolarity(1)).toBe('Bipolar');
    expect(getBreakerPolarity(3)).toBe('Tripolar');
  });

  it('deve validar limites térmicos de tensão Voc em strings fotovoltaicas', () => {
    const mockBlock = {
      id: 1,
      module: { brand: 'Canadian Solar', model: 'CS6W-550MS', power: 550, voc: 49.8, vmp: 41.5, isc: 14.0, imp: 13.25 },
      moduleQty: 10,
      inverter: { brand: 'Growatt', model: 'MIN 5000TL-X', power: 5.0, nominalOutputVoltage: 220, maxDcVoltage: 550, maxInputCurrent: 16.0, mpptMin: 80, mpptMax: 500, mpptCount: 2, outputPhases: 1 },
      inverterQty: 1,
      strings: [{ id: 1, count: 10 }]
    };

    const mockTechnical = {
      voltage: '220V' as any,
      connectionType: 'Monofásico' as any,
      mainBreaker: 40,
      distance: 15,
      utility: 'Enel'
    };

    const result = getBlockEngineeringStatus(mockBlock as any, mockTechnical as any);
    expect(result.nominalCurrent).toBeCloseTo(22.72, 1);
    expect(result.suggestedBreaker).toBe(32);
    expect(result.breakerPolarity).toBe('Bipolar');
    // Voc com fator de segurança 1.15: 10 * 49.8 * 1.15 = 572.7V > 550V máx do inversor -> status deve ser ERROR
    expect(result.status).toBe('ERROR');
    expect(result.warnings.some(w => w.includes('Voc'))).toBe(true);
  });

  it('deve sanitizar texto para DXF removendo quebras de linha e substituindo caracteres especiais fora de 0x20-0x7E', () => {
    expect(sanitizeDxfText('')).toBe('');
    expect(sanitizeDxfText('João & Maria\r\nEngenharia')).toBe('Joao & MariaEngenharia');
    expect(sanitizeDxfText('São Paulo - SP')).toBe('Sao Paulo - SP');
    expect(sanitizeDxfText('Inversor\r10kW\nSolar⚡')).toBe('Inversor10kWSolar_');
  });

  it('deve gerar string DXF com estrutura compatível com AutoCAD R12 / R2000 e codepage ANSI_1252', () => {
    const mockProject: ProjectState = {
      client: {
        name: 'Fazenda Solar Boa Vista\r\n',
        document: '12.345.678/0001-90',
        email: 'contato@boavista.com',
        phone: '1999999999',
        utilityId: '12345678',
        art: 'ART-2026-001',
        address: {
          street: 'Rodovia KM 12',
          number: '100',
          neighborhood: 'Zona Rural',
          city: 'São Paulo',
          state: 'SP',
          zipCode: '13000-000'
        }
      },
      engineer: { name: 'Dr. João Silva', crea: '123456-D' },
      technical: { voltage: '380V/220V' as any, connectionType: 'TRIFASICO' as any, mainBreaker: 63, distance: 25, utility: 'CPFL' as any },
      equipmentBlocks: [
        {
          id: 1,
          moduleId: 1,
          inverterId: 1,
          module: { id: 1, brand: 'Trina Solar', model: 'Vertex 600W', power: 600, voc: 41.7, vmp: 34.9, isc: 18.0, imp: 17.2 },
          moduleBrand: 'Trina Solar',
          moduleModel: 'Vertex 600W',
          modulePowerW: 600,
          moduleQty: 20,
          inverter: { id: 1, brand: 'Deye', model: 'SUN-10K-G03', power: 10.0, nominalOutputVoltage: 380, maxDcVoltage: 1000, maxInputCurrent: 26.0, mpptMin: 200, mpptMax: 850, mpptCount: 2, outputPhases: 3 },
          inverterBrand: 'Deye',
          inverterModel: 'SUN-10K-G03',
          inverterPowerKw: 10.0,
          inverterQty: 1,
          strings: [{ id: 1, count: 10 }, { id: 2, count: 10 }]
        }
      ],
      paperSize: 'A4'
    };

    const dxf = generateSolarUnifilarDxf(mockProject);
    expect(dxf).toContain('SECTION');
    expect(dxf).toContain('HEADER');
    expect(dxf).toContain('$ACADVER');
    expect(dxf).toContain('$DWGCODEPAGE');
    expect(dxf).toContain('\nANSI_1252\n');
    expect(dxf).toContain('TABLES');
    expect(dxf).toContain('ENTITIES');
    expect(dxf).toContain('FAZENDA SOLAR BOA VISTA');
    expect(dxf).toContain('Sao Paulo - SP');
    expect(dxf).not.toContain('\r');
    expect(dxf).toContain('EOF');
  });

  it('deve validar topologia de microinversores corretamente', () => {
    const mockMicroBlock = {
      id: 1,
      module: { brand: 'Trina Solar', model: 'Vertex 550W', power: 550, voc: 38.0, vmp: 31.5, isc: 17.5, imp: 16.5 },
      moduleQty: 4,
      inverter: {
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
      },
      inverterQty: 1,
      strings: [{ id: 1, count: 4 }],
    };

    const mockTechnical = {
      voltage: '127/220V' as any,
      connectionType: 'BIFASICO' as any,
      mainBreaker: 40,
      distance: 15,
      dcCableDistance: 10,
      utility: 'LIGHT' as any,
    };

    const result = getBlockEngineeringStatus(mockMicroBlock as any, mockTechnical as any);
    expect(result.nominalCurrent).toBeCloseTo(9.09, 1);
    expect(result.suggestedBreaker).toBe(16);
    expect(result.dcProtection.fuseRequired).toBe(false);
    expect(result.status).toBe('SUCCESS');
  });

  it('deve emitir warning quando quantidade de microinversores excede limite do trunk cable', () => {
    const mockMicroBlock = {
      id: 1,
      module: { brand: 'Trina Solar', model: 'Vertex 550W', power: 550, voc: 38.0, vmp: 31.5, isc: 17.5, imp: 16.5 },
      moduleQty: 20,
      inverter: {
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
      },
      inverterQty: 5, // 5 > 3 maxMicrosInSeries
      strings: [{ id: 1, count: 4 }],
    };

    const mockTechnical = {
      voltage: '127/220V' as any,
      connectionType: 'BIFASICO' as any,
      mainBreaker: 63,
      distance: 15,
      dcCableDistance: 10,
      utility: 'LIGHT' as any,
    };

    const result = getBlockEngineeringStatus(mockMicroBlock as any, mockTechnical as any);
    expect(result.warnings.some(w => w.includes('trunk cable'))).toBe(true);
  });

  it('deve alertar clipping quando corrente operacional da string paralela exceder limite do inversor', () => {
    const mockBlock = {
      id: 1,
      module: { brand: 'Trina Solar', model: 'Vertex 600W', power: 600, voc: 41.7, vmp: 34.9, isc: 18.0, imp: 17.2 },
      moduleQty: 20,
      inverter: {
        brand: 'Growatt', model: 'MIN 5000TL-X', power: 5.0, nominalOutputVoltage: 220,
        maxDcVoltage: 550, maxInputCurrent: 16.0, mpptMin: 80, mpptMax: 500, mpptCount: 1, outputPhases: 1,
        inverterType: 'string' as const,
      },
      inverterQty: 1,
      // 2 strings em 1 MPPT -> parallelPerMppt = 2 -> Imp = 34.4A > 16.0A maxInputCurrent
      strings: [{ id: 1, count: 10 }, { id: 2, count: 10 }],
    };

    const mockTechnical = {
      voltage: '127/220V' as any, connectionType: 'BIFASICO' as any,
      mainBreaker: 40, distance: 15, dcCableDistance: 15, utility: 'LIGHT' as any,
    };

    const result = getBlockEngineeringStatus(mockBlock as any, mockTechnical as any);
    expect(result.warnings.some(w => w.includes('clipping de corrente') || w.includes('excede limite seguro'))).toBe(true);
  });

  it('deve bloquear com status ERROR quando corrente Isc em paralelo exceder limite térmico seguro', () => {
    const mockBlock = {
      id: 1,
      module: { brand: 'Canadian Solar', model: 'BiHiKu7 665W', power: 665, voc: 46.0, vmp: 38.5, isc: 18.5, imp: 17.3 },
      moduleQty: 30,
      inverter: {
        brand: 'Growatt', model: 'MIN 6000TL-X', power: 6.0, nominalOutputVoltage: 220,
        maxDcVoltage: 1000, maxInputCurrent: 16.0, mpptMin: 80, mpptMax: 550, mpptCount: 1, outputPhases: 1,
        inverterType: 'string' as const,
      },
      inverterQty: 1,
      // 3 strings em 1 MPPT -> Isc = 3 * 18.5 = 55.5A > 16.0 * 1.25 (20A)
      strings: [{ id: 1, count: 10 }, { id: 2, count: 10 }, { id: 3, count: 10 }],
    };

    const mockTechnical = {
      voltage: '127/220V' as any, connectionType: 'BIFASICO' as any,
      mainBreaker: 40, distance: 15, dcCableDistance: 15, utility: 'LIGHT' as any,
    };

    const result = getBlockEngineeringStatus(mockBlock as any, mockTechnical as any);
    expect(result.status).toBe('ERROR');
    expect(result.warnings.some(w => w.includes('Risco de queima da entrada MPPT'))).toBe(true);
  });
});
