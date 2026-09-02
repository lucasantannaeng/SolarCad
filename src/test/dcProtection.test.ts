import { describe, it, expect } from 'vitest';
import { calculateDcProtection } from '../services/dcProtection';

const mockModule = {
  id: 1, brand: 'Canadian Solar', model: 'CS7N-665TB-AG',
  power: 665, voc: 46.1, isc: 18.42, vmp: 38.5, imp: 17.27,
};

const mockInverter = {
  id: 1, brand: 'Growatt', model: 'MIN 6000TL-X',
  power: 6.0, maxDcVoltage: 550, maxInputCurrent: 16.0,
  mpptMin: 80, mpptMax: 500, mpptCount: 2,
  nominalOutputVoltage: 220, outputPhases: 1,
};

describe('DC Protection Calculations (NBR 16690)', () => {
  it('deve calcular fusível CC com fator 1.5 × Isc', () => {
    const strings = [{ id: 1, count: 10 }, { id: 2, count: 10 }, { id: 3, count: 10 }];
    const result = calculateDcProtection(mockModule, mockInverter, strings);

    // 1.5 × 18.42 = 27.63 → próximo comercial = 30A
    expect(result.fuseRating).toBe(30);
  });

  it('deve exigir fusível quando ≥3 strings em paralelo', () => {
    const twoStrings = [{ id: 1, count: 10 }, { id: 2, count: 10 }];
    const threeStrings = [{ id: 1, count: 10 }, { id: 2, count: 10 }, { id: 3, count: 10 }];

    expect(calculateDcProtection(mockModule, mockInverter, twoStrings).fuseRequired).toBe(false);
    expect(calculateDcProtection(mockModule, mockInverter, threeStrings).fuseRequired).toBe(true);
  });

  it('deve calcular tensão do fusível ≥ Voc,string × 1.15', () => {
    const strings = [{ id: 1, count: 10 }];
    const result = calculateDcProtection(mockModule, mockInverter, strings);

    // Voc,string = 10 × 46.1 × 1.15 = 530.15 → arredondado para 600V
    expect(result.fuseVoltage).toBe(600);
  });

  it('deve calcular seccionadora CC com 1.25 × Isc × N_strings', () => {
    const strings = [{ id: 1, count: 10 }, { id: 2, count: 10 }];
    const result = calculateDcProtection(mockModule, mockInverter, strings);

    // 1.25 × 18.42 × 2 = 46.05 → ceil = 47
    expect(result.switchRating).toBe(Math.ceil(18.42 * 1.25 * 2));
  });

  it('deve selecionar DPS CC por faixa de tensão', () => {
    // Voc < 600V → DPS 600V
    const strings600 = [{ id: 1, count: 10 }]; // 10 × 46.1 × 1.15 = 530V
    expect(calculateDcProtection(mockModule, mockInverter, strings600).dpsVoltage).toBe(600);

    // Módulo com Voc alto → string > 600V → DPS 1000V
    const highVocModule = { ...mockModule, voc: 55.0 };
    const strings1000 = [{ id: 1, count: 12 }]; // 12 × 55 × 1.15 = 759V
    const highVInverter = { ...mockInverter, maxDcVoltage: 1000 };
    expect(calculateDcProtection(highVocModule, highVInverter, strings1000).dpsVoltage).toBe(1000);
  });

  it('deve determinar seção mínima de cabo CC por ampacidade', () => {
    const strings = [{ id: 1, count: 10 }];
    const result = calculateDcProtection(mockModule, mockInverter, strings);

    // Isc_design = 18.42 × 1.25 = 23.025A → cabo 2.5mm² (26A) é suficiente
    expect(result.minCableSection).toBe(2.5);
  });

  it('deve selecionar cabo maior para módulos de alta corrente', () => {
    const highCurrentModule = { ...mockModule, isc: 25.0 };
    const strings = [{ id: 1, count: 10 }];
    const result = calculateDcProtection(highCurrentModule, mockInverter, strings);

    // Isc_design = 25 × 1.25 = 31.25A → cabo 4.0mm² (34A)
    expect(result.minCableSection).toBe(4.0);
  });
});
