import { ProjectState, EquipmentBlock } from '../../types';
import { getProjectEngineeringStatus, getBlockEngineeringStatus } from '../../services/engineering';
import { getCableForCurrent, getPhases, getDcCable } from './cableCalculations';

export type PaperFormat = 'A4' | 'A3';

export interface DiagramDimensions {
  format: PaperFormat;
  pageW: number;
  pageH: number;
  marginL: number;
  marginR: number;
  marginT: number;
  marginB: number;
  safeW: number;
  safeH: number;
  seloW: number;
  seloH: number;
  seloX: number;
  seloY: number;
  tableW: number;
  tableH: number;
  tableX: number;
  tableY: number;
  drawW: number;
  drawH: number;
}

/**
 * Calcula as dimensões e grids milimétricos com margens ABNT para A4 e A3
 */
export function getDiagramDimensions(format: PaperFormat = 'A3'): DiagramDimensions {
  if (format === 'A4') {
    const pageW = 297;
    const pageH = 210;
    const marginL = 20; // 20mm para encadernação A4 ABNT
    const marginR = 8;
    const marginT = 8;
    const marginB = 8;

    const safeW = pageW - marginL - marginR; // 269 mm
    const safeH = pageH - marginT - marginB; // 194 mm

    const seloW = 135;
    const seloH = 34;
    const seloX = pageW - marginR - seloW; // 154 mm
    const seloY = pageH - marginB - seloH; // 168 mm

    const tableW = safeW - seloW - 6; // 128 mm
    const tableH = seloH;
    const tableX = marginL; // 20 mm
    const tableY = seloY; // 168 mm

    const drawW = safeW; // 269 mm
    const drawH = seloY - marginT - 6; // 154 mm

    return {
      format, pageW, pageH, marginL, marginR, marginT, marginB,
      safeW, safeH, seloW, seloH, seloX, seloY,
      tableW, tableH, tableX, tableY, drawW, drawH,
    };
  }

  // --- A3 Landscape (420 x 297 mm) - Formato Padrão de Engenharia CAD ---
  const pageW = 420;
  const pageH = 297;
  const marginL = 25; // 25mm para encadernação ABNT
  const marginR = 10;
  const marginT = 10;
  const marginB = 10;

  const safeW = pageW - marginL - marginR; // 385 mm
  const safeH = pageH - marginT - marginB; // 277 mm

  const seloW = 165;
  const seloH = 40;
  const seloX = pageW - marginR - seloW; // 245 mm
  const seloY = pageH - marginB - seloH; // 247 mm

  const tableW = safeW - seloW - 8; // 212 mm
  const tableH = seloH;
  const tableX = marginL; // 25 mm
  const tableY = seloY; // 247 mm

  const drawW = safeW; // 385 mm
  const drawH = seloY - marginT - 8; // 229 mm

  return {
    format, pageW, pageH, marginL, marginR, marginT, marginB,
    safeW, safeH, seloW, seloH, seloX, seloY,
    tableW, tableH, tableX, tableY, drawW, drawH,
  };
}

export interface TechnicalTableData {
  modulesInfo: string[];
  invertersInfo: string[];
  cablesInfo: string[];
  protectionsInfo: string[];
  ansiInfo: string[];
}

/**
 * Retorna a descrição completa e normatizada do padrão de rede e conexão
 */
export function getNetworkDescription(connectionType: string, voltage: string): string {
  const conn = String(connectionType || '').toUpperCase();
  if (conn.includes('TRIFAS') || conn === 'TRIPHASIC') {
    return `Rede ${voltage} Trifásica + Neutro`;
  }
  if (conn.includes('BIFAS') || conn === 'BIPHASIC') {
    return `Rede ${voltage} Bifásica + Neutro`;
  }
  return `Rede ${voltage} Monofásica + Neutro`;
}

/**
 * Retorna a composição dos condutores de fase e proteção (ex: 3F+N+PE, 2F+N+PE, F+N+PE)
 */
export function getPhasesConductorLabel(connectionType: string): string {
  const conn = String(connectionType || '').toUpperCase();
  if (conn.includes('TRIFAS') || conn === 'TRIPHASIC') {
    return '3F+N+PE';
  }
  if (conn.includes('BIFAS') || conn === 'BIPHASIC') {
    return '2F+N+PE';
  }
  return 'F+N+PE';
}

/**
 * Monta o quadro estruturado de especificações técnicas (Data Schedule / BOM)
 */
