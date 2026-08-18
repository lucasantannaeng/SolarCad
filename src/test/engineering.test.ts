import { describe, it, expect } from 'vitest';
import { calculateNominalCurrent, suggestBreaker, getBreakerPolarity, getBlockEngineeringStatus } from '../services/engineering';
import { generateSolarUnifilarDxf } from '../services/dxfExporter';
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

  it('deve gerar string DXF com estrutura compatível com AutoCAD R12 / R2000', () => {
    const mockProject: ProjectState = {
      client: { name: 'Fazenda Solar Boa Vista', address: 'Rodovia KM 12', city: 'Campinas', state: 'SP', zipCode: '13000-000', utilityId: '12345678' },
      technical: { voltage: '380V/220V' as any, connectionType: 'Trifásico' as any, mainBreaker: 63, distance: 25, utility: 'CPFL' },
      equipmentBlocks: [
        {
          id: 1,
          module: { brand: 'Trina Solar', model: 'Vertex 600W', power: 600, voc: 41.7, vmp: 34.9, isc: 18.0, imp: 17.2 },
          moduleQty: 20,
          inverter: { brand: 'Deye', model: 'SUN-10K-G03', power: 10.0, nominalOutputVoltage: 380, maxDcVoltage: 1000, maxInputCurrent: 26.0, mpptMin: 200, mpptMax: 850, mpptCount: 2, outputPhases: 3 },
          inverterQty: 1,
          strings: [{ id: 1, count: 10 }, { id: 2, count: 10 }]
        }
      ]
    };

    const dxf = generateSolarUnifilarDxf(mockProject);
    expect(dxf).toContain('SECTION');
    expect(dxf).toContain('HEADER');
    expect(dxf).toContain('$ACADVER');
    expect(dxf).toContain('TABLES');
    expect(dxf).toContain('ENTITIES');
    expect(dxf).toContain('Fazenda Solar Boa Vista'.toUpperCase());
    expect(dxf).toContain('EOF');
  });
});
