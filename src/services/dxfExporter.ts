/**
 * Gerador e Exportador de Arquivos DXF (AutoCAD R12 / R2000) com AutoCAD Blocks
 * SolarCAD - Diagramação Elétrica & CAD Avançado
 *
 * Créditos Técnicos e Padrões:
 * - Maker.js / dxf-writer (Estrutura de blocos nomeados e tabelas DXF)
 * - QElectroTech (Simbologia elétrica NBR 5410 / IEC 60617)
 * - OpenSolar (Topologia de strings e arranjos fotovoltaicos)
 */

import { ProjectState } from '../types';
import { getProjectEngineeringStatus, getBlockEngineeringStatus } from './engineering';
import { getDcCable, getCableForCurrent } from '../components/diagram/cableCalculations';
import { getNetworkDescription, getPhasesConductorLabel } from '../components/diagram/diagramLayoutV2';

export interface DxfBlockDefinition {
  name: string;
  description?: string;
  entitiesDxf: string;
}

export interface DxfInsertEntity {
  type: 'INSERT';
  blockName: string;
  layer: string;
  x: number;
  y: number;
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
  rotation?: number;
}

export interface DxfPrimitiveEntity {
  type: 'LINE' | 'TEXT' | 'RECT' | 'CIRCLE';
  layer: string;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  cx?: number;
  cy?: number;
  radius?: number;
  text?: string;
  size?: number;
}

export type DxfExportEntity = DxfPrimitiveEntity | DxfInsertEntity;

/**
 * Sanitiza strings para compatibilidade estrita com DXF (AutoCAD R12 / R2000).
 * Remove acentos, caracteres fora da tabela ASCII imprimível e quebras de linha.
 */
export function sanitizeDxfText(str: string): string {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\r\n]/g, '')
    .replace(/[^\x20-\x7E]/g, '_');
}

/**
 * Define os Blocos Nomeados Oficiais do AutoCAD (AutoCAD Blocks)
 */
