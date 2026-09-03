/**
 * Módulo de Renderização Multifilar / Trifilar conforme NBR 5410 e IEC 60617
 * SolarCAD - Diagramação Elétrica Avançada
 *
 * Créditos Técnicos e Referências:
 * - QElectroTech (simbologia elétrica e topologia NBR 5410 / IEC 60617)
 * - Maker.js / dxf-writer (AutoCAD Blocks e geração vetorial)
 * - OpenSolar (Mapeamento de strings e topologia fotovoltaica)
 */

import { ProjectState, EquipmentBlock, ConnectionType } from '@/types';
import { getProjectEngineeringStatus, getBlockEngineeringStatus } from '@/services/engineering';
import { DiagramDimensions, getNetworkDescription, getPhasesConductorLabel } from './diagramLayoutV2';
import { getDcCable, getCableForCurrent } from './cableCalculations';

// ── Padrão de Cores de Condutores NBR 5410 ──
export const NBR_COLORS = {
  PHASE_R: '#000000',      // Fase R (L1) - Preto
  PHASE_S: '#334155',      // Fase S (L2) - Cinza Escuro / Slate
  PHASE_T: '#DC2626',      // Fase T (L3) - Vermelho
  NEUTRAL: '#0284C7',      // Neutro (N) - Azul Claro
  GROUND_PE: '#16A34A',    // Terra de Proteção (PE) - Verde
  DC_POS: '#DC2626',       // CC Positivo (+) - Vermelho
  DC_NEG: '#000000',       // CC Negativo (-) - Preto
  COMM_BUS: '#9333EA',     // Barramento RS-485 / Modbus - Roxo
  COMM_CLOUD: '#2563EB',   // Conexão Nuvem / Wi-Fi - Azul Real
  CT_MEASURE: '#D97706',   // Transformador de Corrente (TC) - Âmbar
} as const;

export interface MultifilarOptions {
  dims: DiagramDimensions;
  projectData: ProjectState;
  format: 'A4' | 'A3';
  DPI: number;
  showCommunication?: boolean;
}

export interface PhaseConductor {
  id: 'R' | 'S' | 'T' | 'N' | 'PE';
  label: string;
  color: string;
  yOffset: number;
}

/**
 * Retorna os condutores ativos com base no tipo de conexão (Monofásico, Bifásico, Trifásico)
 */
export function getActiveMultifilarConductors(
  connType: ConnectionType,
  baseY: number,
  spacing: number = 3.2
): PhaseConductor[] {
  const conductors: PhaseConductor[] = [];

  if (connType === ConnectionType.MONOPHASIC) {
    conductors.push({ id: 'R', label: 'Fase R (L1)', color: NBR_COLORS.PHASE_R, yOffset: baseY });
    conductors.push({ id: 'N', label: 'Neutro (N)', color: NBR_COLORS.NEUTRAL, yOffset: baseY + spacing });
    conductors.push({ id: 'PE', label: 'Terra (PE)', color: NBR_COLORS.GROUND_PE, yOffset: baseY + spacing * 2 });
  } else if (connType === ConnectionType.BIPHASIC) {
    conductors.push({ id: 'R', label: 'Fase R (L1)', color: NBR_COLORS.PHASE_R, yOffset: baseY });
    conductors.push({ id: 'S', label: 'Fase S (L2)', color: NBR_COLORS.PHASE_S, yOffset: baseY + spacing });
    conductors.push({ id: 'N', label: 'Neutro (N)', color: NBR_COLORS.NEUTRAL, yOffset: baseY + spacing * 2 });
    conductors.push({ id: 'PE', label: 'Terra (PE)', color: NBR_COLORS.GROUND_PE, yOffset: baseY + spacing * 3 });
  } else {
    // Trifásico
    conductors.push({ id: 'R', label: 'Fase R (L1)', color: NBR_COLORS.PHASE_R, yOffset: baseY });
    conductors.push({ id: 'S', label: 'Fase S (L2)', color: NBR_COLORS.PHASE_S, yOffset: baseY + spacing });
    conductors.push({ id: 'T', label: 'Fase T (L3)', color: NBR_COLORS.PHASE_T, yOffset: baseY + spacing * 2 });
    conductors.push({ id: 'N', label: 'Neutro (N)', color: NBR_COLORS.NEUTRAL, yOffset: baseY + spacing * 3 });
    conductors.push({ id: 'PE', label: 'Terra (PE)', color: NBR_COLORS.GROUND_PE, yOffset: baseY + spacing * 4 });
  }

  return conductors;
}

/**
 * Desenha barramentos multifilares separados com identificação das fases
 */
