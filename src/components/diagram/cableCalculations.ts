/**
 * Cable sizing and protection calculations for diagram labels.
 * Conforme ABNT NBR 5410 (Tabelas 40 e 42) e ABNT NBR 16690.
 */
import { VOLTAGES } from '@/constants';
import { suggestBreaker, getFCT, getFCA, calculateCorrectedCurrent } from '@/services/engineering';
import { TechnicalData } from '@/types';

// Tabela de capacidade de condução de corrente (Método B1 - Eletroduto embutido/aparente, 70°C PVC, 3 condutores carregados)
export const cableTable = [
  { section: 2.5, capacity: 24, conduit: "3/4\"" },
  { section: 4.0, capacity: 32, conduit: "3/4\"" },
  { section: 6.0, capacity: 41, conduit: "1\"" },
  { section: 10.0, capacity: 57, conduit: "1\"" },
  { section: 16.0, capacity: 76, conduit: "1.1/4\"" },
  { section: 25.0, capacity: 101, conduit: "1.1/4\"" },
  { section: 35.0, capacity: 125, conduit: "1.1/2\"" },
  { section: 50.0, capacity: 151, conduit: "2\"" },
  { section: 70.0, capacity: 192, conduit: "2.1/2\"" },
  { section: 95.0, capacity: 232, conduit: "3\"" },
  { section: 120.0, capacity: 269, conduit: "3\"" },
  { section: 150.0, capacity: 309, conduit: "4\"" },
];

export interface CableCalculationOptions {
  ambientTemp?: number;
  circuitCount?: number;
  insulation?: 'PVC' | 'EPR' | 'XLPE';
  maxDropPercent?: number;
}

export interface CableResult {
  nominalCurrent: string;
  designCurrent: string;
  breaker: string;
  breakerValue: number;
  cableSimple: string;
  earthSimple: string;
  conduit: string;
  conductorLabel: string;
  label: string;
  phases: number;
  voltageDrop: string;
  dps: string;
  fct: number;
  fca: number;
  correctedCurrent: string;
  correctedCapacity: string;
}

export const getPhases = (connectionType: string): number => {
  if (connectionType === 'TRIFASICO') return 3;
  if (connectionType === 'BIFASICO') return 2;
  return 1;
};

/**
 * Dimensiona o condutor CA com base na NBR 5410 (critérios de ampacidade com FCT e FCA e queda de tensão).
 *
 * @param nominalCurrent - Corrente nominal do circuito CA (A)
 * @param tech - Dados técnicos do projeto
 * @param options - Parâmetros opcionais (temperatura ambiente, agrupamento de circuitos, etc.)
 */
export const getCableForCurrent = (
  nominalCurrent: number,
  tech: TechnicalData,
  options?: CableCalculationOptions
): CableResult => {
  const voltageOption = VOLTAGES.find(v => v.value === tech.voltage);
  const lineVoltage = voltageOption ? voltageOption.lineVoltage : 220;
  const phaseVoltage = voltageOption ? voltageOption.phaseVoltage : 127;
  const phases = getPhases(tech.connectionType);
  const factorDrop = phases === 3 ? 1.732 : 2;

  // 1. Fatores de Correção Térmica e Agrupamento NBR 5410
  const ambientTemp = options?.ambientTemp ?? 30;
  const circuitCount = options?.circuitCount ?? 1;
  const insulation = options?.insulation ?? 'PVC';
  const maxDropPercent = options?.maxDropPercent ?? 2.0;

  const fct = getFCT(ambientTemp, insulation);
  const fca = getFCA(circuitCount);
  const correctionFactor = fct * fca;

  // Corrente corrigida de projeto requerida pelo condutor: Iz_req = In / (FCT * FCA)
  const correctedCurrent = calculateCorrectedCurrent(nominalCurrent, fct, fca);
  const selectedBreaker = suggestBreaker(nominalCurrent);

  // 2. Seleção inicial do cabo por capacidade de condução de corrente (Iz >= In / (FCT * FCA) e Iz >= In_disjuntor)
  // Conforme NBR 5410: Ib <= In <= Iz (onde Iz = I0 * FCT * FCA)
  let selectedCableObj = cableTable.find(c => {
    const effectiveCapacity = c.capacity * correctionFactor;
    return effectiveCapacity >= nominalCurrent && c.capacity >= selectedBreaker;
  }) || cableTable.find(c => c.capacity >= selectedBreaker) || cableTable[cableTable.length - 1];

  const RHO = 0.018; // Resistividade do cobre a 70°C (Ω·mm²/m)
  const distanceMeters = tech.distance || 15;

  let voltageDropPercent = 100;
  let finalSection = selectedCableObj.section;
  let finalConduit = selectedCableObj.conduit;
  let finalCapacity = selectedCableObj.capacity;

  // 3. Verificação e iteração pelo critério de queda de tensão máxima
  for (let i = cableTable.indexOf(selectedCableObj); i < cableTable.length; i++) {
    const sec = cableTable[i].section;
    const dropV = (factorDrop * RHO * distanceMeters * nominalCurrent) / sec;
    const dropP = (dropV / lineVoltage) * 100;
    finalSection = sec;
    finalConduit = cableTable[i].conduit;
    finalCapacity = cableTable[i].capacity;
    voltageDropPercent = dropP;

    if (dropP <= maxDropPercent) {
      break;
    }
  }

  // 4. Dimensionamento do condutor de proteção PE (Tabela 58 NBR 5410)
  let earthSection = finalSection;
  if (finalSection > 16 && finalSection <= 35) earthSection = 16;
  if (finalSection > 35) earthSection = finalSection / 2;

  let dpsUc = "275V";
  if (phaseVoltage > 240) dpsUc = "385V";

  let breakerType = "Monopolar";
  if (phases === 2) breakerType = "Bipolar";
  if (phases === 3) breakerType = "Tripolar";

  const cableStr = `${finalSection.toFixed(1).replace('.', ',')}mm²`;
  const earthStr = `${earthSection.toFixed(1).replace('.', ',')}mm²`;
  const conductorLabel = `${phases}#${cableStr} + 1#${earthStr}(T) 750V`;

  return {
    nominalCurrent: nominalCurrent.toFixed(1),
    designCurrent: (nominalCurrent * 1.25).toFixed(1),
    breaker: `${selectedBreaker}A ${breakerType}`,
    breakerValue: selectedBreaker,
    cableSimple: cableStr,
    earthSimple: earthStr,
    conduit: finalConduit,
    conductorLabel,
    label: conductorLabel,
    phases,
    voltageDrop: voltageDropPercent.toFixed(2),
    dps: `DPS Cl.II 20kA ${dpsUc}`,
    fct,
    fca,
    correctedCurrent: correctedCurrent.toFixed(1),
    correctedCapacity: (finalCapacity * correctionFactor).toFixed(1),
  };
};