export function getDxfStandardBlocks(): DxfBlockDefinition[] {
  return [
    // 1. BLOCK_INVERSOR (Inversor Fotovoltaico com divisória CC/CA)
    {
      name: 'BLOCK_INVERSOR',
      description: 'Inversor Fotovoltaico CC/CA NBR 5410',
      entitiesDxf: [
        // Retângulo 30x25
        '0\nLINE\n8\nEQUIPMENT\n10\n0.0\n20\n0.0\n30\n0.0\n11\n30.0\n21\n0.0\n31\n0.0\n',
        '0\nLINE\n8\nEQUIPMENT\n10\n30.0\n20\n0.0\n30\n0.0\n11\n30.0\n21\n25.0\n31\n0.0\n',
        '0\nLINE\n8\nEQUIPMENT\n10\n30.0\n20\n25.0\n30\n0.0\n11\n0.0\n21\n25.0\n31\n0.0\n',
        '0\nLINE\n8\nEQUIPMENT\n10\n0.0\n20\n25.0\n30\n0.0\n11\n0.0\n21\n0.0\n31\n0.0\n',
        // Diagonal
        '0\nLINE\n8\nEQUIPMENT\n10\n0.0\n20\n25.0\n30\n0.0\n11\n30.0\n21\n0.0\n31\n0.0\n',
        // Textos CC / CA
        '0\nTEXT\n8\nTEXT\n10\n3.0\n20\n18.0\n30\n0.0\n40\n3.0\n1\nCC\n',
        '0\nTEXT\n8\nTEXT\n10\n20.0\n20\n4.0\n30\n0.0\n40\n3.0\n1\nCA\n',
        '0\nTEXT\n8\nTEXT\n10\n4.0\n20\n4.0\n30\n0.0\n40\n2.5\n1\n=\n',
        '0\nTEXT\n8\nTEXT\n10\n22.0\n20\n18.0\n30\n0.0\n40\n2.5\n1\n~\n',
      ].join(''),
    },

    // 2. BLOCK_DISJUNTOR (Disjuntor Termomagnético NBR)
    {
      name: 'BLOCK_DISJUNTOR',
      description: 'Disjuntor Termomagnetico DIN NBR 5410',
      entitiesDxf: [
        '0\nLINE\n8\nPOWER\n10\n0.0\n20\n-6.0\n30\n0.0\n11\n0.0\n21\n-2.0\n31\n0.0\n',
        '0\nLINE\n8\nPOWER\n10\n0.0\n20\n2.0\n30\n0.0\n11\n0.0\n21\n6.0\n31\n0.0\n',
        '0\nCIRCLE\n8\nPOWER\n10\n0.0\n20\n-2.0\n30\n0.0\n40\n0.8\n',
        '0\nCIRCLE\n8\nPOWER\n10\n0.0\n20\n2.0\n30\n0.0\n40\n0.8\n',
        // Lâmina de contato
        '0\nLINE\n8\nPOWER\n10\n0.0\n20\n-2.0\n30\n0.0\n11\n2.5\n21\n1.8\n31\n0.0\n',
        // Símbolo térmico (retângulo)
        '0\nLINE\n8\nPOWER\n10\n-2.5\n20\n-1.0\n30\n0.0\n11\n-1.0\n21\n-1.0\n31\n0.0\n',
        '0\nLINE\n8\nPOWER\n10\n-1.0\n20\n-1.0\n30\n0.0\n11\n-1.0\n21\n1.0\n31\n0.0\n',
        '0\nLINE\n8\nPOWER\n10\n-1.0\n20\n1.0\n30\n0.0\n11\n-2.5\n21\n1.0\n31\n0.0\n',
        '0\nLINE\n8\nPOWER\n10\n-2.5\n20\n1.0\n30\n0.0\n11\n-2.5\n21\n-1.0\n31\n0.0\n',
      ].join(''),
    },

    // 3. BLOCK_MEDIDOR (Medidor Bidirecional kWh)
    {
      name: 'BLOCK_MEDIDOR',
      description: 'Medidor Bidirecional de Energia Ativa/Reativa',
      entitiesDxf: [
        '0\nCIRCLE\n8\nEQUIPMENT\n10\n0.0\n20\n0.0\n30\n0.0\n40\n6.0\n',
        '0\nTEXT\n8\nTEXT\n10\n-3.5\n20\n-1.0\n30\n0.0\n40\n2.8\n1\nkWh\n',
      ].join(''),
    },

    // 4. BLOCK_STRINGBOX (Quadro de Proteção CC - String Box)
    {
      name: 'BLOCK_STRINGBOX',
      description: 'Quadro de Protecao CC String Box',
      entitiesDxf: [
        '0\nLINE\n8\nEQUIPMENT\n10\n0.0\n20\n0.0\n30\n0.0\n11\n24.0\n21\n0.0\n31\n0.0\n',
        '0\nLINE\n8\nEQUIPMENT\n10\n24.0\n20\n0.0\n30\n0.0\n11\n24.0\n21\n18.0\n31\n0.0\n',
        '0\nLINE\n8\nEQUIPMENT\n10\n24.0\n20\n18.0\n30\n0.0\n11\n0.0\n21\n18.0\n31\n0.0\n',
        '0\nLINE\n8\nEQUIPMENT\n10\n0.0\n20\n18.0\n30\n0.0\n11\n0.0\n21\n0.0\n31\n0.0\n',
        '0\nTEXT\n8\nTEXT\n10\n2.0\n20\n14.0\n30\n0.0\n40\n2.0\n1\nSTRING BOX CC\n',
        '0\nTEXT\n8\nTEXT\n10\n2.0\n20\n8.0\n30\n0.0\n40\n1.8\n1\nFUSIVEL + DPS + SEC\n',
      ].join(''),
    },

    // 5. BLOCK_DPS (Dispositivo de Proteção contra Surtos)
    {
      name: 'BLOCK_DPS',
      description: 'Dispositivo de Protecao contra Surtos Classe II',
      entitiesDxf: [
        '0\nLINE\n8\nEQUIPMENT\n10\n-3.0\n20\n0.0\n30\n0.0\n11\n3.0\n21\n0.0\n31\n0.0\n',
        '0\nLINE\n8\nEQUIPMENT\n10\n3.0\n20\n0.0\n30\n0.0\n11\n3.0\n21\n8.0\n31\n0.0\n',
        '0\nLINE\n8\nEQUIPMENT\n10\n3.0\n20\n8.0\n30\n0.0\n11\n-3.0\n21\n8.0\n31\n0.0\n',
        '0\nLINE\n8\nEQUIPMENT\n10\n-3.0\n20\n8.0\n30\n0.0\n11\n-3.0\n21\n0.0\n31\n0.0\n',
        // Haste de terra
        '0\nLINE\n8\nPOWER\n10\n0.0\n20\n0.0\n30\n0.0\n11\n0.0\n21\n-3.0\n31\n0.0\n',
        '0\nLINE\n8\nPOWER\n10\n-2.5\n20\n-3.0\n30\n0.0\n11\n2.5\n21\n-3.0\n31\n0.0\n',
        '0\nLINE\n8\nPOWER\n10\n-1.5\n20\n-4.2\n30\n0.0\n11\n1.5\n21\n-4.2\n31\n0.0\n',
        '0\nLINE\n8\nPOWER\n10\n-0.8\n20\n-5.4\n30\n0.0\n11\n0.8\n21\n-5.4\n31\n0.0\n',
        '0\nTEXT\n8\nTEXT\n10\n-2.2\n20\n3.0\n30\n0.0\n40\n2.0\n1\nDPS\n',
      ].join(''),
    },

    // 6. BLOCK_MODULO (Módulo Fotovoltaico com Polos + / -)
    {
      name: 'BLOCK_MODULO',
      description: 'Modulo Fotovoltaico Silicio Monocristalino',
      entitiesDxf: [
        '0\nLINE\n8\nMODULES\n10\n0.0\n20\n0.0\n30\n0.0\n11\n20.0\n21\n0.0\n31\n0.0\n',
        '0\nLINE\n8\nMODULES\n10\n20.0\n20\n0.0\n30\n0.0\n11\n20.0\n21\n28.0\n31\n0.0\n',
        '0\nLINE\n8\nMODULES\n10\n20.0\n20\n28.0\n30\n0.0\n11\n0.0\n21\n28.0\n31\n0.0\n',
        '0\nLINE\n8\nMODULES\n10\n0.0\n20\n28.0\n30\n0.0\n11\n0.0\n21\n0.0\n31\n0.0\n',
        // Diagonal
        '0\nLINE\n8\nMODULES\n10\n0.0\n20\n28.0\n30\n0.0\n11\n20.0\n21\n0.0\n31\n0.0\n',
        '0\nTEXT\n8\nTEXT\n10\n2.0\n20\n22.0\n30\n0.0\n40\n3.0\n1\n+\n',
        '0\nTEXT\n8\nTEXT\n10\n15.0\n20\n3.0\n30\n0.0\n40\n3.0\n1\n-\n',
      ].join(''),
    },
  ];
}

