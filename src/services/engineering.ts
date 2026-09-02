import { TechnicalData, EquipmentBlock, VoltageLevel } from '../types';
import { VOLTAGES } from '../constants';
import { calculateDcProtection, DcProtectionResult } from './dcProtection';
import { evaluateTransformerNeed, TransformerResult } from './transformerDecision';

export type BreakerPolarity = 'Bipolar' | 'Tripolar';

export const calculateNominalCurrent = (powerKw: number, voltage: VoltageLevel, outputPhases: number): number => {
  const powerWatts = powerKw * 1000;
  const voltageOption = VOLTAGES.find(v => v.value === voltage);
  const lineVoltage = voltageOption ? voltageOption.lineVoltage : 220;

  if (outputPhases === 3) {
    return powerWatts / (Math.sqrt(3) * lineVoltage);
  } else {
    return powerWatts / lineVoltage;
  }
};

export const getBreakerPolarity = (outputPhases: number): BreakerPolarity => {
  return outputPhases === 3 ? 'Tripolar' : 'Bipolar';
};

export const suggestBreaker = (nominalCurrent: number): number => {
  const designCurrent = nominalCurrent * 1.25;
  const standardBreakers = [10, 16, 20, 25, 32, 40, 50, 63, 70, 80, 100, 125, 150, 175, 200, 225, 250];
  return standardBreakers.find(b => b >= designCurrent) || standardBreakers[standardBreakers.length - 1];
};

export interface BlockEngineeringResult {
  blockId: number;
  nominalCurrent: number;
  suggestedBreaker: number;
  breakerPolarity: BreakerPolarity;
  dcAcRatio: number;
  status: string;
  warnings: string[];
  requiresTransformer: boolean;
  transformerResult: TransformerResult;
  dcProtection: DcProtectionResult;
  totalDcPower: number;
  totalAcPower: number;
  isMicro?: boolean;
  microNominalCurrent?: number;
  trunkCurrent?: number;
  maxMicrosInSeries?: number;
}

export interface ProjectEngineeringResult {
  blocks: BlockEngineeringResult[];
  totalNominalCurrent: number;
  totalSuggestedBreaker: number;
  totalBreakerPolarity: BreakerPolarity;
  totalDcPower: number;
  totalAcPower: number;
  overallStatus: string;
  globalWarnings: string[];
}

/**
 * Calcula a corrente nominal CA de um microinversor individual (In).
 * Monofásico/Bifásico: In = P(W) / Vca
 * Trifásico: In = P(W) / (sqrt(3) * Vca)
 */
export const calculateMicroinverterAcCurrent = (powerKw: number, voltage: VoltageLevel, outputPhases: number): number => {
  return calculateNominalCurrent(powerKw, voltage, outputPhases);
};

/**
 * Calcula a corrente total acumulada no cabo tronco CA (Trunk Cable Daisy-Chain).
 * I_trunk = Qtd_micros * In
 */
export const calculateTrunkCurrent = (inverterQty: number, singleInverterCurrent: number): number => {
  return (inverterQty || 1) * singleInverterCurrent;
};

/**
 * Sugere a proteção por disjuntor para o ramal trunk (125% da corrente de projeto).
 */
export const suggestTrunkBreaker = (trunkCurrent: number): number => {
  return suggestBreaker(trunkCurrent);
};

/**
 * Calcula o limite máximo de microinversores em série por circuito trunk CA.
 * maxMicrosInSeries = floor(circuitBreakerRating / (In * 1.25))
 */
export const calculateMaxMicrosInSeries = (singleInverterCurrent: number, circuitBreakerRating: number = 20): number => {
  if (singleInverterCurrent <= 0) return 1;
  return Math.floor(circuitBreakerRating / (singleInverterCurrent * 1.25));
};