export function drawMultifilarBusbar(
  ctx: CanvasRenderingContext2D,
  startX: number,
  endX: number,
  conductors: PhaseConductor[],
  lineWidth: number = 0.55
) {
  conductors.forEach(cond => {
    ctx.save();
    ctx.strokeStyle = cond.color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(startX, cond.yOffset);
    ctx.lineTo(endX, cond.yOffset);
    ctx.stroke();

    // Identificador da Fase / Condutor
    ctx.fillStyle = cond.color;
    ctx.font = 'bold 1.8px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(cond.id, startX - 1.5, cond.yOffset + 0.6);
    ctx.restore();
  });
}

/**
 * Desenha disjuntor com polos individuais por condutor de fase e linha de acoplamento mecânico NBR
 */
export function drawMultifilarBreaker(
  ctx: CanvasRenderingContext2D,
  x: number,
  conductors: PhaseConductor[],
  label: string
) {
  const poleHeight = 2.4;
  const phaseConductors = conductors.filter(c => c.id !== 'PE');

  if (phaseConductors.length === 0) return;

  const topY = phaseConductors[0].yOffset - 1.5;
  const bottomY = phaseConductors[phaseConductors.length - 1].yOffset + 1.5;

  ctx.save();
  // Linha tracejada de acoplamento mecânico (NBR 5410)
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 0.25;
  ctx.setLineDash([0.8, 0.8]);
  ctx.beginPath();
  ctx.moveTo(x, topY);
  ctx.lineTo(x, bottomY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Desenhar polos individuais
  phaseConductors.forEach(cond => {
    const y = cond.yOffset;
    ctx.strokeStyle = cond.color;
    ctx.fillStyle = '#FFFFFF';
    ctx.lineWidth = 0.35;

    // Contato fixo e móvel
    ctx.beginPath();
    ctx.arc(x - 1.2, y, 0.5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x + 1.2, y, 0.5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // Lâmina de contato
    ctx.beginPath();
    ctx.moveTo(x - 1.2, y);
    ctx.lineTo(x + 0.8, y - poleHeight * 0.7);
    ctx.stroke();

    // Símbolo térmico e magnético NBR (retângulo)
    ctx.strokeRect(x - 2.8, y - 0.9, 1.2, 1.8);
  });

  if (label) {
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 1.9px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, topY - 2.2);
  }

  ctx.restore();
}

/**
 * Desenha bornes detalhados do inversor fotovoltaico com condutores CC e CA separados
 */
export function drawMultifilarInverter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  conductors: PhaseConductor[],
  tag: string,
  powerKw: number,
  mpptCount: number = 2,
  extraInfo?: string
) {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 0.45;
  ctx.strokeRect(x, y, w, h);

  // Divisória CC / CA
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w, y);
  ctx.stroke();

  ctx.font = 'bold 2.2px Arial';
  ctx.fillStyle = '#0F172A';
  ctx.fillText('CC', x + 2.0, y + 3.8);
  ctx.fillText('CA', x + w - 5.5, y + h - 1.8);
  ctx.font = 'bold 1.8px Arial';
  ctx.fillText('=', x + 2.8, y + h - 2.0);
  ctx.fillText('~', x + w - 3.8, y + 3.2);

  // Tag e Potência no Topo (desobstruído)
  ctx.textAlign = 'center';
  ctx.font = 'bold 2.0px Arial';
  ctx.fillText(tag, x + w / 2, y - 4.5);
  ctx.font = '1.6px Arial';
  ctx.fillText(extraInfo ? `${powerKw} kW | ${extraInfo}` : `${powerKw} kW`, x + w / 2, y - 2.0);

  // Bornes CC no Topo
  const dcSpacing = Math.min(3.5, (w - 4) / Math.max(mpptCount * 2, 2));
  for (let m = 0; m < mpptCount; m++) {
    const pX = x + 3 + m * (dcSpacing * 2);
    const nX = pX + dcSpacing;

    // Borne +
    ctx.fillStyle = NBR_COLORS.DC_POS;
    ctx.fillRect(pX - 0.7, y - 0.7, 1.4, 1.4);
    ctx.font = 'bold 1.6px Arial';
    ctx.fillText(`+`, pX, y - 0.9);

    // Borne -
    ctx.fillStyle = NBR_COLORS.DC_NEG;
    ctx.fillRect(nX - 0.7, y - 0.7, 1.4, 1.4);
    ctx.fillText(`-`, nX, y - 0.9);
  }

  // Bornes CA na Base
  const caCount = conductors.length;
  const caSpacing = (w - 4) / Math.max(caCount - 1, 1);
  conductors.forEach((cond, idx) => {
    const bX = x + 2 + idx * caSpacing;
    ctx.fillStyle = cond.color;
    ctx.fillRect(bX - 0.7, y + h - 0.7, 1.4, 1.4);
    ctx.font = 'bold 1.5px Arial';
    ctx.fillText(cond.id, bX, y + h + 2.4);
  });

  ctx.restore();
}

