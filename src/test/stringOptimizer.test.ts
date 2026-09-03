import { describe, it, expect } from 'vitest';
import { calculateOptimalStringConfig } from '@/services/stringOptimizer';
import { ModuleData, InverterData } from '@/types';

describe('Motor de Otimização e Sugestão de Configuração Ideal (stringOptimizer.ts)', () => {
  const mockModule550W: ModuleData = {
    id: 1,
    brand: 'CANADIAN',
    model: 'CS6W-550MS',
    power: 550,
    voc: 49.8,
    vmp: 41.9,
    isc: 13.9,
    imp: 13.13,
  };

  const mockInverter20kW: InverterData = {
    id: 10,
    brand: 'GROWATT',
    model: 'MID 20KTL3-X',
    power: 20,
    maxDcVoltage: 1100,
    maxInputCurrent: 26,
    mpptMin: 200,
    mpptMax: 1000,
    mpptCount: 2,
    inverterType: 'string',
  };

  const mockMicroDeye2250: InverterData = {
    id: 20,
    brand: 'DEYE',
    model: 'SUN-M225G4-EU-Q0',
    power: 2.25,
    maxDcVoltage: 60,
    maxInputCurrent: 14,
    mpptMin: 25,
    mpptMax: 55,
    mpptCount: 4,
    inverterType: 'micro',
  };

  it('calcula configuração ideal para inversor string com FDI próximo de 1.25 e strings balanceadas', () => {
    const result = calculateOptimalStringConfig(mockModule550W, mockInverter20kW, 1);

    expect(result.strings.length).toBeGreaterThanOrEqual(1);
    expect(result.totalModules).toBeGreaterThan(0);
    // Para 20kW com 1.25 FDI: Pdc ~ 25kWp -> ~45 módulos (ex: 2 strings de 22 ou 23 módulos)
    expect(result.dcAcRatio).toBeGreaterThanOrEqual(1.10);
    expect(result.dcAcRatio).toBeLessThanOrEqual(1.35);
    expect(result.vocString).toBeLessThan(mockInverter20kW.maxDcVoltage);
    expect(result.vmpString).toBeGreaterThan(mockInverter20kW.mpptMin);
    expect(result.explanation).toContain('Configuração Ideal');
  });

  it('calcula configuração ideal para microinversor respeitando o número de MPPTs e quantidade de micros', () => {
    const result = calculateOptimalStringConfig(mockModule550W, mockMicroDeye2250, 4);

    // 4 microinversores de 4 MPPTs cada = 16 módulos
    expect(result.totalModules).toBe(16);
    expect(result.strings[0].count).toBe(4); // 4 módulos por micro
    expect(result.dcPowerKwp).toBe(Number(((16 * 550) / 1000).toFixed(2))); // 8.80 kWp
    expect(result.explanation).toContain('Topologia de Microinversor');
  });

  it('garante que a tensão de circuito aberto a frio nunca ultrapasse o limite do inversor', () => {
    const highVocModule: ModuleData = {
      ...mockModule550W,
      voc: 65.0,
    };
    const lowVdcInverter: InverterData = {
      ...mockInverter20kW,
      maxDcVoltage: 600,
    };

    const result = calculateOptimalStringConfig(highVocModule, lowVdcInverter, 1);
    expect(result.vocString).toBeLessThan(lowVdcInverter.maxDcVoltage);
  });
});