export const getBlockEngineeringStatus = (block: EquipmentBlock, technical: TechnicalData): BlockEngineeringResult => {
  const isMicro = block.inverter?.inverterType === 'micro' || (block as any).inverterType === 'micro';
  const outputPhases = block.inverter.outputPhases || 1;
  const singleMicroIn = calculateMicroinverterAcCurrent(block.inverter.power, technical.voltage, outputPhases);
  const inverterQty = block.inverterQty || 1;

  const trunkCurrent = calculateTrunkCurrent(inverterQty, singleMicroIn);
  const nominalCurrent = isMicro
    ? trunkCurrent
    : calculateNominalCurrent(block.inverter.power * inverterQty, technical.voltage, outputPhases);
  const suggestedBreaker = suggestBreaker(nominalCurrent);
  const breakerPolarity = getBreakerPolarity(outputPhases);

  const totalDcPower = (block.module.power * block.moduleQty) / 1000;
  const totalAcPower = block.inverter.power * inverterQty;
  const dcAcRatio = totalAcPower > 0 ? totalDcPower / totalAcPower : 0;

  let status = 'SUCCESS';
  const warnings: string[] = [];

  // ═══════════════════════════════════════
  // TRANSFORMER — Matriz de Fases (Feature 4)
  // ═══════════════════════════════════════
  const transformerResult = evaluateTransformerNeed(
    technical.connectionType,
    technical.voltage,
    block.inverter.nominalOutputVoltage,
    outputPhases,
    block.inverter.power * inverterQty,
  );
  const requiresTransformer = transformerResult.required;

  if (transformerResult.incompatible) {
    status = 'ERROR';
    warnings.push(`Bloco ${block.id}: ${transformerResult.reason}`);
  } else if (requiresTransformer) {
    status = 'WARNING';
    warnings.push(`Bloco ${block.id}: ${transformerResult.reason} (Sugerido: ${transformerResult.suggestedPowerKva} kVA ${transformerResult.type})`);
  }

  // ═══════════════════════════════════════
  // DC/AC RATIO
  // ═══════════════════════════════════════
  if (dcAcRatio > 1.35) {
    status = 'WARNING';
    warnings.push(`Bloco ${block.id}: Fator de Sobrecarga alto: ${(dcAcRatio * 100).toFixed(1)}%. Verifique limite do inversor.`);
  } else if (dcAcRatio < 0.7 && dcAcRatio > 0) {
    warnings.push(`Bloco ${block.id}: Inversor subutilizado (FDR: ${(dcAcRatio * 100).toFixed(1)}%).`);
  }

  // ═══════════════════════════════════════
  // STRING VALIDATION (Inversores String apenas)
  // ═══════════════════════════════════════
  if (!isMicro) {
    const TEMPERATURE_SAFETY_FACTOR = 1.15;
    const totalModulesInStrings = block.strings.reduce((acc, s) => acc + (Number(s.count) || 0), 0);

    if (totalModulesInStrings !== block.moduleQty) {
      warnings.push(`Bloco ${block.id}: Qtd. módulos nas strings (${totalModulesInStrings}) difere do total (${block.moduleQty}).`);
    }

    block.strings.forEach((str, idx) => {
      const count = Number(str.count) || 0;

      const stringMaxVoltage = count * block.module.voc * TEMPERATURE_SAFETY_FACTOR;
      if (stringMaxVoltage > block.inverter.maxDcVoltage) {
        status = 'ERROR';
        warnings.push(`Bloco ${block.id} String ${idx + 1}: Voc (${stringMaxVoltage.toFixed(0)}V) excede limite (${block.inverter.maxDcVoltage}V)!`);
      }

      const stringVmp = count * block.module.vmp;
      if (stringVmp < block.inverter.mpptMin) {
        status = 'ERROR';
        warnings.push(`Bloco ${block.id} String ${idx + 1}: Vmp (${stringVmp.toFixed(0)}V) abaixo do MPPT mín (${block.inverter.mpptMin}V).`);
      } else if (stringVmp > block.inverter.mpptMax) {
        status = 'WARNING';
        warnings.push(`Bloco ${block.id} String ${idx + 1}: Vmp (${stringVmp.toFixed(0)}V) acima do MPPT máx (${block.inverter.mpptMax}V).`);
      }
    });

    const usedMPPTs = block.strings.length;
    const mpptCount = Math.max(block.inverter.mpptCount || 1, 1);
    const parallelPerMppt = Math.ceil(usedMPPTs / mpptCount);

    if (usedMPPTs > block.inverter.mpptCount) {
      status = 'WARNING';
      warnings.push(`Bloco ${block.id}: Strings (${usedMPPTs}) > MPPTs (${block.inverter.mpptCount}). Necessário conector Y (${parallelPerMppt} strings/MPPT).`);
    }

    // Validação de Corrente por Rastreador MPPT
    if (block.inverter.maxInputCurrent > 0) {
      const mpptImp = (block.module.imp || block.module.isc * 0.95) * parallelPerMppt;
      const mpptIsc = block.module.isc * parallelPerMppt;
      const maxIscSafety = block.inverter.maxInputCurrent * 1.25;

      if (mpptIsc > maxIscSafety) {
        status = 'ERROR';
        warnings.push(`Bloco ${block.id}: Isc por MPPT (${mpptIsc.toFixed(1)}A com ${parallelPerMppt} strings/tracker) excede limite seguro (${maxIscSafety.toFixed(1)}A)! Risco de queima da entrada MPPT.`);
      } else if (mpptImp > block.inverter.maxInputCurrent) {
        if (status !== 'ERROR') status = 'WARNING';
        warnings.push(`Bloco ${block.id}: Imp por MPPT (${mpptImp.toFixed(1)}A) excede corrente máxima (${block.inverter.maxInputCurrent}A). Ocorrerá perda por clipping de corrente.`);
      }
    }
  }

  // ═══════════════════════════════════════
  // MICROINVERTER VALIDATION (NBR 16690 / NBR 5410)
  // ═══════════════════════════════════════
  let maxMicrosInSeries: number | undefined = undefined;
  if (isMicro) {
    const defaultTrunkRating = 20; // 20A padrão para trunk cable NBR 5410 / NBR 16690
    const calculatedMaxMicros = calculateMaxMicrosInSeries(singleMicroIn, defaultTrunkRating);
    maxMicrosInSeries = block.inverter.maxMicrosInSeries || calculatedMaxMicros;

    // 1. Limite do trunk cable (máx micros em série)
    if (inverterQty > maxMicrosInSeries) {
      status = 'WARNING';
      warnings.push(`Bloco ${block.id}: ${inverterQty} microinversores excede limite do trunk cable (${maxMicrosInSeries} em série). Risco de sobrecarga no ramal trunk.`);
    }

    // 2. Potência por entrada MPPT
    const maxInputPowerW = block.inverter.maxInputPowerW || 650;
    if (block.module.power > maxInputPowerW) {
      if (status !== 'ERROR') status = 'WARNING';
      warnings.push(`Bloco ${block.id}: Potência do módulo (${block.module.power}W) excede máx por entrada do micro (${maxInputPowerW}W). Alerta de sobrecarga por entrada MPPT.`);
    }

    // 3. Sobretensão CC na entrada do microinversor
    const maxDcVoltage = block.inverter.maxDcVoltage || 60;
    if (block.module.voc > maxDcVoltage) {
      status = 'ERROR';
      warnings.push(`Bloco ${block.id}: Tensão Voc do módulo (${block.module.voc}V) excede limite máx CC da entrada do microinversor (${maxDcVoltage}V)! Alerta de sobretensão CC.`);
    }
  }

  // ═══════════════════════════════════════
  // DC PROTECTION — para microinversores, proteções CC integradas
  // ═══════════════════════════════════════
  const dcProtection: DcProtectionResult = isMicro
    ? {
        fuseRequired: false,
        fuseRating: 0,
        fuseVoltage: 0,
        switchRequired: false,
        switchRating: 0,
        switchVoltage: 0,
        dpsVoltage: 0,
        dpsClass: 'N/A',
        minCableSection: 0,
        warnings: [],
      }
    : calculateDcProtection(block.module, block.inverter, block.strings);

  // Propaga warnings da proteção CC se não for micro
  if (!isMicro) {
    dcProtection.warnings.forEach(w => warnings.push(w));
  }

  return {
    blockId: block.id,
    nominalCurrent,
    suggestedBreaker,
    breakerPolarity,
    dcAcRatio,
    status,
    warnings,
    requiresTransformer,
    transformerResult,
    dcProtection,
    totalDcPower,
    totalAcPower,
    isMicro,
    microNominalCurrent: isMicro ? singleMicroIn : undefined,
    trunkCurrent: isMicro ? trunkCurrent : undefined,
    maxMicrosInSeries: isMicro ? maxMicrosInSeries : undefined,
  };
};