export function buildTechnicalTableData(projectData: ProjectState): TechnicalTableData {
  const eng = getProjectEngineeringStatus(projectData.equipmentBlocks, projectData.technical);
  const blocks = projectData.equipmentBlocks;
  const phasesLabel = getPhasesConductorLabel(projectData.technical.connectionType);
  const networkDesc = getNetworkDescription(projectData.technical.connectionType, projectData.technical.voltage);

  const modulesInfo: string[] = [];
  const invertersInfo: string[] = [];
  const cablesInfo: string[] = [];
  const protectionsInfo: string[] = [];

  blocks.forEach((b, idx) => {
    const isMicro = b.inverter?.inverterType === 'micro';
    const tagPrefix = isMicro ? `MICRO-${idx + 1}` : `INV-${idx + 1}`;
    const qty = b.inverterQty || 1;
    const blockEng = getBlockEngineeringStatus(b, projectData.technical);
    const pwr = b.modulePowerW || b.module?.power || 0;
    const pmpKwp = ((b.moduleQty * pwr) / 1000).toFixed(2);
    const brand = (b.moduleBrand || b.module?.brand || 'PV').toUpperCase();
    const model = (b.moduleModel || b.module?.model || '').toUpperCase();
    const voc = (b.module?.voc || 0).toFixed(1);
    const isc = (b.module?.isc || 0).toFixed(1);

    // 1. Módulos ricos
    modulesInfo.push(
      `MOD-${idx + 1}: ${b.moduleQty}x ${brand} ${model} (${pwr}W) | Pmp: ${pmpKwp} kWp | Voc: ${voc}V | Isc: ${isc}A`
    );

    // 2. Inversores ricos
    const invBrand = (b.inverterBrand || b.inverter?.brand || 'INV').toUpperCase();
    const invModel = (b.inverterModel || b.inverter?.model || '').toUpperCase();
    const invPwr = (b.inverterPowerKw || b.inverter?.power || 0).toFixed(1);
    const inom = blockEng.nominalCurrent.toFixed(1);
    invertersInfo.push(
      `${tagPrefix}: ${qty > 1 ? `${qty}x ` : ''}${invBrand} ${invModel} (${invPwr} kW) | Inom: ${inom}A | Vca: ${projectData.technical.voltage}`
    );

    // 3. Cabos CC & CA
    const avgModsPerStr = Math.round(b.moduleQty / Math.max(b.strings.length, 1));
    const vmpStr = avgModsPerStr * (b.module?.vmp || 0);
    const dcDist = projectData.technical.dcCableDistance || 15;
    const dcCable = getDcCable(b.module?.isc || 13, 1, vmpStr, dcDist);
    const blockCable = getCableForCurrent(blockEng.nominalCurrent, projectData.technical);

    if (!isMicro) {
      cablesInfo.push(
        `C-CC-${idx + 1}: Cabo Solar CC ${dcCable.section}mm² (1,8kV) | Condutores Preto/Vermelho | Queda ΔV: ${dcCable.voltageDrop.toFixed(1)}%`
      );
      protectionsInfo.push(
        `SB-${idx + 1}: Fusíveis ${blockEng.dcProtection.fuseRating || 15}A 1000V CC | DPS CC Cl.II ${blockEng.dcProtection.dpsVoltage || 1000}V 20kA | Chave Secc. 32A 1000V CC`
      );
    } else {
      cablesInfo.push(`C-CC-${idx + 1}: Cabo Solar CC 4mm² (1,8kV) Plug&Play Integrado | Queda ΔV: <1%`);
      protectionsInfo.push(`PROT-${idx + 1}: Proteções CC/CA e Anti-ilhamento Integradas no Microinversor`);
    }

    cablesInfo.push(
      `C-CA-${idx + 1}: Cabo de Potência CA (${phasesLabel}) | Bitola: ${blockCable.cableSimple} (750V/1kV) | Queda ΔV: ${blockCable.voltageDrop}%`
    );
  });

  // 4. Proteção Geral CA e Padrão
  protectionsInfo.push(
    `QDS: Disjuntor CA ${eng.totalSuggestedBreaker}A (Curva C | Icn: 6 kA) | DPS CA Classe II 275V / 20kA (${phasesLabel})`
  );
  protectionsInfo.push(
    `PADRÃO: Disjuntor Geral Padrão: ${projectData.technical.mainBreaker}A (Curva C | Icn: 10 kA) | Medidor Bidirecional Eletrônico (${projectData.technical.utility})`
  );
  protectionsInfo.push(
    `ATERRAMENTO: Eletrodo Aterramento: Haste 5/8" x 2.40m | Cabo Cobre Nu 25mm² | ${networkDesc}`
  );

  const ansiInfo = [
    'Proteções Integradas: Anti-ilhamento (NBR IEC 62116) | ANSI 59 (Sobretensão ≤ 1,0s) | ANSI 27 (Subtensão ≤ 3,0s)',
    'ANSI 81O/U (Frequência 59,5-60,5Hz ≤ 5,0s) | ANSI 25 (Sincronismo ≤ 0,2s)',
  ];

  return {
    modulesInfo,
    invertersInfo,
    cablesInfo,
    protectionsInfo,
    ansiInfo,
  };
}