/**
 * Desenha Transformador de Corrente (TC / CT) de Medição Inteligente
 */
export function drawCurrentTransformer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string = 'TC'
) {
  ctx.save();
  ctx.strokeStyle = NBR_COLORS.CT_MEASURE;
  ctx.lineWidth = 0.45;
  ctx.fillStyle = '#FFFFFF';

  // Toroide / Bobina em volta da fase
  ctx.beginPath();
  ctx.ellipse(x, y, 1.8, 3.2, 0, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();

  // Fiação de sinal secundário (S1, S2)
  ctx.setLineDash([0.6, 0.6]);
  ctx.strokeStyle = NBR_COLORS.CT_MEASURE;
  ctx.beginPath();
  ctx.moveTo(x, y + 3.2);
  ctx.lineTo(x, y + 7.0);
  ctx.stroke();

  ctx.fillStyle = NBR_COLORS.CT_MEASURE;
  ctx.font = 'bold 1.6px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y - 4.0);
  ctx.restore();
}

/**
 * Desenha Smart Meter / Datalogger / DTU com Enlace de Comunicação
 */
export function drawSmartMeterAndDatalogger(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number = 28,
  h: number = 18
) {
  ctx.save();
  // Caixa do Datalogger / Smart Meter
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = NBR_COLORS.COMM_BUS;
  ctx.lineWidth = 0.45;
  ctx.strokeRect(x, y, w, h);

  // Cabeçalho
  ctx.fillStyle = '#7E22CE';
  ctx.fillRect(x, y, w, 4.0);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 1.8px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('SMART METER / DTU', x + w / 2, y + 2.8);

  // Informações de protocolo
  ctx.fillStyle = '#0F172A';
  ctx.font = '1.7px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('• RS-485 / Modbus RTU', x + 2, y + 7.5);
  ctx.fillText('• Medição 4 Quadrantes', x + 2, y + 11.0);
  ctx.fillText('• Zero Injection Control', x + 2, y + 14.5);

  // Ícone de Antena Wi-Fi / Cloud
  const antX = x + w + 5;
  const antY = y + 4;
  ctx.strokeStyle = NBR_COLORS.COMM_CLOUD;
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.arc(antX, antY, 2.0, -Math.PI / 3, Math.PI / 3);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(antX, antY, 3.5, -Math.PI / 3, Math.PI / 3);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(antX, antY, 5.0, -Math.PI / 3, Math.PI / 3);
  ctx.stroke();

  ctx.fillStyle = NBR_COLORS.COMM_CLOUD;
  ctx.font = 'bold 1.8px Arial';
  ctx.fillText('Wi-Fi / Cloud Portal', antX + 6, antY + 0.8);
  ctx.font = '1.5px Arial';
  ctx.fillStyle = '#64748B';
  ctx.fillText('Telemetria Solar 24/7', antX + 6, antY + 4.0);

  ctx.restore();
}

/**
 * Desenha Placa de Advertência de Segurança NBR 16690
 */
export function drawMultifilarWarningPlate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.save();
  ctx.fillStyle = '#FEF08A';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 0.55;
  ctx.strokeRect(x, y, w, h);
  ctx.lineWidth = 0.15;
  ctx.strokeRect(x + 0.6, y + 0.6, w - 1.2, h - 1.2);

  const iconX = x + 4.5;
  const iconY = y + h / 2;
  ctx.beginPath();
  ctx.moveTo(iconX, iconY - 3.5);
  ctx.lineTo(iconX - 3.5, iconY + 3.0);
  ctx.lineTo(iconX + 3.5, iconY + 3.0);
  ctx.closePath();
  ctx.fillStyle = '#EAB308';
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 0.25;
  ctx.stroke();

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 2.0px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('!', iconX, iconY + 2.2);

  ctx.textAlign = 'left';
  ctx.font = 'bold 1.8px Arial';
  ctx.fillStyle = '#991B1B';
  ctx.fillText('CUIDADO: RISCO DE CHOQUE ELÉTRICO', iconX + 4.5, y + 4.0);
  ctx.font = 'bold 1.5px Arial';
  ctx.fillStyle = '#000000';
  ctx.fillText('GERAÇÃO PRÓPRIA (FONTE SOLAR FV) - NBR 16690', iconX + 4.5, y + 7.5);
  ctx.restore();
}

/**
 * Função Principal de Renderização Multifilar / Trifilar Completa (Modo 2 - NBR 5410)
 * Mostra estritamente o circuito elétrico de potência com condutores individuais
 */
