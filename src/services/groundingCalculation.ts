/**
 * Grounding Grid and Electrodes Calculation Service
 * Dimensionamento da Malha e Eletrodos de Aterramento para Sistemas Solares Fotovoltaicos.
 * Conforme ABNT NBR 5419 (Proteção contra descargas atmosféricas), ABNT NBR 16690 (Instalações FV) e ABNT NBR 5410 (Instalações elétricas de BT).
 *
 * Referências Normativas:
 * - ABNT NBR 5410:2004 (Instalações elétricas de baixa tensão)
 * - ABNT NBR 16690:2019 (Instalações elétricas de arranjos fotovoltaicos)
 * - ABNT NBR 5419-3:2015 (Proteção contra descargas atmosféricas - Danos físicos e perigos à vida)
 * - ABNT NBR IEC 62116 (Procedimento de Ensaio de Anti-ilhamento)
 */
import { ProjectState } from '../types';
import { getProjectEngineeringStatus } from './engineering';
import { getCableForCurrent } from '../components/diagram/cableCalculations';

export type GroundingArrangement = 'TRIANGLE' | 'ALIGNED' | 'RING_GRID' | 'AUTO';
export type InspectionBoxType = 'GROUND_CONCRETE' | 'WALL_PVC' | 'AUTO';

export interface GroundingOptions {
  /** Resistividade aparente do solo em Ω·m (default: 150 Ω·m - solo misto/argiloso) */
  soilResistivity?: number;
  /** Resistência máxima de aterramento almejada em Ω (default: 10 Ω conforme NBR 5419 / NBR 16690) */
  targetResistance?: number;
  /** Comprimento da haste de aterramento em metros (default: 2.40m) */
  rodLength?: number;
  /** Diâmetro da haste em metros (default: 0.015875m = 5/8") */
  rodDiameter?: number;
  /** Preferência de arranjo geométrico das hastes */
  arrangementPreference?: GroundingArrangement;
  /** Tipo de caixa de inspeção */
  inspectionBoxType?: InspectionBoxType;
  /** Indica se o aterramento é integrado ao SPDA do imóvel (NBR 5419) */
  spdaIntegrated?: boolean;
}

export interface GroundingRodSpec {
  quantity: number;
  arrangement: 'Triângulo' | 'Alinhadas em Linha Reta' | 'Anel / Malha Perimétrica' | 'Individual';
  lengthMeters: number;
  diameterInches: string;
  spacingMeters: number;
  material: string;
}

export interface GroundingConductorSpec {
  mainBareCopperSectionMm2: number;
  mainBareCopperLabel: string;
  peProtectionSectionMm2: number;
  peProtectionLabel: string;
  moduleEquipotentialSectionMm2: number;
  moduleEquipotentialLabel: string;
}

export interface InspectionBoxSpec {
  type: 'Caixa de Inspeção Solo com Tampa de Concreto' | 'Caixa de Inspeção Suspensa PVC';
  dimensions: string;
  material: string;
  cover: string;
  measurementConnector: string;
}

export interface GroundingResult {
  soilResistivity: number;
  targetResistance: number;
  singleRodResistance: number;
  estimatedGridResistance: number;
  rodSpec: GroundingRodSpec;
  conductorSpec: GroundingConductorSpec;
  inspectionBoxSpec: InspectionBoxSpec;
  status: 'SUCCESS' | 'WARNING';
  warnings: string[];
  credits: string[];
}

/**
 * Calcula a resistência elétrica de uma única haste vertical cravada no solo.
 * Utiliza a fórmula clássica de Dwight / IEEE Std 80 / NBR 5419:
 * R1 = (ρ / (2 * π * L)) * (ln(4 * L / d) - 1)
 *
 * @param soilResistivity - Resistividade aparente do solo (Ω·m)
 * @param lengthMeters - Comprimento da haste (m, padrão 2.40m)
 * @param diameterMeters - Diâmetro da haste (m, padrão 0.015875m = 5/8")
 */
export const calculateSingleRodResistance = (
  soilResistivity: number = 150,
  lengthMeters: number = 2.40,
  diameterMeters: number = 0.015875
): number => {
  const L = Math.max(lengthMeters, 1.0);
  const d = Math.max(diameterMeters, 0.005);
  const lnTerm = Math.log((4 * L) / d) - 1.0;
  const r1 = (soilResistivity / (2 * Math.PI * L)) * lnTerm;
  return Number(r1.toFixed(2));
};

/**
 * Calcula a eficiência de agrupamento (fator η) e resistência equivalente de N hastes.
 * Conforme Rüdenberg / Dwight para espaçamento S >= L (2.40m).
 */