// ═══════════════════════════════════════════════════════════
// DC Cable Sizing — Cabos solares PV Wire (1.5kV / 1.8kV)
// Conforme ABNT NBR 16690 e NBR 5410 Tabela 40 (EPR/XLPE 90°C)
// ═══════════════════════════════════════════════════════════

export const dcCableTable = [
  { section: 2.5, capacity: 26 },
  { section: 4.0, capacity: 34 },
  { section: 6.0, capacity: 44 },
  { section: 10.0, capacity: 61 },
  { section: 16.0, capacity: 82 },
];

export interface DcCableCalculationOptions {
  temp?: number;
  circuitCount?: number;
  maxDropPercent?: number;
}

export interface DcCableResult {
  section: number;
  capacity: number;
  voltageDrop: number;
  label: string;
  designCurrent: number;
  fct: number;
  fca: number;
  correctedDesignCurrent: number;
  correctedCapacity: number;
}

/**
 * Dimensiona cabo CC para strings fotovoltaicas com correção de temperatura e agrupamento.
 * @param isc - Corrente de curto-circuito do módulo (A)
 * @param stringsInParallel - Strings em paralelo no mesmo MPPT
 * @param vmpString - Tensão Vmp da string (V)
 * @param distanceMeters - Distância módulo→inversor (m)
 * @param options - Opções térmicas e de agrupamento
 */
export const getDcCable = (
  isc: number,
  stringsInParallel: number,
  vmpString: number,
  distanceMeters: number,
  options?: DcCableCalculationOptions
): DcCableResult => {
  const RHO_CU = 0.018; // Ω·mm²/m (cobre a 70°C)
  const MAX_DROP_PERCENT = options?.maxDropPercent ?? 1.5;

  // Fatores de correção para cabo solar CC (XLPE/EPR 90°C - NBR 5410 Tabela 40)
  const temp = options?.temp ?? 30;
  const circuitCount = options?.circuitCount ?? 1;
  const fct = getFCT(temp, 'XLPE');
  const fca = getFCA(circuitCount);
  const factor = fct * fca;

  // Corrente de projeto CC: Isc × 1.25 × N_strings_paralelo (NBR 16690 §6.3)
  const designCurrent = isc * 1.25 * stringsInParallel;
  const correctedDesignCurrent = Number((designCurrent / (factor > 0 ? factor : 1.0)).toFixed(2));

  // Selecionar cabo mínimo por ampacidade corrigida
  let startIdx = dcCableTable.findIndex(c => c.capacity >= correctedDesignCurrent);
  if (startIdx === -1) startIdx = dcCableTable.length - 1;

  let finalSection = dcCableTable[startIdx].section;
  let finalCapacity = dcCableTable[startIdx].capacity;
  let voltageDropPercent = 100;

  // Iterar seções até atender queda de tensão ≤ 1.5%
  for (let i = startIdx; i < dcCableTable.length; i++) {
    const sec = dcCableTable[i].section;
    // ΔV% = (2 × ρ × L × I) / (S × Vmp,string) × 100
    const dropPercent = vmpString > 0
      ? (2 * RHO_CU * distanceMeters * designCurrent) / (sec * vmpString) * 100
      : 0;

    finalSection = sec;
    finalCapacity = dcCableTable[i].capacity;
    voltageDropPercent = dropPercent;

    if (dropPercent <= MAX_DROP_PERCENT) {
      break;
    }
  }

  const label = `${finalSection.toFixed(1).replace('.', ',')}mm² 1,5kV CC`;

  return {
    section: finalSection,
    capacity: finalCapacity,
    voltageDrop: Number(voltageDropPercent.toFixed(2)),
    label,
    designCurrent: Number(designCurrent.toFixed(2)),
    fct,
    fca,
    correctedDesignCurrent,
    correctedCapacity: Number((finalCapacity * factor).toFixed(2)),
  };
};

