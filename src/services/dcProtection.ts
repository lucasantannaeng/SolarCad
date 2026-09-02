/**
 * DC Protection Calculations — Fusíveis, Seccionadora e DPS CC
 * Conforme NBR 16690 e práticas de engenharia fotovoltaica.
 */
import { ModuleData, InverterData, StringConfig } from '../types';

/** Standard commercial fuse ratings (gPV / gR) in Amperes */
const STANDARD_DC_FUSE_RATINGS = [10, 15, 16, 20, 25, 30, 32] as const;

export interface DcProtectionResult {
  // Fusível CC
  fuseRequired: boolean;
  fuseRating: number;
  fuseVoltage: number;

  // Seccionadora CC
  switchRequired: boolean;
  switchRating: number;
  switchVoltage: number;

  // DPS CC
  dpsVoltage: number;
  dpsClass: string;

  // Cabo CC (seção mínima por ampacidade)
  minCableSection: number;

  warnings: string[];
}

/**
 * Calcula as proteções DC do arranjo fotovoltaico.
 *
 * @param module - Dados do módulo FV (Isc, Voc)
 * @param inverter - Dados do inversor (maxDcVoltage)
 * @param strings - Configuração de strings (count = módulos em série)
 */
export function calculateDcProtection(
  module: ModuleData,
  inverter: InverterData,
  strings: StringConfig[],
): DcProtectionResult {
  // Para microinversores, as proteções CC são integradas no próprio equipamento (NBR 16690 / NBR 5410)
  if (inverter.inverterType === 'micro') {
    return {
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
    };
  }
  const warnings: string[] = [];
  const TEMP_SAFETY_FACTOR = 1.15;

  // Número de strings em paralelo
  const numStringsParallel = strings.length;

  // Corrente de projeto por string: 1.25 × Isc (NBR 16690 §6.3)
  const iscDesign = module.isc * 1.25;

  // Corrente total do arranjo (strings em paralelo)
  const totalArrayCurrent = iscDesign * numStringsParallel;

  // Tensão máxima da string (maior string × Voc × fator térmico)
  const maxModulesInString = Math.max(...strings.map(s => Number(s.count) || 0), 0);
  const vocStringMax = maxModulesInString * module.voc * TEMP_SAFETY_FACTOR;

  // ═══════════════════════════════════════
  // FUSÍVEL CC (NBR 16690 §6.3.3)
  // ═══════════════════════════════════════
  // Obrigatório quando ≥3 strings em paralelo no mesmo MPPT
  const fuseRequired = numStringsParallel >= 3;

  // In ≥ 1.5 × Isc do módulo
  const fuseMinCurrent = module.isc * 1.5;
  const fuseRating = STANDARD_DC_FUSE_RATINGS.find(r => r >= fuseMinCurrent)
    || STANDARD_DC_FUSE_RATINGS[STANDARD_DC_FUSE_RATINGS.length - 1];

  // Tensão nominal do fusível ≥ Voc,string × 1.15
  const fuseVoltage = Math.ceil(vocStringMax / 100) * 100; // Arredonda para centena (ex: 600V, 1000V, 1500V)

  if (fuseRequired) {
    if (fuseRating < fuseMinCurrent) {
      warnings.push(`Fusível CC: corrente necessária (${fuseMinCurrent.toFixed(1)}A) excede faixa comercial padrão.`);
    }
  }

  // ═══════════════════════════════════════
  // SECCIONADORA CC
  // ═══════════════════════════════════════
  // In ≥ 1.25 × Isc × N_strings
  const switchRating = Math.ceil(totalArrayCurrent);
  // Vn ≥ Voc,string × 1.15
  const switchVoltage = fuseVoltage; // Mesma lógica de tensão

  // ═══════════════════════════════════════
  // DPS CC (Classe II)
  // ═══════════════════════════════════════
  let dpsVoltage: number;
  if (vocStringMax <= 600) {
    dpsVoltage = 600;
  } else if (vocStringMax <= 1000) {
    dpsVoltage = 1000;
  } else {
    dpsVoltage = 1500;
  }

  // Verificação contra tensão máxima do inversor
  if (vocStringMax > inverter.maxDcVoltage) {
    warnings.push(`DPS CC: Voc arranjo (${vocStringMax.toFixed(0)}V) excede Vmax inversor (${inverter.maxDcVoltage}V).`);
  }

  // ═══════════════════════════════════════
  // SEÇÃO MÍNIMA DE CABO CC (por ampacidade)
  // ═══════════════════════════════════════
  // Tabela simplificada de cabos solares (PV Wire / EN 50618)
  const dcCableSections = [
    { section: 2.5, capacity: 26 },
    { section: 4.0, capacity: 34 },
    { section: 6.0, capacity: 44 },
    { section: 10.0, capacity: 61 },
    { section: 16.0, capacity: 82 },
  ];

  const minCableEntry = dcCableSections.find(c => c.capacity >= iscDesign)
    || dcCableSections[dcCableSections.length - 1];
  const minCableSection = minCableEntry.section;

  return {
    fuseRequired,
    fuseRating,
    fuseVoltage,
    switchRequired: true,
    switchRating,
    switchVoltage,
    dpsVoltage,
    dpsClass: 'Classe II',
    minCableSection,
    warnings,
  };
}
