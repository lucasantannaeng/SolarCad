/**
 * Rateio de Créditos e Geração Compartilhada (Lei 14.300 / ANEEL)
 * Módulo puro de cálculo e validação de créditos de energia entre UCs beneficiárias.
 */
import { CreditBeneficiary } from '../types';

export interface CreditValidationResult {
  totalPercentage: number;
  isValid: boolean;
  isComplete: boolean;
  warnings: string[];
  beneficiariesWithCredits: {
    beneficiary: CreditBeneficiary;
    estimatedKwh: number;
    coveragePercent?: number;
  }[];
}

/**
 * Estima a geração mensal de energia (kWh/mês) baseada na potência instalada.
 * Geração = Potência (kWp) × HSP (h/dia) × 30 dias × Performance Ratio
 *
 * @param totalDcPowerKwp - Potência total CC em kWp
 * @param hspDaily - Horas de Sol Pleno diárias (média Brasil ~4.5 a 5.2 kWh/m²/dia)
 * @param performanceRatio - Taxa de desempenho do sistema (~0.75 padrão NBR)
 */
export function estimateMonthlyGeneration(
  totalDcPowerKwp: number,
  hspDaily = 4.8,
  performanceRatio = 0.75,
): number {
  if (totalDcPowerKwp <= 0) return 0;
  return totalDcPowerKwp * hspDaily * 30 * performanceRatio;
}

/**
 * Valida a distribuição percentual e calcula os créditos por unidade consumidora.
 *
 * @param beneficiaries - Lista de UCs beneficiárias
 * @param estimatedGenerationKwh - Geração mensal estimada em kWh
 */
export function validateCreditDistribution(
  beneficiaries: CreditBeneficiary[],
  estimatedGenerationKwh = 0,
): CreditValidationResult {
  const warnings: string[] = [];

  if (!beneficiaries || beneficiaries.length === 0) {
    return {
      totalPercentage: 0,
      isValid: true,
      isComplete: false,
      warnings: [],
      beneficiariesWithCredits: [],
    };
  }

  const totalPercentage = beneficiaries.reduce((acc, b) => acc + (Number(b.percentage) || 0), 0);
  const roundedTotal = Math.round(totalPercentage * 100) / 100;

  let isValid = true;
  let isComplete = false;

  if (roundedTotal > 100) {
    isValid = false;
    warnings.push(`Soma dos percentuais de rateio (${roundedTotal}%) excede 100%.`);
  } else if (roundedTotal === 100) {
    isComplete = true;
  } else {
    warnings.push(`Soma dos percentuais de rateio (${roundedTotal}%) é inferior a 100%. Saldo restante: ${(100 - roundedTotal).toFixed(1)}%.`);
  }

  // Validação de duplicatas de UC
  const ucs = beneficiaries.map(b => b.utilityId.trim()).filter(Boolean);
  const duplicates = ucs.filter((item, index) => ucs.indexOf(item) !== index);
  if (duplicates.length > 0) {
    warnings.push(`Número de UC duplicado detectado: ${Array.from(new Set(duplicates)).join(', ')}.`);
  }

  const beneficiariesWithCredits = beneficiaries.map(b => {
    const pct = Number(b.percentage) || 0;
    const estimatedKwh = (estimatedGenerationKwh * pct) / 100;
    const avgCons = Number(b.averageConsumptionKwh) || 0;
    const coveragePercent = avgCons > 0 ? Math.min(100, Math.round((estimatedKwh / avgCons) * 100)) : undefined;

    return {
      beneficiary: b,
      estimatedKwh: Math.round(estimatedKwh * 10) / 10,
      coveragePercent,
    };
  });

  return {
    totalPercentage: roundedTotal,
    isValid,
    isComplete,
    warnings,
    beneficiariesWithCredits,
  };
}

/**
 * Divide o percentual igualmente entre todas as UCs cadastradas (soma = 100%).
 */
export function distributeCreditsEqually(beneficiaries: CreditBeneficiary[]): CreditBeneficiary[] {
  if (!beneficiaries.length) return [];
  const count = beneficiaries.length;
  const equalShare = Math.floor((100 / count) * 100) / 100;
  const remainder = Math.round((100 - equalShare * count) * 100) / 100;

  return beneficiaries.map((b, idx) => ({
    ...b,
    percentage: idx === 0 ? Number((equalShare + remainder).toFixed(2)) : equalShare,
  }));
}
