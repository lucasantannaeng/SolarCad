/**
 * Cable sizing and protection calculations for diagram labels.
 */
import { VOLTAGES } from '@/constants';
import { suggestBreaker, calculateNominalCurrent } from '@/services/engineering';
import { TechnicalData, VoltageLevel } from '@/types';

const cableTable = [
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

export interface CableResult {
  nominalCurrent: string;
  designCurrent: string;
  breaker: string;
  breakerValue: number;
  cableSimple: string;
  earthSimple: string;
  conduit: string;
  conductorLabel: string;
  phases: number;
  voltageDrop: string;
  dps: string;
}

export const getPhases = (connectionType: string): number => {
  if (connectionType === 'TRIFASICO') return 3;
  if (connectionType === 'BIFASICO') return 2;
  return 1;
};

export const getCableForCurrent = (nominalCurrent: number, tech: TechnicalData): CableResult => {
  const voltageOption = VOLTAGES.find(v => v.value === tech.voltage);
  const lineVoltage = voltageOption ? voltageOption.lineVoltage : 220;
  const phaseVoltage = voltageOption ? voltageOption.phaseVoltage : 127;
  const phases = getPhases(tech.connectionType);
  const factorDrop = phases === 3 ? 1.732 : 2;

  const selectedBreaker = suggestBreaker(nominalCurrent);
  let selectedCableObj = cableTable.find(c => c.capacity >= selectedBreaker) || cableTable[cableTable.length - 1];

  const RHO = 0.018;
  const MAX_DROP_PERCENT = 2.0;
  const distanceMeters = tech.distance;

  let voltageDropPercent = 100;
  let finalSection = selectedCableObj.section;
  let finalConduit = selectedCableObj.conduit;

  for (let i = cableTable.indexOf(selectedCableObj); i < cableTable.length; i++) {
    const sec = cableTable[i].section;
    const dropV = (factorDrop * RHO * distanceMeters * nominalCurrent) / sec;
    const dropP = (dropV / lineVoltage) * 100;
    if (dropP <= MAX_DROP_PERCENT) {
      finalSection = sec; finalConduit = cableTable[i].conduit; voltageDropPercent = dropP; break;
    }
    finalSection = sec; finalConduit = cableTable[i].conduit; voltageDropPercent = dropP;
  }

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

  return {
    nominalCurrent: nominalCurrent.toFixed(1),
    designCurrent: (nominalCurrent * 1.25).toFixed(1),
    breaker: `${selectedBreaker}A ${breakerType}`,
    breakerValue: selectedBreaker,
    cableSimple: cableStr,
    earthSimple: earthStr,
    conduit: finalConduit,
    conductorLabel: `${phases}#${cableStr} + 1#${earthStr}(T) 750V`,
    phases,
    voltageDrop: voltageDropPercent.toFixed(2),
    dps: `DPS Cl.II 20kA ${dpsUc}`,
  };
};

// ═══════════════════════════════════════════════════════════
// DC Cable Sizing — Cabos solares PV Wire (1.5kV / 1.8kV)
// ═══════════════════════════════════════════════════════════

const dcCableTable = [
  { section: 2.5, capacity: 26 },
  { section: 4.0, capacity: 34 },
  { section: 6.0, capacity: 44 },
  { section: 10.0, capacity: 61 },
  { section: 16.0, capacity: 82 },
];

export interface DcCableResult {
  section: number;
  capacity: number;
  voltageDrop: number;
  label: string;
  designCurrent: number;
}

/**
 * Dimensiona cabo CC para strings fotovoltaicas.
 * @param isc - Corrente de curto-circuito do módulo (A)
 * @param stringsInParallel - Strings em paralelo no mesmo MPPT
 * @param vmpString - Tensão Vmp da string (V)
 * @param distanceMeters - Distância módulo→inversor (m)
 */
export const getDcCable = (
  isc: number,
  stringsInParallel: number,
  vmpString: number,
  distanceMeters: number,
): DcCableResult => {
  const RHO_CU = 0.018; // Ω·mm²/m (cobre a 70°C)
  const MAX_DROP_PERCENT = 1.5;

  // Corrente de projeto: Isc × 1.25 × N_strings_paralelo
  const designCurrent = isc * 1.25 * stringsInParallel;

  // Selecionar cabo mínimo por ampacidade
  let startIdx = dcCableTable.findIndex(c => c.capacity >= designCurrent);
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

    if (dropPercent <= MAX_DROP_PERCENT) {
      finalSection = sec;
      finalCapacity = dcCableTable[i].capacity;
      voltageDropPercent = dropPercent;
      break;
    }
    finalSection = sec;
    finalCapacity = dcCableTable[i].capacity;
    voltageDropPercent = dropPercent;
  }

  const label = `${finalSection.toFixed(1).replace('.', ',')}mm² 1,5kV CC`;

  return {
    section: finalSection,
    capacity: finalCapacity,
    voltageDrop: voltageDropPercent,
    label,
    designCurrent,
  };
};

