import { UtilityCompany, ConnectionType, VoltageLevel } from '../types';

export const UTILITIES = [
  { value: UtilityCompany.LIGHT, label: 'Light (RJ) - RECON BT' },
  { value: UtilityCompany.ENEL_RJ, label: 'Enel (RJ) - CNC-GD' },
];

export const CONNECTION_TYPES = [
  { value: ConnectionType.MONOPHASIC, label: 'Monofásico' },
  { value: ConnectionType.BIPHASIC, label: 'Bifásico' },
  { value: ConnectionType.TRIPHASIC, label: 'Trifásico' },
];

export const VOLTAGES = [
  { value: VoltageLevel.V_127_220, label: '127/220V', lineVoltage: 220, phaseVoltage: 127 },
  { value: VoltageLevel.V_220_380, label: '220/380V', lineVoltage: 380, phaseVoltage: 220 },
];

export const STANDARD_BREAKERS = [40, 50, 63, 70, 80, 100, 125, 150, 175, 200, 225, 250, 300, 350, 400];

export const PAPER_SIZES: Record<string, { name: string; width: number; height: number; widthMm: number; heightMm: number; label: string }> = {
  A4: { name: 'A4', width: 3508, height: 2480, widthMm: 297, heightMm: 210, label: 'A4 Paisagem (297 x 210 mm)' },
  A3: { name: 'A3', width: 4961, height: 3508, widthMm: 420, heightMm: 297, label: 'A3 Paisagem (420 x 297 mm)' },
  A2: { name: 'A2', width: 7016, height: 4961, widthMm: 594, heightMm: 420, label: 'A2 Paisagem (594 x 420 mm)' },
  A1: { name: 'A1', width: 9933, height: 7016, widthMm: 841, heightMm: 594, label: 'A1 Paisagem (841 x 594 mm)' },
  A0: { name: 'A0', width: 14043, height: 9933, widthMm: 1189, heightMm: 841, label: 'A0 Paisagem (1189 x 841 mm)' },
};

export const DEFAULT_MODULE = {
  id: 0,
  brand: '',
  model: '',
  power: 0,
  voc: 0,
  isc: 0,
  vmp: 0,
  imp: 0,
};

export const DEFAULT_INVERTER = {
  id: 0,
  brand: '',
  model: '',
  power: 0,
  maxDcVoltage: 0,
  maxInputCurrent: 0,
  mpptMin: 0,
  mpptMax: 0,
  mpptCount: 0,
  nominalOutputVoltage: 0,
  outputPhases: 1,
};
