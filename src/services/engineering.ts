import { TechnicalData, EquipmentBlock, VoltageLevel } from '../types';
import { VOLTAGES } from '../constants';
import { calculateDcProtection, DcProtectionResult } from './dcProtection';
import { evaluateTransformerNeed, TransformerResult } from './transformerDecision';

export type BreakerPolarity = 'Bipolar' | 'Tripolar';

// ═════════════════════════════════════════════════════════════════════
// NBR 5410 — TABELA 40: Fatores de Correção Térmica (FCT)
// Referência: 30°C no ar (Métodos A a F)
// Conforme ABNT NBR 5410 e ABNT NBR 16690
// ═════════════════════════════════════════════════════════════════════
export const TABLE_40_FCT_PVC: Record<number, number> = {
  10: 1.22,
  15: 1.17,
  20: 1.12,
  25: 1.06,
  30: 1.00,
  35: 0.94,
  40: 0.87,
  45: 0.79,
  50: 0.71,
  55: 0.61,
  60: 0.50, // Sob telhado / exposição solar direta
  65: 0.35,
};

export const TABLE_40_FCT_EPR_XLPE: Record<number, number> = {
  10: 1.15,
  15: 1.12,
  20: 1.08,
  25: 1.04,
  30: 1.00,
  35: 0.96,
  40: 0.91,
  45: 0.87,
  50: 0.82,
  55: 0.76,
  60: 0.71, // Sob telhado para cabos solares CC e cabos XLPE CA
  65: 0.65,
  70: 0.58,
  75: 0.50,
  80: 0.41,
};

// ═════════════════════════════════════════════════════════════════════
// NBR 5410 — TABELA 42: Fatores de Correção de Agrupamento (FCA)
// Métodos de instalação 1: em feixe ao ar livre, sobre superfícies, embutidos ou em condutos fechados
// ═════════════════════════════════════════════════════════════════════
export const TABLE_42_FCA: Record<number, number> = {
  1: 1.00,
  2: 0.80,
  3: 0.70,
  4: 0.65,
  5: 0.60,
  6: 0.57,
  7: 0.54,
  8: 0.52,
  9: 0.50,
  10: 0.50,
  11: 0.50,
  12: 0.45,
  13: 0.45,
  14: 0.45,
  15: 0.45,
  16: 0.41,
  17: 0.41,
  18: 0.41,
  19: 0.41,
  20: 0.38,
};

/**
 * Obtém o Fator de Correção de Temperatura (FCT) segundo a NBR 5410 Tabela 40.
 */
export const getFCT = (temperature: number = 30, insulation: 'PVC' | 'EPR' | 'XLPE' = 'PVC'): number => {
  const table = insulation === 'PVC' ? TABLE_40_FCT_PVC : TABLE_40_FCT_EPR_XLPE;
  const temps = Object.keys(table).map(Number).sort((a, b) => a - b);

  if (temperature <= temps[0]) return table[temps[0]];
  if (temperature >= temps[temps.length - 1]) return table[temps[temps.length - 1]];

  if (table[temperature] !== undefined) {
    return table[temperature];
  }

  // Interpolação linear se a temperatura estiver entre dois pontos tabelados
  for (let i = 0; i < temps.length - 1; i++) {
    const t1 = temps[i];
    const t2 = temps[i + 1];
    if (temperature > t1 && temperature < t2) {
      const f1 = table[t1];
      const f2 = table[t2];
      const interpolated = f1 + ((temperature - t1) / (t2 - t1)) * (f2 - f1);
      return Number(interpolated.toFixed(3));
    }
  }
  return 1.0;
};

/**
 * Obtém o Fator de Correção de Agrupamento (FCA) segundo a NBR 5410 Tabela 42.
 */
export const getFCA = (circuitCount: number = 1): number => {
  if (circuitCount <= 1) return 1.00;
  if (circuitCount >= 20) return 0.38;
  if (TABLE_42_FCA[circuitCount] !== undefined) {
    return TABLE_42_FCA[circuitCount];
  }
  if (circuitCount >= 9 && circuitCount <= 11) return 0.50;
  if (circuitCount >= 12 && circuitCount <= 15) return 0.45;
  if (circuitCount >= 16 && circuitCount <= 19) return 0.41;
  return 0.57;
};

/**
 * Calcula a corrente corrigida de projeto (Iz requerida) considerando FCT e FCA:
 * Iz = In / (FCT * FCA)
 * Conforme ABNT NBR 5410.
 */
export const calculateCorrectedCurrent = (nominalCurrent: number, fct: number = 1.0, fca: number = 1.0): number => {
  const factor = fct * fca;
  if (factor <= 0) return nominalCurrent;
  return Number((nominalCurrent / factor).toFixed(2));
};

// ═════════════════════════════════════════════════════════════════════
// CORRENTE DE CURTO-CIRCUITO E I²t DO DISJUNTOR (NBR 5410 / NBR 16690 / NBR IEC 60898)
// ═════════════════════════════════════════════════════════════════════
export const STANDARD_BREAKER_ICN_KA = [3.0, 4.5, 6.0, 10.0] as const;

export interface ShortCircuitResult {
  gridShortCircuitCurrentKa: number;
  inverterContributionCurrentA: number;
  totalShortCircuitCurrentKa: number;
  minBreakerIcnKa: number;
  breakerIcnValid: boolean;
  cableThermalWithstandA2s: number;
  passThroughEnergyA2s: number;
  cableThermalValid: boolean;
  warnings: string[];
}