export const calculateGridResistance = (
  singleRodR: number,
  rodCount: number,
  arrangement: GroundingArrangement = 'AUTO'
): number => {
  if (rodCount <= 1) return singleRodR;

  // Fatores de eficiência de agrupamento geométrico (η):
  let eta = 1.0;
  if (rodCount === 2) eta = 0.90;
  else if (rodCount === 3) eta = arrangement === 'ALIGNED' ? 0.82 : 0.85; // Triângulo = 0.85
  else if (rodCount === 4) eta = 0.80;
  else if (rodCount <= 6) eta = 0.75;
  else if (rodCount <= 8) eta = 0.70;
  else eta = 0.65;

  const rEq = singleRodR / (rodCount * eta);
  return Number(rEq.toFixed(2));
};

/**
 * Dimensiona os condutores de aterramento principal, proteção PE e equipotencialização.
 * Conforme NBR 5410 Tabela 58 e NBR 16690 §6.5.
 */
export const dimensionGroundingConductor = (
  phaseSectionMm2: number = 6.0,
  isSpdaIntegrated: boolean = false,
  isGroundBuried: boolean = true
): GroundingConductorSpec => {
  // 1. Condutor enterrado em cobre nu (Interligação dos eletrodos de aterramento):
  // Mínimo 25mm² para solo protegido/não protegido contra corrosão (NBR 5410 Tabela 51 / NBR 5419)
  // Se integrado ao SPDA ou usina > 75kWp: mínimo 35mm² ou 50mm²
  const mainBareCopperSectionMm2 = isSpdaIntegrated || phaseSectionMm2 > 35 ? 35 : 25;
  const mainBareCopperLabel = `Cabo de cobre nu recozido ${mainBareCopperSectionMm2}mm² enterrado a 0,50m do solo`;

  // 2. Condutor de proteção PE (Cabo verde / verde-amarelo 750V / 1kV):
  // Conforme Tabela 58 NBR 5410:
  // S <= 16mm²  -> Spe = S (mínimo 6mm² para fotovoltaico)
  // 16 < S <= 35 -> Spe = 16mm²
  // S > 35       -> Spe = S / 2
  let peSection = phaseSectionMm2;
  if (phaseSectionMm2 <= 16) {
    peSection = Math.max(phaseSectionMm2, 6.0);
  } else if (phaseSectionMm2 <= 35) {
    peSection = 16;
  } else {
    peSection = Math.ceil(phaseSectionMm2 / 2);
  }
  const peProtectionLabel = `Cabo de cobre isolado PVC 750V verde ${peSection.toFixed(1).replace('.', ',')}mm² (PE)`;

  // 3. Condutor de equipotencialização das estruturas e carcaças dos módulos FV (NBR 16690):
  // Mínimo 6mm² flexível verde com terminais estanhados
  const moduleEquipotentialSectionMm2 = 6.0;
  const moduleEquipotentialLabel = `Cabo verde flexível 6,0mm² para equipotencialização de carcaças e perfis de alumínio`;

  return {
    mainBareCopperSectionMm2,
    mainBareCopperLabel,
    peProtectionSectionMm2: peSection,
    peProtectionLabel,
    moduleEquipotentialSectionMm2,
    moduleEquipotentialLabel,
  };
};

/**
 * Especifica a caixa de inspeção de aterramento e acessórios de teste.
 */
export const specifyInspectionBox = (type: InspectionBoxType = 'AUTO'): InspectionBoxSpec => {
  if (type === 'WALL_PVC') {
    return {
      type: 'Caixa de Inspeção Suspensa PVC',
      dimensions: '200x200x100mm',
      material: 'Termoplástico PVC autoextinguível anti-chama',
      cover: 'Tampa plástica de sobrepor com parafusos em aço inox',
      measurementConnector: 'Barra de equalização de potencial (BEP) com desconector de medição para ensaios ôhmicos',
    };
  }

  return {
    type: 'Caixa de Inspeção Solo com Tampa de Concreto',
    dimensions: 'Cilíndrica Ø300mm ou Quadrada 300x300mm x 400mm prof.',
    material: 'Alvenaria de tijolos maciços ou tubo PVC reforçado rígido',
    cover: 'Tampa de concreto armado 300x300mm com puxador escamoteável e gravação ATERRAMENTO',
    measurementConnector: 'Grampo conector tipo cabo-haste em latão estanhado / GTDU de alta condutividade',
  };
};

/**
 * Dimensiona a malha e eletrodos de aterramento para o projeto fotovoltaico.
 * Conforme ABNT NBR 5419, ABNT NBR 16690 e ABNT NBR 5410.
 *
 * @param projectData - Estado completo do projeto SolarCad
 * @param options - Parâmetros opcionais de resistividade, meta de resistência e geometria
 */