export function renderMultifilarDiagram(
  ctx: CanvasRenderingContext2D,
  options: MultifilarOptions
) {
  const { dims, projectData, format, showCommunication = false } = options;

  const LW_POWER = 0.55;
  const LW_SYMBOL = 0.30;
  const LW_DETAIL = 0.15;

  const phasesLabel = getPhasesConductorLabel(projectData.technical.connectionType);
  const networkDesc = getNetworkDescription(projectData.technical.connectionType, projectData.technical.voltage);
  const engResult = getProjectEngineeringStatus(projectData.equipmentBlocks, projectData.technical);

  const zoneH = dims.drawH;
  const ccTop = 10;
  const ccBot = zoneH * 0.30;
  const convTop = zoneH * 0.36;
  const convBot = zoneH * 0.58;
  const caTop = zoneH * 0.64;
  const mainBusBaseY = zoneH * 0.86;

  // Barramento Principal Multifilar
  const mainConductors = getActiveMultifilarConductors(
    projectData.technical.connectionType,
    mainBusBaseY,
    3.2
  );

  const blocks = projectData.equipmentBlocks;
  const physicalInverters: { block: EquipmentBlock; bIdx: number; invIdx: number }[] = [];
  blocks.forEach((block, bIdx) => {
    const qty = block.inverterQty || 1;
    for (let i = 0; i < qty; i++) {
      physicalInverters.push({ block, bIdx, invIdx: i });
    }
  });

  const numInvs = physicalInverters.length;
  const availableW = dims.drawW - 65;
  const colWidth = Math.max(50, availableW / Math.max(numInvs, 1));
  const caDrops: { centerX: number; invX: number; invW: number; conductors: PhaseConductor[] }[] = [];

  // Primitivas de Desenho Auxiliares
  const drawFuseSymbol = (x: number, y: number) => {
    const w = 5.5, h = 2.2;
    ctx.save();
    ctx.lineWidth = LW_SYMBOL;
    ctx.strokeStyle = '#0F172A';
    ctx.strokeRect(x - w / 2, y - h / 2, w, h);
    ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w / 2 - 1.2, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2 + 1.2, y); ctx.stroke();
    ctx.restore();
  };

  const drawSwitchSymbol = (x: number, y: number) => {
    ctx.save();
    ctx.lineWidth = LW_SYMBOL;
    ctx.strokeStyle = '#0F172A';
    ctx.fillStyle = '#0F172A';
    const r = 0.7;
    ctx.beginPath(); ctx.arc(x - 3.0, y, r, 0, 2 * Math.PI); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 3.0, y, r, 0, 2 * Math.PI); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 3.0, y); ctx.lineTo(x + 2.5, y - 2.5); ctx.stroke();
    ctx.restore();
  };

  // ── 1. DESENHO DAS COLUNAS DE INVERSORES & STRINGS ──
  physicalInverters.forEach((phys, pIdx) => {
    const { block, bIdx, invIdx } = phys;
    const bx = 6 + pIdx * colWidth;
    const centerX = bx + colWidth / 2;
    const isMicro = block.inverter?.inverterType === 'micro';
    const blockEng = getBlockEngineeringStatus(block, projectData.technical);
    const pwr = block.modulePowerW || block.module?.power || 0;
    const pmpKwp = ((block.moduleQty * pwr) / 1000).toFixed(2);
    const brand = (block.moduleBrand || block.module?.brand || 'PV').toUpperCase();
    const model = (block.moduleModel || block.module?.model || '').toUpperCase();
    const voc = (block.module?.voc || 0).toFixed(1);
    const isc = (block.module?.isc || 0).toFixed(1);

    const invBrand = (block.inverterBrand || block.inverter?.brand || 'INV').toUpperCase();
    const invModel = (block.inverterModel || block.inverter?.model || '').toUpperCase();
    const invPwr = (block.inverterPowerKw || block.inverter?.power || 0).toFixed(1);
    const inom = blockEng.nominalCurrent.toFixed(1);

    const avgModsPerStr = Math.round(block.moduleQty / Math.max(block.strings.length, 1));
    const vmpStr = avgModsPerStr * (block.module?.vmp || 0);
    const dcDist = projectData.technical.dcCableDistance || 15;
    const dcCable = getDcCable(block.module?.isc || 13, 1, vmpStr, dcDist);

    // Condutores CA do Inversor
    const invCaConductors = getActiveMultifilarConductors(
      projectData.technical.connectionType,
      caTop,
      2.8
    );

    // ── ZONA CC MULTIFILAR (Positivo Vermelho / Negativo Preto) ──
    const modW = 7, modH = 10;
    const numStrings = block.strings.length;
    const stringSpacing = Math.min(13, (ccBot - ccTop - modH) / Math.max(numStrings, 1));
    const stringsStartY = ccTop + ((ccBot - ccTop) - (numStrings - 1) * stringSpacing) / 2 + 2;

    if (isMicro) {
      const modsPerMicro = Math.max(1, Math.round(block.moduleQty / Math.max(block.inverterQty || 1, 1)));
      const startModX = centerX - ((modsPerMicro - 1) * 8.0) / 2;

      for (let m = 0; m < Math.min(modsPerMicro, 4); m++) {
        const mx = startModX + m * 8.0;
        const my = ccTop + 4.5;
        ctx.save();
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = LW_SYMBOL;
        ctx.strokeRect(mx - modW / 2, my, modW, modH);
        ctx.beginPath();
        ctx.moveTo(mx - modW / 2, my + modH - 2);
        ctx.lineTo(mx + modW / 2, my + 2);
        ctx.stroke();
        ctx.font = 'bold 1.9px Arial';
        ctx.fillStyle = NBR_COLORS.DC_POS;
        ctx.fillText('+', mx - modW / 2 + 1.0, my + 3.0);
        ctx.fillStyle = NBR_COLORS.DC_NEG;
        ctx.fillText('−', mx + modW / 2 - 2.4, my + modH - 1.2);
        ctx.restore();

        // Linhas de descida Plug&Play
        ctx.save();
        ctx.strokeStyle = NBR_COLORS.DC_POS;
        ctx.lineWidth = 0.35;
        ctx.beginPath();
        ctx.moveTo(mx - 1.0, my + modH);
        ctx.lineTo(mx - 1.0, convTop - 3);
        ctx.stroke();
        ctx.strokeStyle = NBR_COLORS.DC_NEG;
        ctx.beginPath();
        ctx.moveTo(mx + 1.0, my + modH);
        ctx.lineTo(mx + 1.0, convTop - 3);
        ctx.stroke();
        ctx.restore();
      }

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 1.9px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`MOD-${bIdx + 1}: ${modsPerMicro}x ${brand} ${model} (${pwr}W)`, centerX, ccTop + 0.8);
      ctx.font = '1.6px Arial';
      ctx.fillText(`Pmp: ${((modsPerMicro * pwr) / 1000).toFixed(2)} kWp | Voc: ${voc}V | Isc: ${isc}A`, centerX, ccTop + 3.0);
      ctx.fillText('C-CC: 4mm² (1,8kV) Plug&Play | ΔV: <1%', centerX, (ccTop + ccBot) / 2 + 4);
    } else if (invIdx === 0) {
      const dcBusX = bx + colWidth * 0.38;

      block.strings.forEach((str, sIdx) => {
        const sy = stringsStartY + sIdx * stringSpacing;
        const mx = bx + 4;

        // Módulo
        ctx.save();
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = LW_SYMBOL;
        ctx.strokeRect(mx, sy - modH / 2, modW, modH);
        ctx.beginPath();
        ctx.moveTo(mx, sy + modH / 2 - 2);
        ctx.lineTo(mx + modW, sy - modH / 2 + 2);
        ctx.stroke();

        ctx.font = 'bold 1.9px Arial';
        ctx.fillStyle = NBR_COLORS.DC_POS;
        ctx.fillText('+', mx + 1.0, sy - modH / 2 + 3.0);
        ctx.fillStyle = NBR_COLORS.DC_NEG;
        ctx.fillText('−', mx + modW - 2.4, sy + modH / 2 - 1.2);
        ctx.restore();

        // Rótulos - estritamente ACIMA do módulo
        if (sIdx === 0) {
          ctx.fillStyle = '#0F172A';
          ctx.font = 'bold 1.9px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(`MOD-${bIdx + 1}: ${block.moduleQty}x ${brand} ${model} (${pwr}W)`, mx + modW / 2, sy - modH / 2 - 4.2);
          ctx.font = '1.6px Arial';
          ctx.fillText(`Pmp: ${pmpKwp} kWp | Voc: ${voc}V | Isc: ${isc}A`, mx + modW / 2, sy - modH / 2 - 1.8);
        }
        ctx.fillStyle = '#334155';
        ctx.font = '1.6px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`STR-${sIdx + 1}: ${str.count}x`, mx + modW + 1.2, sy - 1.2);

        // Condutores CC (+) e (-)
        const dcPosLineY = sy - 1.2;
        const dcNegLineY = sy + 1.2;

        // Fusível Positivo
        const fusePosX = mx + modW + 11;
        drawFuseSymbol(fusePosX, dcPosLineY);
        ctx.fillStyle = '#0F172A';
        ctx.font = '1.4px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${blockEng.dcProtection.fuseRating || 15}A CC`, fusePosX, dcPosLineY - 2.2);

        // Positivo (+)
        ctx.save();
        ctx.strokeStyle = NBR_COLORS.DC_POS;
        ctx.lineWidth = LW_POWER;
        ctx.beginPath();
        ctx.moveTo(mx + modW, dcPosLineY);
        ctx.lineTo(fusePosX - 3.5, dcPosLineY);
        ctx.moveTo(fusePosX + 3.5, dcPosLineY);
        ctx.lineTo(dcBusX - 1.5, dcPosLineY);
        ctx.stroke();

        // Negativo (-)
        ctx.strokeStyle = NBR_COLORS.DC_NEG;
        ctx.beginPath();
        ctx.moveTo(mx + modW, dcNegLineY);
        ctx.lineTo(dcBusX + 1.5, dcNegLineY);
        ctx.stroke();
        ctx.restore();
      });

      if (numStrings > 1) {
        // Barramento CC (+) e (-)
        ctx.save();
        ctx.lineWidth = LW_POWER;
        ctx.strokeStyle = NBR_COLORS.DC_POS;
        ctx.beginPath();
        ctx.moveTo(dcBusX - 1.5, stringsStartY - 1.2);
        ctx.lineTo(dcBusX - 1.5, stringsStartY + (numStrings - 1) * stringSpacing - 1.2);
        ctx.stroke();

        ctx.strokeStyle = NBR_COLORS.DC_NEG;
        ctx.beginPath();
        ctx.moveTo(dcBusX + 1.5, stringsStartY + 1.2);
        ctx.lineTo(dcBusX + 1.5, stringsStartY + (numStrings - 1) * stringSpacing + 1.2);
        ctx.stroke();
        ctx.restore();
      }

      const midCC = (ccTop + ccBot) / 2 + 1;
      const swX = dcBusX + 6;
      drawSwitchSymbol(swX, midCC - 1.2);
      ctx.fillStyle = '#0F172A';
      ctx.font = '1.4px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Chave Secc. 32A 1000V CC', swX, midCC - 3.8);

      ctx.save();
      ctx.lineWidth = LW_POWER;
      ctx.strokeStyle = NBR_COLORS.DC_POS;
      ctx.beginPath();
      ctx.moveTo(dcBusX - 1.5, midCC - 1.2);
      ctx.lineTo(swX - 3.0, midCC - 1.2);
      ctx.moveTo(swX + 3.0, midCC - 1.2);
      ctx.lineTo(centerX - 1.5, midCC - 1.2);
      ctx.lineTo(centerX - 1.5, convTop - 3);
      ctx.stroke();

      ctx.strokeStyle = NBR_COLORS.DC_NEG;
      ctx.beginPath();
      ctx.moveTo(dcBusX + 1.5, midCC + 1.2);
      ctx.lineTo(centerX + 1.5, midCC + 1.2);
      ctx.lineTo(centerX + 1.5, convTop - 3);
      ctx.stroke();
      ctx.restore();

      // Identificador de cabo solar CC conciso
      ctx.fillStyle = '#0F172A';
      ctx.font = '1.5px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(
        `C-CC: ${dcCable.section}mm² (1,8kV) | ΔV: ${dcCable.voltageDrop.toFixed(1)}%`,
        centerX + 3.0,
        (midCC + convTop) / 2
      );
    }

    // ── ZONA DE CONVERSÃO: INVERSOR MULTIFILAR ──
    const invW = 16, invH = 13;
    const invX = centerX - invW / 2;
    const invY = convTop + ((convBot - convTop) - invH) / 2 + 2;
    const tagInv = isMicro ? `MICRO-${bIdx + 1}` : `INV-${bIdx + 1}${numInvs > 1 ? `.#${invIdx + 1}` : ''}`;

    drawMultifilarInverter(
      ctx,
      invX,
      invY,
      invW,
      invH,
      invCaConductors,
      `${tagInv}: ${invBrand} ${invModel}`,
      block.inverterPowerKw || block.inverter?.power || 0,
      Math.max(block.strings.length, 1),
      `Inom: ${inom}A | Vca: ${projectData.technical.voltage}`
    );

    // Proteção Integrada do Inversor (apenas 1 caixa se espaço permitir e apenas 1 inversor)
    if (numInvs === 1 && colWidth >= 75) {
      const badgeW = Math.min(colWidth - invW - 8, 68);
      const badgeH = 12.0;
      const badgeX = invX + invW + 4;
      const badgeY = invY;
      ctx.save();
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = LW_DETAIL;
      ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);

      ctx.fillStyle = '#0F172A';
      ctx.font = format === 'A3' ? 'bold 1.7px Arial' : 'bold 1.4px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('PROTEÇÕES INTEGRADAS DO INVERSOR (NBR IEC 62116)', badgeX + badgeW / 2, badgeY + 3.0);
      ctx.font = format === 'A3' ? '1.4px Arial' : '1.2px Arial';
      ctx.fillStyle = '#334155';
      ctx.fillText('Anti-ilhamento | ANSI 59 (Sobretensão) | ANSI 27 (Subtensão)', badgeX + badgeW / 2, badgeY + 6.0);
      ctx.fillText('ANSI 81O/U (Frequência 59.5-60.5Hz) | ANSI 25 (Sincronismo)', badgeX + badgeW / 2, badgeY + 9.0);
      ctx.restore();
    }

    // Condutores CA de Descida (saída dos bornes)
    const caCount = invCaConductors.length;
    const caSpacing = (invW - 4) / Math.max(caCount - 1, 1);
    invCaConductors.forEach((cond, cIdx) => {
      const bX = invX + 2 + cIdx * caSpacing;
      ctx.save();
      ctx.strokeStyle = cond.color;
      ctx.lineWidth = LW_POWER;
      ctx.beginPath();
      ctx.moveTo(bX, invY + invH);
      ctx.lineTo(bX, caTop + 8);
      ctx.stroke();
      ctx.restore();
    });

    // Identificação de cabo CA por coluna
    ctx.fillStyle = '#0F172A';
    ctx.font = '1.5px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(
      `C-CA-${bIdx + 1}: ${phasesLabel} ${getCableForCurrent(blockEng.nominalCurrent, projectData.technical).cableSimple} | ΔV: ${getCableForCurrent(blockEng.nominalCurrent, projectData.technical).voltageDrop}%`,
      centerX + 2.0,
      caTop + 4
    );

    caDrops.push({ centerX, invX, invW, conductors: invCaConductors });
  });

  // ── 2. QUADRO DE PROTEÇÃO CA (QDS MULTIFILAR & BARRAMENTO COLETOR) ──
  if (caDrops.length > 0) {
    const allXs = caDrops.map(p => p.centerX);
    const minX = Math.min(...allXs);
    const maxX = Math.max(...allXs);
    const troncoX = minX + (maxX - minX) / 2;
    const busbarAcY = caTop + 9;
    const breakerY = busbarAcY + 14;

    // Se múltiplos inversores, desenha o barramento coletor horizontal para cada condutor
    if (numInvs > 1) {
      mainConductors.forEach((cond, cIdx) => {
        const condBusY = busbarAcY + cIdx * 2.2;
        ctx.save();
        ctx.strokeStyle = cond.color;
        ctx.lineWidth = LW_POWER;
        ctx.beginPath();
        ctx.moveTo(minX - 2, condBusY);
        ctx.lineTo(maxX + 2, condBusY);
        ctx.stroke();
        ctx.restore();

        // Conexão e pontos de derivação de cada inversor
        caDrops.forEach(drop => {
          const caSpacing = (drop.invW - 4) / Math.max(drop.conductors.length - 1, 1);
          const dropBX = drop.invX + 2 + cIdx * caSpacing;
          ctx.save();
          ctx.strokeStyle = cond.color;
          ctx.lineWidth = LW_POWER;
          ctx.beginPath();
          ctx.moveTo(dropBX, caTop + 8);
          ctx.lineTo(dropBX, condBusY);
          ctx.stroke();

          // Ponto de derivação colorido
          ctx.fillStyle = cond.color;
          ctx.beginPath();
          ctx.arc(dropBX, condBusY, 0.7, 0, 2 * Math.PI);
          ctx.fill();
          ctx.restore();
        });
      });
    }

    // Disjuntor Geral Multifilar
    drawMultifilarBreaker(
      ctx,
      troncoX,
      mainConductors,
      `DJ-SOLAR ${engResult.totalSuggestedBreaker}A (Curva C | Icn: 6 kA)`
    );

    ctx.fillStyle = '#0F172A';
    ctx.font = '1.7px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Quadro de Proteção CA (QDS)', troncoX + 8, breakerY - 1.5);
    ctx.fillText(`DPS CA Classe II 275V (${phasesLabel})`, troncoX + 8, breakerY + 2.0);

    // Descida dos condutores do QDS para o Barramento Principal
    mainConductors.forEach(cond => {
      ctx.save();
      ctx.strokeStyle = cond.color;
      ctx.lineWidth = LW_POWER;
      ctx.beginPath();
      ctx.moveTo(troncoX, breakerY + 4.0);
      ctx.lineTo(troncoX, cond.yOffset);
      ctx.stroke();

      // Ponto de conexão / derivação no Barramento Principal
      ctx.fillStyle = cond.color;
      ctx.beginPath();
      ctx.arc(troncoX, cond.yOffset, 0.8, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    });
  }

  // ── 3. BARRAMENTO MULTIFILAR PRINCIPAL (R, S, T, N, PE) ──
  const busStartX = 8;
  const busEndX = dims.drawW - 75;
  drawMultifilarBusbar(ctx, busStartX, busEndX, mainConductors, LW_POWER);

  // Legenda do Barramento (Posicionada acima dos barramentos sem linhas cortando o texto)
  const troncoXPos = caDrops.length > 0 ? caDrops[0].centerX + (caDrops[caDrops.length - 1].centerX - caDrops[0].centerX) / 2 : 50;
  const busTitleX = Math.max(busStartX, troncoXPos + 10);
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 2.1px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('BARRAMENTO DISTRIBUIÇÃO MULTIFILAR (NBR 5410)', busTitleX, mainBusBaseY - 3.5);

  // ── 4. PADRÃO DE ENTRADA & MEDIDOR MULTIFILAR ──
  const gridBoxW = format === 'A3' ? 68 : 60;
  const gridBoxRight = dims.drawW - 6;
  const gridBoxLeft = gridBoxRight - gridBoxW;
  const gridBoxTop = mainBusBaseY - 14;
  const gridBoxH = 34;

  // Placa de Advertência Obrigatória NBR 16690 (Posição isolada e dedicada sem encavalar)
  const warnW = Math.min(60, Math.max(48, gridBoxLeft - troncoXPos - 20));
  const warnX = Math.max(troncoXPos + 18, gridBoxLeft - warnW - 8);
  drawMultifilarWarningPlate(ctx, warnX, mainBusBaseY - 18, warnW, 10.5);

  ctx.save();
  ctx.setLineDash([1.5, 1.5]);
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = LW_DETAIL;
  ctx.strokeRect(gridBoxLeft, gridBoxTop, gridBoxW, gridBoxH);
  ctx.restore();

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 1.9px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('PADRÃO DA CONCESSIONÁRIA', gridBoxLeft + 2.5, gridBoxTop + 3.2);
  ctx.font = '1.5px Arial';
  ctx.fillText(`${networkDesc}`, gridBoxLeft + 2.5, gridBoxTop + 5.8);

  // Continuação dos condutores de entrada através do disjuntor da rede e medidor
  mainConductors.forEach(cond => {
    ctx.save();
    ctx.strokeStyle = cond.color;
    ctx.lineWidth = LW_POWER;
    ctx.beginPath();
    ctx.moveTo(busEndX, cond.yOffset);
    ctx.lineTo(gridBoxRight - 4, cond.yOffset);
    ctx.stroke();
    ctx.restore();
  });

  // Disjuntor Geral da Concessionária
  const mainBkX = gridBoxLeft + 14;
  drawMultifilarBreaker(ctx, mainBkX, mainConductors, `DJ-GERAL ${projectData.technical.mainBreaker}A (Icn: 10 kA)`);

  // Medidor Bidirecional NBR
  const meterX = gridBoxLeft + 36;
  const meterMidY = mainBusBaseY + ((mainConductors.length - 1) * 3.2) / 2;
  ctx.save();
  ctx.strokeStyle = '#0F172A';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = LW_SYMBOL;
  ctx.beginPath();
  ctx.arc(meterX, meterMidY, 4.8, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 2.0px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('kWh', meterX, meterMidY + 0.8);
  ctx.font = '1.6px Arial';
  ctx.fillText('Medidor Bidirecional Eletrônico', meterX, meterMidY - 7.5);
  ctx.fillText(`(${projectData.technical.utility})`, meterX, meterMidY - 5.5);
  ctx.restore();

  // Aterramento do Padrão
  ctx.fillStyle = '#0F172A';
  ctx.font = '1.3px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Aterramento: Haste 5/8" x 2.40m | Cabo Cobre Nu 25mm²', gridBoxLeft + 32, gridBoxTop + gridBoxH - 1.5);

  // ── 5. TOPOLOGIA DE COMUNICAÇÃO (Apenas se explicitamente solicitado) ──
  if (showCommunication) {
    const commX = busStartX + 10;
    const commY = zoneH * 0.62;
    drawSmartMeterAndDatalogger(ctx, commX, commY, 32, 17);

    // Linha RS-485 / Modbus dos Inversores até o Datalogger
    ctx.save();
    ctx.strokeStyle = NBR_COLORS.COMM_BUS;
    ctx.lineWidth = 0.45;
    ctx.setLineDash([1.0, 1.0]);

    // Barramento RS-485
    physicalInverters.forEach((_, pIdx) => {
      const bx = 6 + pIdx * colWidth;
      const centerX = bx + colWidth / 2;
      const invY = convTop + ((convBot - convTop) - 13) / 2 + 13;

      ctx.beginPath();
      ctx.moveTo(centerX + 6, invY - 2);
      ctx.lineTo(centerX + 6, commY + 8);
      ctx.lineTo(commX + 32, commY + 8);
      ctx.stroke();

      // Ponto de conexão RS-485
      ctx.fillStyle = NBR_COLORS.COMM_BUS;
      ctx.beginPath();
      ctx.arc(centerX + 6, invY - 2, 0.7, 0, 2 * Math.PI);
      ctx.fill();
    });

    ctx.fillStyle = NBR_COLORS.COMM_BUS;
    ctx.font = 'bold 1.6px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Barramento RS-485 / Modbus RTU (Par Trançado Blindado)', commX + 35, commY + 9);
    ctx.restore();
  }
}
