import { TechnicalData, EquipmentBlock, VoltageLevel } from '../types';
import { VOLTAGES } from '../constants';

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
  totalDcPower: number;
  totalAcPower: number;
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

export const getBlockEngineeringStatus = (block: EquipmentBlock, technical: TechnicalData): BlockEngineeringResult => {
  const outputPhases = block.inverter.outputPhases || 1;
  const nominalCurrent = calculateNominalCurrent(block.inverter.power * block.inverterQty, technical.voltage, outputPhases);
  const suggestedBreaker = suggestBreaker(nominalCurrent);
  const breakerPolarity = getBreakerPolarity(outputPhases);

  const totalDcPower = (block.module.power * block.moduleQty) / 1000;
  const totalAcPower = block.inverter.power * block.inverterQty;
  const dcAcRatio = totalAcPower > 0 ? totalDcPower / totalAcPower : 0;

  let status = 'SUCCESS';
  const warnings: string[] = [];

  const voltageOption = VOLTAGES.find(v => v.value === technical.voltage);
  const gridVoltage = voltageOption ? voltageOption.lineVoltage : 220;

  const voltageDiff = Math.abs(block.inverter.nominalOutputVoltage - gridVoltage);
  const requiresTransformer = voltageDiff > (gridVoltage * 0.1);

  if (requiresTransformer) {
    status = 'WARNING';
    warnings.push(`Inversor ${block.inverter.model} (${block.inverter.nominalOutputVoltage}V) incompatível com rede (${gridVoltage}V). Transformador isolador necessário.`);
  }

  if (dcAcRatio > 1.35) {
    status = 'WARNING';
    warnings.push(`Bloco ${block.id}: Fator de Sobrecarga alto: ${(dcAcRatio * 100).toFixed(1)}%. Verifique limite do inversor.`);
  } else if (dcAcRatio < 0.7 && dcAcRatio > 0) {
    warnings.push(`Bloco ${block.id}: Inversor subutilizado (FDR: ${(dcAcRatio * 100).toFixed(1)}%).`);
  }

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
  if (usedMPPTs > block.inverter.mpptCount) {
    status = 'WARNING';
    warnings.push(`Bloco ${block.id}: Strings (${usedMPPTs}) > MPPTs (${block.inverter.mpptCount}). Necessário conector Y.`);
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
    totalDcPower,
    totalAcPower,
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
