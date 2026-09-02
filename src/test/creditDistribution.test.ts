import { describe, it, expect } from 'vitest';
import {
  validateCreditDistribution,
  distributeCreditsEqually,
  estimateMonthlyGeneration,
} from '../services/creditDistribution';
import { CreditBeneficiary } from '../types';

describe('Credit Distribution & Shared Generation (Lei 14.300)', () => {
  it('deve estimar a geração mensal de energia corretamente', () => {
    // 10 kWp * 4.8 HSP * 30 dias * 0.75 PR = 1080 kWh/mês
    const gen = estimateMonthlyGeneration(10.0, 4.8, 0.75);
    expect(gen).toBeCloseTo(1080, 1);
  });

  it('deve validar distribuição completa com soma = 100%', () => {
    const list: CreditBeneficiary[] = [
      { id: '1', utilityId: 'UC-101', description: 'Casa de Praia', percentage: 40, averageConsumptionKwh: 450 },
      { id: '2', utilityId: 'UC-102', description: 'Apartamento Centro', percentage: 60, averageConsumptionKwh: 600 },
    ];

    const result = validateCreditDistribution(list, 1000);
    expect(result.isValid).toBe(true);
    expect(result.isComplete).toBe(true);
    expect(result.totalPercentage).toBe(100);
    expect(result.warnings.length).toBe(0);

    expect(result.beneficiariesWithCredits[0].estimatedKwh).toBe(400);
    expect(result.beneficiariesWithCredits[1].estimatedKwh).toBe(600);
  });

  it('deve alertar quando a soma for inferior a 100%', () => {
    const list: CreditBeneficiary[] = [
      { id: '1', utilityId: 'UC-101', description: 'Filial 1', percentage: 35 },
      { id: '2', utilityId: 'UC-102', description: 'Filial 2', percentage: 35 },
    ];

    const result = validateCreditDistribution(list, 1000);
    expect(result.isValid).toBe(true);
    expect(result.isComplete).toBe(false);
    expect(result.totalPercentage).toBe(70);
    expect(result.warnings.some(w => w.includes('inferior a 100%'))).toBe(true);
  });

  it('deve marcar como inválido se a soma ultrapassar 100%', () => {
    const list: CreditBeneficiary[] = [
      { id: '1', utilityId: 'UC-101', description: 'UC 1', percentage: 60 },
      { id: '2', utilityId: 'UC-102', description: 'UC 2', percentage: 50 },
    ];

    const result = validateCreditDistribution(list, 1000);
    expect(result.isValid).toBe(false);
    expect(result.totalPercentage).toBe(110);
    expect(result.warnings.some(w => w.includes('excede 100%'))).toBe(true);
  });

  it('deve detectar número de UC duplicado', () => {
    const list: CreditBeneficiary[] = [
      { id: '1', utilityId: 'UC-999', description: 'Loja A', percentage: 50 },
      { id: '2', utilityId: 'UC-999', description: 'Loja B', percentage: 50 },
    ];

    const result = validateCreditDistribution(list, 1000);
    expect(result.warnings.some(w => w.includes('duplicado'))).toBe(true);
  });

  it('deve distribuir percentuais igualmente entre as UCs somando 100%', () => {
    const list: CreditBeneficiary[] = [
      { id: '1', utilityId: 'UC-1', description: 'A', percentage: 0 },
      { id: '2', utilityId: 'UC-2', description: 'B', percentage: 0 },
      { id: '3', utilityId: 'UC-3', description: 'C', percentage: 0 },
    ];

    const distributed = distributeCreditsEqually(list);
    const sum = distributed.reduce((acc, b) => acc + b.percentage, 0);
    expect(sum).toBeCloseTo(100, 2);
    expect(distributed[0].percentage).toBe(33.34);
    expect(distributed[1].percentage).toBe(33.33);
    expect(distributed[2].percentage).toBe(33.33);
  });
});