/**
 * Constrói a Seção BLOCKS do DXF com blocos oficiais do AutoCAD
 */
export function buildDxfBlocksSection(): string {
  const blocks = getDxfStandardBlocks();
  let out = `0\nSECTION\n2\nBLOCKS\n`;

  blocks.forEach(b => {
    out += `0\nBLOCK\n8\n0\n2\n${b.name}\n70\n0\n10\n0.0\n20\n0.0\n30\n0.0\n3\n${b.name}\n1\n\n`;
    out += b.entitiesDxf;
    out += `0\nENDBLK\n8\n0\n`;
  });

  out += `0\nENDSEC\n`;
  return out;
}

/**
 * Gera o arquivo DXF completo para o projeto solar com blocos nomeados e referências INSERT
 */
export function generateSolarUnifilarDxf(
  projectData: ProjectState,
  options?: { mode?: 'unifilar' | 'multifilar'; showCommunication?: boolean }
): string {
  const eng = getProjectEngineeringStatus(projectData.equipmentBlocks, projectData.technical);
  const isMultifilar = options?.mode === 'multifilar';
  const entities: DxfExportEntity[] = [];

  const clientName = sanitizeDxfText(projectData.client?.name || '').toUpperCase();
  const city = sanitizeDxfText(projectData.client?.address?.city || (projectData.client as any)?.city || '');
  const state = sanitizeDxfText(projectData.client?.address?.state || (projectData.client as any)?.state || 'RJ');
  const voltage = sanitizeDxfText(projectData.technical?.voltage || '220/380V');
  const breakerPolarity = sanitizeDxfText(eng.totalBreakerPolarity || '');
  const utility = sanitizeDxfText(projectData.technical?.utility || '');
  const phasesLabel = sanitizeDxfText(getPhasesConductorLabel(projectData.technical?.connectionType || ''));
  const networkDesc = sanitizeDxfText(getNetworkDescription(projectData.technical?.connectionType || '', projectData.technical?.voltage || ''));

  // 1. Moldura A3 / A4 (Dimensões em mm)
  entities.push({ type: 'RECT', layer: 'FRAME', x1: 20, y1: 10, x2: 287, y2: 200 });

  // 2. Selo Técnico ABNT
  entities.push({ type: 'RECT', layer: 'TITLE_BLOCK', x1: 120, y1: 10, x2: 287, y2: 45 });
  entities.push({
    type: 'TEXT',
    layer: 'TEXT',
    x1: 125,
    y1: 39,
    text: `DIAGRAMA ${isMultifilar ? 'MULTIFILAR (NBR 5410)' : 'UNIFILAR'} - GERACAO DISTRIBUIDA`,
    size: 2.8,
  });
  entities.push({ type: 'TEXT', layer: 'TEXT', x1: 125, y1: 32, text: `CLIENTE: ${clientName} | UC: ${sanitizeDxfText(projectData.client?.utilityId || 'A definir')}`, size: 2.2 });
  entities.push({ type: 'TEXT', layer: 'TEXT', x1: 125, y1: 25, text: `LOCAL: ${city} - ${state} | DISTRIBUIDORA: ${utility}`, size: 2.2 });
  entities.push({ type: 'TEXT', layer: 'TEXT', x1: 125, y1: 18, text: `POT. CC: ${eng.totalDcPower.toFixed(2)} kWp | POT. CA: ${eng.totalAcPower.toFixed(2)} kW`, size: 2.2 });
  entities.push({ type: 'TEXT', layer: 'TEXT', x1: 125, y1: 12, text: `DISJUNTOR: ${eng.totalSuggestedBreaker}A (${breakerPolarity}) | TENSAO: ${voltage}`, size: 2.2 });

  // 3. Rede e Ponto de Conexão da Concessionária
  entities.push({ type: 'LINE', layer: 'POWER', x1: 35, y1: 175, x2: 35, y2: 60 });
  entities.push({ type: 'TEXT', layer: 'TEXT', x1: 22, y1: 180, text: `REDE DE DISTRIBUICAO ${utility} (${networkDesc})`, size: 2.5 });

  // Inserção do Medidor Bidirecional via INSERT
  entities.push({
    type: 'INSERT',
    blockName: 'BLOCK_MEDIDOR',
    layer: 'EQUIPMENT',
    x: 35,
    y: 160,
  });
  entities.push({ type: 'TEXT', layer: 'TEXT', x1: 43, y1: 160, text: `MEDIDOR BIDIRECIONAL ELETRONICO (${utility})`, size: 1.8 });

  // Inserção do Disjuntor Geral da Rede via INSERT
  entities.push({
    type: 'INSERT',
    blockName: 'BLOCK_DISJUNTOR',
    layer: 'POWER',
    x: 35,
    y: 140,
  });
  entities.push({ type: 'TEXT', layer: 'TEXT', x1: 40, y1: 140, text: `DJ-GERAL PADRAO ${projectData.technical.mainBreaker}A (CURVA C | Icn: 10 kA)`, size: 2.0 });

  // Aterramento do Padrão
  entities.push({ type: 'TEXT', layer: 'TEXT', x1: 40, y1: 134, text: 'ATERRAMENTO: HASTE 5/8x2.40m + CABO COBRE NU 25mm2', size: 1.6 });

  // Placa de Advertência Obrigatória NBR 16690
  entities.push({ type: 'RECT', layer: 'TEXT', x1: 45, y1: 168, x2: 125, y2: 178 });
  entities.push({ type: 'TEXT', layer: 'TEXT', x1: 47, y1: 173, text: 'ADVERTENCIA: CUIDADO RISCO DE CHOQUE ELETRICO - GERACAO PROPRIA (FONTE SOLAR FV)', size: 1.7 });

  // 4. Inversores, Proteções e Arranjos Fotovoltaicos (via INSERTs)
  let startX = 65;
  projectData.equipmentBlocks.forEach((block, idx) => {
    const inverterBrand = sanitizeDxfText(block.inverter?.brand || block.inverterBrand || 'INV');
    const inverterModel = sanitizeDxfText(block.inverter?.model || block.inverterModel || '');
    const moduleBrand = sanitizeDxfText(block.module?.brand || block.moduleBrand || 'PV');
    const moduleModel = sanitizeDxfText(block.module?.model || block.moduleModel || '');
    const isMicro = block.inverter?.inverterType === 'micro';
    const blockEng = getBlockEngineeringStatus(block, projectData.technical);
    const pmpKwp = ((block.moduleQty * (block.modulePowerW || block.module?.power || 0)) / 1000).toFixed(2);
    const pwr = block.modulePowerW || block.module?.power || 0;
    const voc = (block.module?.voc || 0).toFixed(1);
    const isc = (block.module?.isc || 0).toFixed(1);
    const inom = blockEng.nominalCurrent.toFixed(1);

    const avgModsPerStr = Math.round(block.moduleQty / Math.max(block.strings.length, 1));
    const vmpStr = avgModsPerStr * (block.module?.vmp || 0);
    const dcDist = projectData.technical.dcCableDistance || 15;
    const dcCable = getDcCable(block.module?.isc || 13, 1, vmpStr, dcDist);
    const blockCable = getCableForCurrent(blockEng.nominalCurrent, projectData.technical);

    const equipTitle = isMicro
      ? (block.inverterQty > 1 ? `MICRO (${block.inverterQty}x)` : `MICROINVERSOR`)
      : `INVERSOR ${idx + 1}`;

    // Inversor via AutoCAD Block INSERT
    entities.push({
      type: 'INSERT',
      blockName: 'BLOCK_INVERSOR',
      layer: 'EQUIPMENT',
      x: startX,
      y: 110,
    });

    entities.push({ type: 'TEXT', layer: 'TEXT', x1: startX, y1: 140, text: equipTitle, size: 2.5 });
    entities.push({ type: 'TEXT', layer: 'TEXT', x1: startX, y1: 135, text: `${inverterBrand} ${inverterModel}`, size: 1.8 });
    entities.push({ type: 'TEXT', layer: 'TEXT', x1: startX, y1: 104, text: `${block.inverterPowerKw || block.inverter?.power || 0} kW | Inom: ${inom}A | Vca: ${voltage}`, size: 1.8 });

    // Requisitos de Proteção Integrada do Inversor
    entities.push({
      type: 'TEXT',
      layer: 'TEXT',
      x1: startX - 10,
      y1: 98,
      text: 'PROT. INTEGRADAS: ANTI-ILHAMENTO (NBR IEC 62116) | ANSI 59 | ANSI 27 | ANSI 81O/U | ANSI 25',
      size: 1.4,
    });

    // String Box CC (se inversor tradicional) via INSERT
    if (!isMicro) {
      entities.push({
        type: 'INSERT',
        blockName: 'BLOCK_STRINGBOX',
        layer: 'EQUIPMENT',
        x: startX + 3,
        y: 75,
      });

      entities.push({
        type: 'TEXT',
        layer: 'TEXT',
        x1: startX + 2,
        y1: 70,
        text: `FUSIVEIS ${blockEng.dcProtection.fuseRating || 15}A 1000V CC | DPS CC 1000V 20kA | SEC 32A`,
        size: 1.4,
      });

      // DPS CC via INSERT
      entities.push({
        type: 'INSERT',
        blockName: 'BLOCK_DPS',
        layer: 'EQUIPMENT',
        x: startX + 22,
        y: 75,
      });
    }

    // Módulos Fotovoltaicos via INSERT
    entities.push({
      type: 'INSERT',
      blockName: 'BLOCK_MODULO',
      layer: 'MODULES',
      x: startX + 5,
      y: 40,
    });

    entities.push({
      type: 'TEXT',
      layer: 'TEXT',
      x1: startX - 5,
      y1: 34,
      text: `${block.moduleQty}x ${moduleBrand} ${moduleModel} (${pwr}W) | Pmp: ${pmpKwp} kWp | Voc: ${voc}V | Isc: ${isc}A`,
      size: 1.6,
    });

    // Linhas de Interligação CC (Módulo -> StringBox -> Inversor)
    entities.push({ type: 'LINE', layer: 'DC_CABLE', x1: startX + 15, y1: 68, x2: startX + 15, y2: 75 });
    if (isMicro) {
      entities.push({ type: 'TEXT', layer: 'TEXT', x1: startX + 18, y1: 90, text: 'MC4 PLUG&PLAY (SEM STRING BOX)', size: 1.5 });
    } else {
      entities.push({
        type: 'TEXT',
        layer: 'DC_CABLE',
        x1: startX + 18,
        y1: 85,
        text: `CABO SOLAR CC ${dcCable.section}mm2 (1.8kV) | QUEDA: ${dcCable.voltageDrop.toFixed(1)}%`,
        size: 1.4,
      });
    }
    entities.push({ type: 'LINE', layer: 'DC_CABLE', x1: startX + 15, y1: 93, x2: startX + 15, y2: 110 });

    // Linhas de Interligação CA (Inversor -> Barramento CA)
    entities.push({ type: 'LINE', layer: 'AC_CABLE', x1: startX + 15, y1: 135, x2: startX + 15, y2: 155 });
    if (isMicro) {
      entities.push({
        type: 'TEXT',
        layer: 'AC_CABLE',
        x1: startX + 18,
        y1: 150,
        text: `CABO TRONCO CA (${phasesLabel}) ${blockCable.cableSimple} | QUEDA: ${blockCable.voltageDrop}%`,
        size: 1.4,
      });
    } else {
      entities.push({
        type: 'TEXT',
        layer: 'AC_CABLE',
        x1: startX + 18,
        y1: 150,
        text: `CABO POTENCIA CA (${phasesLabel}) ${blockCable.cableSimple} | QUEDA: ${blockCable.voltageDrop}%`,
        size: 1.4,
      });
    }
    entities.push({ type: 'LINE', layer: 'AC_CABLE', x1: startX + 15, y1: 155, x2: 35, y2: 155 });

    // Disjuntor Individual do Inversor / QDS via INSERT
    entities.push({
      type: 'INSERT',
      blockName: 'BLOCK_DISJUNTOR',
      layer: 'POWER',
      x: startX + 15,
      y: 147,
    });
    entities.push({
      type: 'TEXT',
      layer: 'TEXT',
      x1: startX + 18,
      y1: 147,
      text: `DJ-SOLAR ${eng.totalSuggestedBreaker}A (CURVA C | Icn: 6 kA) | DPS CA CL.II 275V/20kA`,
      size: 1.5,
    });

    startX += 55;
  });

  // 5. Linha de Comunicação & Monitoramento RS-485
  if (options?.showCommunication) {
    entities.push({ type: 'LINE', layer: 'COMMUNICATION', x1: 35, y1: 95, x2: startX - 10, y2: 95 });
    entities.push({ type: 'TEXT', layer: 'COMMUNICATION', x1: 40, y1: 98, text: 'BARRAMENTO RS-485 / MODBUS RTU - MONITORAMENTO SMART METER', size: 1.8 });
  }

  // ── MONTAGEM DO ARQUIVO DXF COMPLETO ──
  let dxf = `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$DWGCODEPAGE\n3\nANSI_1252\n0\nENDSEC\n`;

  // TABELA DE LAYERS
  dxf += `0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n10\n`;
  [
    'FRAME',
    'TITLE_BLOCK',
    'POWER',
    'EQUIPMENT',
    'DC_CABLE',
    'AC_CABLE',
    'MODULES',
    'TEXT',
    'BLOCKS',
    'COMMUNICATION',
  ].forEach(layer => {
    dxf += `0\nLAYER\n2\n${layer}\n70\n0\n62\n7\n6\nCONTINUOUS\n`;
  });
  dxf += `0\nENDTAB\n0\nENDSEC\n`;

  // SEÇÃO BLOCKS OFICIAL DO AUTOCAD
  dxf += buildDxfBlocksSection();

  // SEÇÃO ENTITIES
  dxf += `0\nSECTION\n2\nENTITIES\n`;

  entities.forEach(ent => {
    if (ent.type === 'INSERT') {
      dxf += `0\nINSERT\n8\n${ent.layer}\n2\n${ent.blockName}\n10\n${ent.x}\n20\n${ent.y}\n30\n0.0\n41\n${ent.scaleX || 1.0}\n42\n${ent.scaleY || 1.0}\n43\n${ent.scaleZ || 1.0}\n50\n${ent.rotation || 0.0}\n`;
    } else if (ent.type === 'LINE') {
      dxf += `0\nLINE\n8\n${ent.layer}\n10\n${ent.x1}\n20\n${ent.y1}\n30\n0.0\n11\n${ent.x2}\n21\n${ent.y2}\n31\n0.0\n`;
    } else if (ent.type === 'RECT') {
      dxf += `0\nLINE\n8\n${ent.layer}\n10\n${ent.x1}\n20\n${ent.y1}\n30\n0.0\n11\n${ent.x2}\n21\n${ent.y1}\n31\n0.0\n`;
      dxf += `0\nLINE\n8\n${ent.layer}\n10\n${ent.x2}\n20\n${ent.y1}\n30\n0.0\n11\n${ent.x2}\n21\n${ent.y2}\n31\n0.0\n`;
      dxf += `0\nLINE\n8\n${ent.layer}\n10\n${ent.x2}\n20\n${ent.y2}\n30\n0.0\n11\n${ent.x1}\n21\n${ent.y2}\n31\n0.0\n`;
      dxf += `0\nLINE\n8\n${ent.layer}\n10\n${ent.x1}\n20\n${ent.y2}\n30\n0.0\n11\n${ent.x1}\n21\n${ent.y1}\n31\n0.0\n`;
    } else if (ent.type === 'CIRCLE') {
      dxf += `0\nCIRCLE\n8\n${ent.layer}\n10\n${ent.cx || 0}\n20\n${ent.cy || 0}\n30\n0.0\n40\n${ent.radius || 5}\n`;
    } else if (ent.type === 'TEXT') {
      dxf += `0\nTEXT\n8\n${ent.layer}\n10\n${ent.x1}\n20\n${ent.y1}\n30\n0.0\n40\n${ent.size || 2.5}\n1\n${sanitizeDxfText(ent.text || '')}\n`;
    }
  });

  dxf += `0\nENDSEC\n0\nEOF\n`;
  return dxf;
}

/**
 * Função utilitária para download do arquivo DXF no navegador
 */
export function downloadDxfFile(filename: string, dxfContent: string) {
  const blob = new Blob([dxfContent], { type: 'application/dxf;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.dxf') ? filename : `${filename}.dxf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
