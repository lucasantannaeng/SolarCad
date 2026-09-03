import { UtilityCompany, ConnectionType, VoltageLevel } from '../types';

export const UTILITIES = [
  { value: UtilityCompany.LIGHT, label: 'Light (RJ) - RECON BT' },
  { value: UtilityCompany.ENEL_RJ, label: 'Enel (RJ) - CNC-GD' },
  { value: UtilityCompany.CERCI, label: 'CERCI (RJ) - Cooperativa Cantagalo' },
  { value: UtilityCompany.ENERGISA, label: 'Energisa (RJ/MG/Nacional) - NDU-013' },
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
  inverterType: 'string' as const,
};

export interface StructureTypeOption {
  value: string;
  label: string;
  shortLabel: string;
  description: string;
}

export const STRUCTURE_TYPES: StructureTypeOption[] = [
  {
    value: 'CERAMIC',
    label: 'Telhado Cerâmico / Colonial',
    shortLabel: 'Cerâmico',
    description: 'Fixação por ganchos em caibros/ripas sob telhas cerâmicas/coloniais',
  },
  {
    value: 'METALLIC',
    label: 'Telha Metálica / Trapezoidal',
    shortLabel: 'Metálico',
    description: 'Mini-trilhos com parafusos autobrocantes em telhas de zinco/aço/sanduíche',
  },
  {
    value: 'FIBROCEMENT',
    label: 'Fibrocimento / Ondulado',
    shortLabel: 'Fibrocimento',
    description: 'Parafusos prisioneiros (haste roscada) fixados diretamente nas terças',
  },
  {
    value: 'FLAT_SLAB',
    label: 'Laje Plana / Triângulos',
    shortLabel: 'Laje Plana',
    description: 'Estruturas triangulares em alumínio/aço com inclinação e lastro/químico',
  },
  {
    value: 'GROUND',
    label: 'Solo / Solo Cravado',
    shortLabel: 'Solo',
    description: 'Estruturas monoposte/biposte cravadas, brocadas ou com sapatas de concreto',
  },
  {
    value: 'CARPORT',
    label: 'Garagem Solar / Carport',
    shortLabel: 'Carport',
    description: 'Estrutura metálica de cobertura para vagas de estacionamento/veículos',
  },
];

export interface CardinalPointOption {
  label: string;
  azimuth: number;
  code: string;
  description: string;
}

export const CARDINAL_POINTS: CardinalPointOption[] = [
  { label: 'Norte (N - 0°)', azimuth: 0, code: 'N', description: '0° - Orientação ideal de máxima irradiância no Brasil' },
  { label: 'Nordeste (NE - 45°)', azimuth: 45, code: 'NE', description: '45° - Pico de geração no início/meio da manhã' },
  { label: 'Leste (L/E - 90°)', azimuth: 90, code: 'L', description: '90° - Pico matutino com menor geração à tarde' },
  { label: 'Sudeste (SE - 135°)', azimuth: 135, code: 'SE', description: '135° - Orientação intermediária com perdas moderadas' },
  { label: 'Sul (S - 180°)', azimuth: 180, code: 'S', description: '180° - Menor aproveitamento solar no Hemisfério Sul' },
  { label: 'Sudoeste (SO - 225°)', azimuth: 225, code: 'SO', description: '225° - Orientação intermediária vespertina' },
  { label: 'Oeste (O/W - 270°)', azimuth: 270, code: 'O', description: '270° - Pico de geração à tarde/poente' },
  { label: 'Noroeste (NO - 315°)', azimuth: 315, code: 'NO', description: '315° - Alta geração no período da tarde' },
];

export const TILT_PRESETS = [10, 15, 18, 20, 25] as const;

export const DEFAULT_ROOF_PLANE_NAMES = [
  'Água 1 (Norte - Telhado Principal)',
  'Água 2 (Leste - Garagem)',
  'Água 3 (Oeste - Varanda)',
  'Água 4 (Sul - Secundária)',
  'Laje Plana / Triângulos',
  'Estrutura de Solo / Solo Cravado',
  'Carport / Garagem Solar',
] as const;

export function getStructureTypeLabel(value?: string): string {
  const match = STRUCTURE_TYPES.find(s => s.value === value);
  return match ? match.label : (value || 'Telhado Cerâmico / Colonial');
}

export function getAzimuthCardinalLabel(azimuth?: number): string {
  if (azimuth === undefined || azimuth === null) return '0° (Norte)';
  const normalized = ((azimuth % 360) + 360) % 360;
  // Match closest cardinal
  let closest = CARDINAL_POINTS[0];
  let minDiff = 360;
  for (const cp of CARDINAL_POINTS) {
    const diff = Math.min(Math.abs(normalized - cp.azimuth), 360 - Math.abs(normalized - cp.azimuth));
    if (diff < minDiff) {
      minDiff = diff;
      closest = cp;
    }
  }
  if (minDiff === 0) {
    return `${normalized}° (${closest.code})`;
  }
  return `${normalized}° (~${closest.code})`;
}