export const getProjectEngineeringStatus = (blocks: EquipmentBlock[], technical: TechnicalData): ProjectEngineeringResult => {
  const blockResults = blocks.map(b => getBlockEngineeringStatus(b, technical));

  const totalNominalCurrent = blockResults.reduce((acc, r) => acc + r.nominalCurrent, 0);
  const totalSuggestedBreaker = suggestBreaker(totalNominalCurrent);
  const totalDcPower = blockResults.reduce((acc, r) => acc + r.totalDcPower, 0);
  const totalAcPower = blockResults.reduce((acc, r) => acc + r.totalAcPower, 0);

  // Total breaker polarity: if any inverter is 3-phase, use Tripolar
  const hasThreePhase = blockResults.some(r => r.breakerPolarity === 'Tripolar');
  const totalBreakerPolarity: BreakerPolarity = hasThreePhase ? 'Tripolar' : 'Bipolar';

  let overallStatus = 'SUCCESS';
  const globalWarnings: string[] = [];

  blockResults.forEach(r => {
    if (r.status === 'ERROR') overallStatus = 'ERROR';
    else if (r.status === 'WARNING' && overallStatus !== 'ERROR') overallStatus = 'WARNING';
  });

  if (totalNominalCurrent > technical.mainBreaker) {
    overallStatus = 'ERROR';
    globalWarnings.push(`Corrente total dos inversores (${totalNominalCurrent.toFixed(1)}A) maior que disjuntor geral (${technical.mainBreaker}A). Necessário aumento de carga.`);
  }

  return {
    blocks: blockResults,
    totalNominalCurrent,
    totalSuggestedBreaker,
    totalBreakerPolarity,
    totalDcPower,
    totalAcPower,
    overallStatus,
    globalWarnings,
  };
};