export const calculateGroundingGrid = (
  projectData: ProjectState,
  options?: GroundingOptions
): GroundingResult => {
  const warnings: string[] = [];
  const soilResistivity = options?.soilResistivity ?? 150;
  const targetResistance = options?.targetResistance ?? 10.0;
  const rodLength = options?.rodLength ?? 2.40;
  const rodDiameter = options?.rodDiameter ?? 0.015875; // 5/8"
  const spdaIntegrated = options?.spdaIntegrated ?? false;
  const arrangementPref = options?.arrangementPreference ?? 'AUTO';
  const inspectionBoxPref = options?.inspectionBoxType ?? 'AUTO';

  // 1. Análise de potência e corrente do projeto
  const engResult = getProjectEngineeringStatus(projectData.equipmentBlocks, projectData.technical);
  const totalDcPowerKwp = engResult.totalDcPower;
  const cableRes = getCableForCurrent(engResult.totalNominalCurrent, projectData.technical);
  const phaseSection = parseFloat(cableRes.cableSimple.replace('mm²', '').replace(',', '.')) || 6.0;

  // 2. Resistência de uma única haste (Fórmula de Dwight)
  const singleRodR = calculateSingleRodResistance(soilResistivity, rodLength, rodDiameter);

  // 3. Determinação do número de hastes N
  // Mínimo de hastes conforme o porte da usina e boas práticas de engenharia:
  // - Sistemas residenciais/comerciais padrão: mínimo 3 hastes (arranjo em triângulo)
  // - Grandes sistemas (> 75 kWp): mínimo 6 hastes (anel/malha)
  let minRods = 3;
  if (totalDcPowerKwp > 75) {
    minRods = 6;
  } else if (totalDcPowerKwp < 3 && singleRodR <= targetResistance) {
    minRods = 1;
  }

  let rodCount = minRods;
  let estimatedGridR = calculateGridResistance(singleRodR, rodCount, arrangementPref);

  // Incrementa número de hastes até satisfazer a resistência de projeto (R <= targetResistance)
  const MAX_RODS_SEARCH = 24;
  while (estimatedGridR > targetResistance && rodCount < MAX_RODS_SEARCH) {
    rodCount += (rodCount >= 4 ? 2 : 1);
    estimatedGridR = calculateGridResistance(singleRodR, rodCount, arrangementPref);
  }

  if (estimatedGridR > targetResistance) {
    warnings.push(
      `Resistência estimada (${estimatedGridR.toFixed(1)} Ω) com ${rodCount} hastes supera a meta (${targetResistance} Ω) devido à alta resistividade do solo (${soilResistivity} Ω·m). Recomenda-se tratamento de solo com gel condutivo ou condutor em anel fechado perimétrico (NBR 5419).`
    );
  }

  // 4. Determinação do arranjo geométrico
  let arrangement: GroundingRodSpec['arrangement'] = 'Triângulo';
  if (arrangementPref === 'ALIGNED') {
    arrangement = 'Alinhadas em Linha Reta';
  } else if (arrangementPref === 'RING_GRID' || rodCount >= 6) {
    arrangement = 'Anel / Malha Perimétrica';
  } else if (rodCount === 1) {
    arrangement = 'Individual';
  } else if (rodCount === 3) {
    arrangement = 'Triângulo';
  } else {
    arrangement = 'Alinhadas em Linha Reta';
  }

  const rodSpec: GroundingRodSpec = {
    quantity: rodCount,
    arrangement,
    lengthMeters: rodLength,
    diameterInches: '5/8"',
    spacingMeters: Math.max(rodLength, 2.40),
    material: 'Hastes de aço cobreado com camada eletrolítica de cobre ≥ 254µm (alta camada - NBR 13571 / NBR 5419)',
  };

  // 5. Dimensionamento dos Condutores
  const isLargePower = totalDcPowerKwp > 75;
  const conductorSpec = dimensionGroundingConductor(phaseSection, spdaIntegrated || isLargePower, true);

  // 6. Especificação da Caixa de Inspeção
  const inspectionBoxSpec = specifyInspectionBox(inspectionBoxPref);

  const credits = [
    'ABNT NBR 5410:2004 - Instalações Elétricas de Baixa Tensão',
    'ABNT NBR 16690:2019 - Instalações Elétricas de Arranjos Fotovoltaicos',
    'ABNT NBR 5419-3:2015 - Proteção contra Descargas Atmosféricas (SPDA)',
    'ABNT NBR IEC 62116 - Procedimento de Ensaio de Anti-ilhamento',
  ];

  return {
    soilResistivity,
    targetResistance,
    singleRodResistance: singleRodR,
    estimatedGridResistance: estimatedGridR,
    rodSpec,
    conductorSpec,
    inspectionBoxSpec,
    status: warnings.length > 0 ? 'WARNING' : 'SUCCESS',
    warnings,
    credits,
  };
};