/**
 * Calcula a corrente de curto-circuito presumida no barramento CA e valida o disjuntor e I²t do condutor.
 * Conforme NBR 5410 (§5.3), NBR 16690 e NBR IEC 60898.
 */
export const calculateShortCircuitAndI2t = (
  nominalCurrent: number,
  voltage: VoltageLevel,
  cableSectionMm2: number = 6.0,
  breakerIcnKa: number = 4.5,
  cableDistance: number = 15,
  insulation: 'PVC' | 'EPR' | 'XLPE' = 'PVC'
): ShortCircuitResult => {
  const warnings: string[] = [];
  const voltageOption = VOLTAGES.find(v => v.value === voltage);
  const phaseVoltage = voltageOption ? voltageOption.phaseVoltage : 127;

  // 1. Corrente de curto-circuito presumida da rede no barramento CA (estimativa típica BT urbana 3.5 ~ 4.5 kA)
  const baseGridIccKa = phaseVoltage >= 220 ? 4.5 : 3.5;
  const gridIccKa = baseGridIccKa;

  // 2. Contribuição dos inversores FV sob falta (NBR 16690 / IEC 62109: limitado eletronicamente a 1.1x In)
  const inverterContributionA = Number((nominalCurrent * 1.1).toFixed(2));
  const totalIccKa = Number((gridIccKa + inverterContributionA / 1000).toFixed(2));

  // 3. Validação da Capacidade de Interrupção Nominal do Disjuntor (Icn em kA)
  const minBreakerIcnKa = STANDARD_BREAKER_ICN_KA.find(icn => icn >= totalIccKa) || 10.0;
  const breakerIcnValid = breakerIcnKa >= totalIccKa;

  if (!breakerIcnValid) {
    warnings.push(
      `Icc presumida (${totalIccKa.toFixed(2)} kA) supera a capacidade de interrupção do disjuntor (${breakerIcnKa} kA). Risco de quebra/soldagem de contatos. Especificar disjuntor com Icn ≥ ${minBreakerIcnKa} kA (NBR IEC 60898).`
    );
  }

  // 4. Verificação da Integral de Joule / Suportabilidade Térmica do Cabo (NBR 5410 §5.3.4.3: k²S² ≥ I²t)
  const kFactor = insulation === 'PVC' ? 115 : 143;
  const cableThermalWithstand = Math.round(Math.pow(kFactor * cableSectionMm2, 2));

  // Tempo de atuação instantânea magnética do disjuntor sob curto-circuito (t ≈ 20ms = 0.02s)
  const tOpeningSec = 0.02;
  const totalIccA = totalIccKa * 1000;
  const passThroughEnergy = Math.round(Math.pow(totalIccA, 2) * tOpeningSec);

  const cableThermalValid = cableThermalWithstand >= passThroughEnergy;
  if (!cableThermalValid) {
    warnings.push(
      `Energia passante de curto-circuito (${passThroughEnergy} A²s) excede a suportabilidade térmica do cabo (${cableThermalWithstand} A²s). Aumente a seção do condutor para evitar queima térmica durante o curto-circuito.`
    );
  }

  return {
    gridShortCircuitCurrentKa: gridIccKa,
    inverterContributionCurrentA: inverterContributionA,
    totalShortCircuitCurrentKa: totalIccKa,
    minBreakerIcnKa,
    breakerIcnValid,
    cableThermalWithstandA2s: cableThermalWithstand,
    passThroughEnergyA2s: passThroughEnergy,
    cableThermalValid,
    warnings,
  };
};

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
  fct?: number;
  fca?: number;
  correctedCurrent?: number;
  shortCircuitResult?: ShortCircuitResult;
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
  fct?: number;
  fca?: number;
  correctedCurrent?: number;
  shortCircuitResult?: ShortCircuitResult;
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

  // Fatores de Correção Térmica e Agrupamento NBR 5410 padrão (30°C, 1 circuito)
  const fct = getFCT(30, 'PVC');
  const fca = getFCA(1);
  const correctedCurrent = calculateCorrectedCurrent(nominalCurrent, fct, fca);

  // Verificação de Curto-Circuito e I²t do Bloco
  const shortCircuitResult = calculateShortCircuitAndI2t(
    nominalCurrent,
    technical.voltage,
    6.0,
    4.5,
    technical.distance || 15,
    'PVC'
  );

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
    fct,
    fca,
    correctedCurrent,
    shortCircuitResult,
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

  const fct = getFCT(30, 'PVC');
  const fca = getFCA(1);
  const correctedCurrent = calculateCorrectedCurrent(totalNominalCurrent, fct, fca);

  // Verificação de Curto-Circuito Global no Barramento CA
  const shortCircuitResult = calculateShortCircuitAndI2t(
    totalNominalCurrent,
    technical.voltage,
    10.0,
    4.5,
    technical.distance || 15,
    'PVC'
  );

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

  // Alerta de capacidade de curto-circuito se o disjuntor padrão não suportar
  if (!shortCircuitResult.breakerIcnValid) {
    shortCircuitResult.warnings.forEach(w => globalWarnings.push(w));
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
    fct,
    fca,
    correctedCurrent,
    shortCircuitResult,
  };
};
