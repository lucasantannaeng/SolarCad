/**
 * Canvas de Diagramação Elétrica SolarCAD
 * Suporta Diagrama Unifilar, Multifilar (NBR 5410), Topologia de Comunicação e String Mapping
 *
 * Créditos Técnicos e Referências:
 * - QElectroTech (simbologia elétrica e topologia NBR 5410 / IEC 60617)
 * - Maker.js / dxf-writer (AutoCAD Blocks e geração vetorial DXF)
 * - OpenSolar (Mapeamento de strings e topologia fotovoltaica 2D)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ProjectState, EquipmentBlock } from '@/types';
import { getProjectEngineeringStatus, getBlockEngineeringStatus } from '@/services/engineering';
import { getCableForCurrent, getPhases, getDcCable } from '@/components/diagram/cableCalculations';
import { getDiagramDimensions, buildTechnicalTableData, getNetworkDescription, getPhasesConductorLabel, PaperFormat } from '@/components/diagram/diagramLayoutV2';
import { renderMultifilarDiagram } from '@/components/diagram/multifilarRenderer';
import { renderCommunicationDiagram, drawCommunicationScheduleTable } from '@/components/diagram/communicationRenderer';
import { StringRoofMapping } from '@/components/StringRoofMapping';
import { generateSolarUnifilarDxf, downloadDxfFile } from '@/services/dxfExporter';
import { jsPDF } from 'jspdf';
import { Button } from '@/components/ui/button';
import {
  Download,
  ZoomIn,
  ZoomOut,
  FileText,
  Maximize2,
  Zap,
  Split,
  Radio,
  Home,
} from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  projectData: ProjectState;
}

export type DiagramViewMode = 'unifilar' | 'multifilar' | 'communication' | 'roof_mapping';

interface Anchor {
  x: number;
  y: number;
}

interface Anchors {
  top?: Anchor;
  bottom?: Anchor;
  left?: Anchor;
  right?: Anchor;
  center?: Anchor;
}

export const DiagramCanvas: React.FC<Props> = ({ projectData }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [format, setFormat] = useState<PaperFormat>(() => {
    if (projectData.paperSize === 'A4' || projectData.paperSize === 'A3') {
      return projectData.paperSize;
    }
    const totalInvs = projectData.equipmentBlocks.reduce((acc, b) => acc + (b.inverterQty || 1), 0);
    return totalInvs > 1 ? 'A3' : 'A4';
  });
  const [zoom, setZoom] = useState<number>(1);
  const [fitMode, setFitMode] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<DiagramViewMode>('unifilar');

  const dims = getDiagramDimensions(format);
  const DPI = format === 'A3' ? 5 : 6;

  // ── Hierarquia de Espessuras de Linha (em mm) ──
  const LW_POWER = 0.55;   // Barramentos, fios de potência, cabo principal
  const LW_SYMBOL = 0.30;  // Disjuntores, inversores, medidor, módulos, DPS
  const LW_FRAME = 0.40;   // Moldura externa e selo
  const LW_DETAIL = 0.15;  // Linhas de chamada, caixas de equipamentos
  const LW_GROUND = 0.40;  // Hastes de aterramento NBR

  const drawDiagram = useCallback(() => {
    if (viewMode === 'roof_mapping') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = Math.round(dims.pageW * DPI);
    canvas.height = Math.round(dims.pageH * DPI);
    ctx.scale(DPI, DPI);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Fundo Branco
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, dims.pageW, dims.pageH);

    // ── 1. MOLDURA EXTERNA ABNT (Margem 20mm/25mm esquerda para encadernação) ──
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = LW_FRAME;
    ctx.strokeRect(dims.marginL, dims.marginT, dims.safeW, dims.safeH);

    const engResult = getProjectEngineeringStatus(projectData.equipmentBlocks, projectData.technical);

    // ── 2. SELO TÉCNICO ABNT ──
    drawSelo(ctx, dims.seloX, dims.seloY, dims.seloW, dims.seloH, engResult);

    // ── 3. TABELA TÉCNICA (BOM DE ELÉTRICA OU SCHEDULE DE TELEMETRIA) ──
    if (viewMode === 'communication') {
      drawCommunicationScheduleTable(ctx, dims.tableX, dims.tableY, dims.tableW, dims.tableH, projectData);
    } else {
      const tableData = buildTechnicalTableData(projectData);
      drawTechnicalTable(ctx, dims.tableX, dims.tableY, dims.tableW, dims.tableH, tableData);
    }

    // ── 4. ÁREA DE DESENHO DO ESQUEMÁTICO ──
    ctx.save();
    ctx.translate(dims.marginL, dims.marginT);
    ctx.beginPath();
    ctx.rect(0, 0, dims.drawW, dims.drawH);
    ctx.clip();

    // Roteamento para Renderizador Multifilar (Modo 2)
    if (viewMode === 'multifilar') {
      renderMultifilarDiagram(ctx, {
        dims,
        projectData,
        format,
        DPI,
        showCommunication: false,
      });
      ctx.restore();
      return;
    }

    // Roteamento para Renderizador de Comunicação & Modbus (Modo 3)
    if (viewMode === 'communication') {
      renderCommunicationDiagram(ctx, {
        dims,
        projectData,
        format,
        DPI,
      });
      ctx.restore();
      return;
    }

    // ── RENDERIZAÇÃO UNIFILAR PADRÃO NBR (Modo 1) ──
    const phases = getPhases(projectData.technical.connectionType);
    const phasesLabel = getPhasesConductorLabel(projectData.technical.connectionType);
    const networkDesc = getNetworkDescription(projectData.technical.connectionType, projectData.technical.voltage);

    // Primitivas de Desenho
    const drawConnDot = (x: number, y: number) => {
      ctx.save();
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(x, y, 0.9, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    };

    const drawLabel = (
      text: string,
      x: number,
      y: number,
      opts?: { align?: CanvasTextAlign; font?: string; bold?: boolean }
    ) => {
      ctx.save();
      const defaultFont = format === 'A3' ? '2.6px Arial' : '2.2px Arial';
      const baseFont = opts?.font || defaultFont;
      ctx.font = opts?.bold ? `bold ${baseFont}` : baseFont;
      ctx.textAlign = opts?.align || 'left';
      ctx.fillStyle = '#000000';
      ctx.fillText(text, x, y);
      ctx.restore();
    };

    const drawConnection = (from: Anchor, to: Anchor, opts?: { dot?: 'start' | 'end' | 'both' | 'none'; weight?: number }) => {
      ctx.save();
      ctx.strokeStyle = '#000000';
      ctx.setLineDash([]);
      ctx.lineWidth = opts?.weight ?? LW_POWER;
      ctx.beginPath();
      if (from.x === to.x || from.y === to.y) {
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
      } else {
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(from.x, to.y);
        ctx.lineTo(to.x, to.y);
      }
      ctx.stroke();
      ctx.restore();

      const dotMode = opts?.dot || 'none';
      if (dotMode === 'start' || dotMode === 'both') drawConnDot(from.x, from.y);
      if (dotMode === 'end' || dotMode === 'both') drawConnDot(to.x, to.y);
    };

    const drawModule = (x: number, y: number, w: number, h: number): Anchors => {
      ctx.save();
      ctx.lineWidth = LW_SYMBOL;
      ctx.strokeRect(x, y, w, h);
      ctx.beginPath();
      ctx.moveTo(x, y + h - 1.8);
      ctx.lineTo(x + w, y + 1.8);
      ctx.stroke();
      ctx.font = '2.0px Arial';
      ctx.fillStyle = '#000000';
      ctx.fillText('+', x + 0.6, y + 2.5);
      ctx.fillText('−', x + w - 1.8, y + h - 0.8);
      ctx.restore();
      return {
        top: { x: x + w / 2, y },
        bottom: { x: x + w / 2, y: y + h },
        left: { x, y: y + h / 2 },
        right: { x: x + w, y: y + h / 2 },
        center: { x: x + w / 2, y: y + h / 2 },
      };
    };

    const drawFuse = (x: number, y: number): Anchors => {
      const w = 5.5, h = 2.2;
      ctx.save();
      ctx.lineWidth = LW_SYMBOL;
      ctx.strokeRect(x - w / 2, y - h / 2, w, h);
      const leftAnchor = { x: x - w / 2 - 1.2, y };
      const rightAnchor = { x: x + w / 2 + 1.2, y };
      ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(leftAnchor.x, leftAnchor.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(rightAnchor.x, rightAnchor.y); ctx.stroke();
      ctx.restore();
      return { left: leftAnchor, right: rightAnchor, center: { x, y } };
    };

    const drawSwitch = (x: number, y: number): Anchors => {
      ctx.save();
      ctx.lineWidth = LW_SYMBOL;
      const r = 0.7;
      const leftA = { x: x - 3.0, y };
      const rightA = { x: x + 3.0, y };
      ctx.beginPath(); ctx.arc(leftA.x, leftA.y, r, 0, 2 * Math.PI); ctx.fill();
      ctx.beginPath(); ctx.arc(rightA.x, rightA.y, r, 0, 2 * Math.PI); ctx.fill();
      ctx.beginPath(); ctx.moveTo(leftA.x, leftA.y); ctx.lineTo(x + 2.5, y - 2.5); ctx.stroke();
      ctx.restore();
      return { left: leftA, right: rightA, center: { x, y } };
    };

    const drawBreaker = (x: number, y: number, poles: number): Anchors => {
      ctx.save();
      ctx.lineWidth = LW_SYMBOL;
      const spacing = 2.0;
      const startX = x - ((poles - 1) * spacing) / 2;
      for (let i = 0; i < poles; i++) {
        const px = startX + i * spacing;
        ctx.beginPath(); ctx.moveTo(px, y - 3.0); ctx.lineTo(px, y + 3.0); ctx.stroke();
        ctx.beginPath(); ctx.arc(px - 0.8, y, 0.5, 0, 2 * Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px - 0.8, y - 0.8); ctx.lineTo(px + 0.8, y + 0.8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px + 0.8, y - 0.8); ctx.lineTo(px - 0.8, y + 0.8); ctx.stroke();
      }
      if (poles > 1) {
        ctx.lineWidth = LW_DETAIL;
        ctx.beginPath();
        ctx.moveTo(startX, y - 3.0);
        ctx.lineTo(startX + (poles - 1) * spacing, y - 3.0);
        ctx.stroke();
      }
      ctx.restore();
      return {
        top: { x, y: y - 3.0 },
        bottom: { x, y: y + 3.0 },
        center: { x, y },
      };
    };

    const drawGround = (x: number, y: number): Anchors => {
      ctx.save();
      ctx.lineWidth = LW_GROUND;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 2.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 3.0, y + 2.5); ctx.lineTo(x + 3.0, y + 2.5); ctx.stroke();
      ctx.lineWidth = LW_SYMBOL;
      ctx.beginPath(); ctx.moveTo(x - 2.0, y + 3.5); ctx.lineTo(x + 2.0, y + 3.5); ctx.stroke();
      ctx.lineWidth = LW_DETAIL;
      ctx.beginPath(); ctx.moveTo(x - 1.0, y + 4.5); ctx.lineTo(x + 1.0, y + 4.5); ctx.stroke();
      ctx.restore();
      return { top: { x, y } };
    };

    const drawDPS = (x: number, y: number, label: string): Anchors => {
      const w = 4.5, h = 7.0;
      ctx.save();
      ctx.lineWidth = LW_SYMBOL;
      ctx.strokeRect(x - w / 2, y, w, h);
      ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + h + 2.0); ctx.stroke();
      ctx.restore();
      drawGround(x, y + h + 2.0);
      if (label) {
        drawLabel(label, x, y - 1.2, { align: 'center', font: '1.7px Arial' });
      }
      return { top: { x, y }, bottom: { x, y: y + h } };
    };

    const drawInverter = (x: number, y: number, w: number, h: number): Anchors => {
      ctx.save();
      ctx.lineWidth = LW_SYMBOL;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      ctx.lineTo(x + w, y);
      ctx.stroke();
      ctx.font = 'bold 2.4px Arial';
      ctx.fillStyle = '#000000';
      ctx.fillText('CC', x + 1.2, y + 3.8);
      ctx.fillText('CA', x + w - 4.8, y + h - 1.6);
      ctx.font = 'bold 2.0px Arial';
      ctx.fillText('=', x + 2.0, y + h - 2.0);
      ctx.fillText('~', x + w - 3.0, y + 3.0);
      ctx.restore();
      return {
        top: { x: x + w / 2, y },
        bottom: { x: x + w / 2, y: y + h },
        left: { x, y: y + h / 2 },
        right: { x: x + w, y: y + h / 2 },
        center: { x: x + w / 2, y: y + h / 2 },
      };
    };

    // Placa de Advertência Obrigatória NBR 16690
    const drawWarningPlate = (x: number, y: number, w: number, h: number) => {
      ctx.save();
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = LW_POWER;
      ctx.strokeRect(x, y, w, h);
      ctx.lineWidth = LW_DETAIL;
      ctx.strokeRect(x + 0.6, y + 0.6, w - 1.2, h - 1.2);

      // Ícone Triângulo
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

      // Textos de advertência
      ctx.textAlign = 'left';
      ctx.font = 'bold 1.7px Arial';
      ctx.fillStyle = '#991B1B';
      ctx.fillText('CUIDADO: RISCO DE CHOQUE ELÉTRICO', iconX + 4.0, y + 3.8);
      ctx.font = 'bold 1.4px Arial';
      ctx.fillStyle = '#000000';
      ctx.fillText('GERAÇÃO PRÓPRIA (FONTE SOLAR FV) - NBR 16690', iconX + 4.0, y + 7.2);
      ctx.restore();
    };

    // Caixa Técnica de Proteções Integradas do Inversor (Exibida uma única vez no esquema)
    const drawInverterProtectionsBadge = (x: number, y: number, w: number, h: number) => {
      ctx.save();
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = LW_DETAIL;
      ctx.strokeRect(x, y, w, h);

      drawLabel('PROTEÇÕES INTEGRADAS DO INVERSOR (NBR IEC 62116)', x + w / 2, y + 2.8, {
        align: 'center',
        bold: true,
        font: format === 'A3' ? '1.7px Arial' : '1.4px Arial',
      });
      drawLabel('Anti-ilhamento | ANSI 59 (Sobretensão) | ANSI 27 (Subtensão)', x + w / 2, y + 5.8, {
        align: 'center',
        font: format === 'A3' ? '1.4px Arial' : '1.2px Arial',
      });
      drawLabel('ANSI 81O/U (Frequência 59.5-60.5Hz) | ANSI 25 (Sincronismo)', x + w / 2, y + 8.8, {
        align: 'center',
        font: format === 'A3' ? '1.4px Arial' : '1.2px Arial',
      });
      ctx.restore();
    };

    // ── ZONEAMENTO VERTICAL PARAMÉTRICO ──
    const zoneH = dims.drawH;
    const ccTop = 10;
    const ccBot = zoneH * 0.30;
    const convTop = zoneH * 0.36;
    const convBot = zoneH * 0.58;
    const caTop = zoneH * 0.64;
    const mainBusY = zoneH * 0.86;

    // Expandir blocos de inversores
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
    const colWidth = Math.max(45, availableW / Math.max(numInvs, 1));
    const caEntryPoints: { centerX: number; caEntryAnchor: Anchor }[] = [];

    // Desenhar colunas dos inversores
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
      const blockCable = getCableForCurrent(blockEng.nominalCurrent, projectData.technical);

      // ── ZONA CC ──
      const modW = 6, modH = 9.5;
      if (isMicro) {
        const modsPerMicro = Math.max(1, Math.round(block.moduleQty / Math.max(block.inverterQty || 1, 1)));
        const startModX = centerX - ((modsPerMicro - 1) * 7.5) / 2;

        for (let m = 0; m < Math.min(modsPerMicro, 4); m++) {
          const mx = startModX + m * 7.5;
          const my = ccTop + 4.5;
          const modAnch = drawModule(mx - modW / 2, my, modW, modH);
          drawConnection(modAnch.bottom!, { x: modAnch.bottom!.x, y: convTop - 3 }, { dot: 'start', weight: 0.35 });
        }

        drawLabel(`MOD-${bIdx + 1}: ${modsPerMicro}x ${brand} ${model} (${pwr}W)`, centerX, ccTop + 0.8, { align: 'center', bold: true, font: '1.9px Arial' });
        drawLabel(`Pmp: ${((modsPerMicro * pwr) / 1000).toFixed(2)} kWp | Voc: ${voc}V | Isc: ${isc}A`, centerX, ccTop + 3.0, { align: 'center', font: '1.6px Arial' });
        drawLabel('C-CC: 4mm² (1,8kV) Plug&Play | ΔV: <1%', centerX, (ccTop + ccBot) / 2 + 4, { align: 'center', font: '1.5px Arial' });
      } else if (invIdx === 0) {
        const numStrings = block.strings.length;
        const stringSpacing = Math.min(13, (ccBot - ccTop - modH) / Math.max(numStrings, 1));
        const stringsStartY = ccTop + ((ccBot - ccTop) - (numStrings - 1) * stringSpacing) / 2 + 2;
        const dcBusX = bx + colWidth * 0.38;

        block.strings.forEach((str, sIdx) => {
          const sy = stringsStartY + sIdx * stringSpacing;
          const mx = bx + 3;
          const modAnch = drawModule(mx, sy - modH / 2, modW, modH);

          // Rótulo posicionado estritamente acima do módulo sem colidir com linhas CC
          if (sIdx === 0) {
            drawLabel(`MOD-${bIdx + 1}: ${block.moduleQty}x ${brand} ${model} (${pwr}W)`, mx + modW / 2, sy - modH / 2 - 4.2, { align: 'center', bold: true, font: '1.9px Arial' });
            drawLabel(`Pmp: ${pmpKwp} kWp | Voc: ${voc}V | Isc: ${isc}A`, mx + modW / 2, sy - modH / 2 - 1.8, { align: 'center', font: '1.6px Arial' });
          }
          drawLabel(`STR-${sIdx + 1}: ${str.count}x`, mx + modW + 1.2, sy - 1.2, { font: '1.6px Arial' });

          const fuseAnch = drawFuse(mx + modW + 12, sy);
          drawLabel(`${blockEng.dcProtection.fuseRating || 15}A CC`, mx + modW + 12, sy - 2.5, { align: 'center', font: '1.4px Arial' });
          drawConnection(modAnch.right!, fuseAnch.left!, { dot: 'start' });
          drawConnection(fuseAnch.right!, { x: dcBusX, y: sy }, { dot: 'end' });
        });

        if (numStrings > 1) {
          drawConnection({ x: dcBusX, y: stringsStartY }, { x: dcBusX, y: stringsStartY + (numStrings - 1) * stringSpacing });
        }

        const midCC = (ccTop + ccBot) / 2 + 1;
        const swAnch = drawSwitch(dcBusX + 6, midCC);
        drawLabel('Chave Secc. 32A 1000V CC', dcBusX + 6, midCC - 2.8, { align: 'center', font: '1.4px Arial' });
        drawConnection({ x: dcBusX, y: midCC }, swAnch.left!);

        const dpsX = dcBusX + 15;
        drawConnection(swAnch.right!, { x: dpsX, y: midCC }, { dot: 'end' });
        drawDPS(dpsX, midCC + 3, `DPS CC Cl.II 1000V (SB-${bIdx + 1})`);

        const dcExitX = dpsX + 6;
        drawConnection(swAnch.right!, { x: dcExitX, y: midCC });
        drawConnection({ x: dcExitX, y: midCC }, { x: centerX, y: convTop - 3 }, { dot: 'end' });
        drawLabel(`C-CC: ${dcCable.section}mm² (1,8kV) | ΔV: ${dcCable.voltageDrop.toFixed(1)}%`, centerX + 1.5, (midCC + convTop) / 2, { font: '1.5px Arial' });
      }

      // ── ZONA CONVERSÃO: INVERSOR ──
      const invW = 16, invH = 13;
      const invX = centerX - invW / 2;
      const invY = convTop + ((convBot - convTop) - invH) / 2 + 2;
      const invAnch = drawInverter(invX, invY, invW, invH);

      const tagInv = isMicro ? `MICRO-${bIdx + 1}` : `INV-${bIdx + 1}${numInvs > 1 ? `.#${invIdx + 1}` : ''}`;
      
      // Textos do Inversor posicionados sem que a linha CC corte o texto
      drawLabel(`${tagInv}: ${invBrand} ${invModel} (${invPwr} kW)`, centerX + 2.0, invY - 4.5, { font: '2.0px Arial', bold: true });
      drawLabel(`Inom: ${inom}A | Vca: ${projectData.technical.voltage}`, centerX + 2.0, invY - 1.8, { font: '1.6px Arial' });

      // Conexão CC desce limpa diretamente no topo do inversor
      drawConnection({ x: centerX, y: convTop - 3 }, invAnch.top!, { dot: 'both' });
      drawGround(invX - 3.5, invY + invH / 2);

      // Proteção Integrada do Inversor (apenas 1 caixa se espaço permitir e apenas 1 inversor)
      if (numInvs === 1 && colWidth >= 75) {
        const badgeW = Math.min(colWidth - invW - 8, 68);
        const badgeH = 12.0;
        const badgeX = invX + invW + 4;
        const badgeY = invY;
        drawInverterProtectionsBadge(badgeX, badgeY, badgeW, badgeH);
      }

      // Descida CA (saída direta do inversor desobstruída)
      const caEntryAnchor: Anchor = { x: centerX, y: caTop + 8 };
      drawConnection(invAnch.bottom!, caEntryAnchor, { dot: 'both' });
      drawLabel(`C-CA-${bIdx + 1}: ${phasesLabel} ${blockCable.cableSimple} | ΔV: ${blockCable.voltageDrop}%`, centerX + 2.0, caTop + 4, { font: '1.5px Arial' });
      caEntryPoints.push({ centerX, caEntryAnchor });
    });

    // ── ZONA QUADRO DE PROTEÇÃO CA (QDS / TRUNK CABLE) ──
    if (caEntryPoints.length > 0) {
      const allXs = caEntryPoints.map(p => p.centerX);
      const minX = Math.min(...allXs);
      const maxX = Math.max(...allXs);
      const troncoX = minX + (maxX - minX) / 2;
      const busbarAcY = caTop + 9;
      const breakerY = busbarAcY + 13;

      if (numInvs > 1) {
        drawConnection({ x: minX, y: busbarAcY }, { x: maxX, y: busbarAcY }, { weight: LW_POWER });
      }
      caEntryPoints.forEach(p => {
        drawConnection(p.caEntryAnchor, { x: p.centerX, y: busbarAcY }, { dot: 'end', weight: LW_POWER });
      });

      drawConnection({ x: troncoX, y: busbarAcY }, { x: troncoX, y: breakerY - 3.0 }, { dot: 'start', weight: LW_POWER });
      const poles = engResult.totalBreakerPolarity === 'Tripolar' ? 3 : 2;
      const brkAnch = drawBreaker(troncoX, breakerY, poles);

      drawLabel(`DJ-SOLAR ${engResult.totalSuggestedBreaker}A (Curva C | Icn: 6 kA)`, troncoX + 5.0, breakerY - 1.2, { font: '1.9px Arial', bold: true });
      drawLabel('Quadro de Proteção Solar (QDS)', troncoX + 5.0, breakerY + 1.8, { font: '1.7px Arial' });

      const dpsCaX = maxX + 16;
      drawConnection({ x: troncoX, y: busbarAcY + 3 }, { x: dpsCaX, y: busbarAcY + 3 }, { dot: 'start' });
      drawConnection({ x: dpsCaX, y: busbarAcY + 3 }, { x: dpsCaX, y: breakerY });
      drawDPS(dpsCaX, breakerY + 1, `DPS CA Classe II 275V (${phasesLabel})`);

      drawConnection(brkAnch.bottom!, { x: troncoX, y: mainBusY }, { dot: 'end', weight: LW_POWER });
    }

    // ── ZONA BARRAMENTO PRINCIPAL & PADRÃO DE ENTRADA ──
    const busStartX = 8;
    const busEndX = dims.drawW - 6;
    drawConnection({ x: busStartX, y: mainBusY }, { x: busEndX, y: mainBusY }, { weight: LW_POWER });
    drawLabel('BARRAMENTO CA PRINCIPAL', busStartX, mainBusY - 2.5, { font: '2.2px Arial', bold: true });

    // Padrão de Entrada da Concessionária (Extremidade Direita com Espaço Garantido)
    const gridBoxW = format === 'A3' ? 68 : 58;
    const gridBoxRight = busEndX;
    const gridBoxLeft = gridBoxRight - gridBoxW;
    const gridBoxTop = mainBusY - 16;
    const gridBoxH = 34;

    ctx.save();
    ctx.setLineDash([1.5, 1.5]);
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = LW_DETAIL;
    ctx.strokeRect(gridBoxLeft, gridBoxTop, gridBoxW, gridBoxH);
    ctx.restore();

    drawLabel('PADRÃO DA CONCESSIONÁRIA', gridBoxLeft + 2.5, gridBoxTop + 3.2, { font: '1.9px Arial', bold: true });
    drawLabel(`${networkDesc}`, gridBoxLeft + 2.5, gridBoxTop + 5.8, { font: '1.5px Arial' });

    // Placa de Advertência de Segurança NBR 16690 (Em posição isolada e dedicada sem encavalar)
    const maxAcX = caEntryPoints.length > 0 ? Math.max(...caEntryPoints.map(p => p.centerX)) + 20 : 50;
    const warnLeft = maxAcX + 6;
    const warnW = Math.min(60, Math.max(48, gridBoxLeft - warnLeft - 6));
    const warnX = Math.max(warnLeft, gridBoxLeft - warnW - 8);
    drawWarningPlate(warnX, mainBusY - 18, warnW, 10.5);

    // Disjuntor Geral Padrão
    const mainBkX = gridBoxLeft + 14;
    drawBreaker(mainBkX, mainBusY, phases);
    drawLabel(`DJ-GERAL ${projectData.technical.mainBreaker}A`, mainBkX, mainBusY + 6.0, { align: 'center', font: '1.8px Arial', bold: true });
    drawLabel(`(Curva C | Icn: 10 kA)`, mainBkX, mainBusY + 8.5, { align: 'center', font: '1.4px Arial' });

    // Medidor Bidirecional
    const meterX = gridBoxLeft + 35;
    const meterRad = 4.8;
    ctx.save();
    ctx.lineWidth = LW_SYMBOL;
    ctx.beginPath();
    ctx.arc(meterX, mainBusY, meterRad, 0, 2 * Math.PI);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    drawLabel('kWh', meterX, mainBusY + 0.7, { align: 'center', bold: true, font: '2.1px Arial' });
    drawLabel('Medidor Bidirecional', meterX, mainBusY - meterRad - 2.8, { align: 'center', font: '1.6px Arial', bold: true });
    drawLabel(`(${projectData.technical.utility})`, meterX, mainBusY - meterRad - 0.8, { align: 'center', font: '1.4px Arial' });

    // Aterramento do Padrão
    const gndX = gridBoxLeft + (format === 'A3' ? 52 : 47);
    drawGround(gndX, mainBusY + 4);
    drawLabel('Aterramento:', gndX, mainBusY + 11.0, { align: 'center', font: '1.4px Arial', bold: true });
    drawLabel('Haste 5/8" x 2.40m', gndX, mainBusY + 13.0, { align: 'center', font: '1.3px Arial' });
    drawLabel('Cabo Cu Nu 25mm²', gndX, mainBusY + 15.0, { align: 'center', font: '1.3px Arial' });

    // Seta da Rede Externa
    const netX = gridBoxRight - 3;
    ctx.beginPath();
    ctx.moveTo(netX, mainBusY);
    ctx.lineTo(netX + 3.0, mainBusY - 2.2);
    ctx.lineTo(netX + 3.0, mainBusY + 2.2);
    ctx.closePath();
    ctx.fill();

    drawLabel(`REDE ${projectData.technical.utility}`, netX - 3, mainBusY - 5.5, { align: 'right', font: '2.0px Arial', bold: true });
    drawLabel(`${projectData.technical.voltage}`, netX - 3, mainBusY - 3.2, { align: 'right', font: '1.6px Arial' });

    ctx.restore();
  }, [dims, projectData, format, DPI, viewMode]);

  // ── Desenho da Tabela Técnica de Cargas (BOM) ──
  const drawTechnicalTable = (
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    data: ReturnType<typeof buildTechnicalTableData>
  ) => {
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = LW_FRAME;
    ctx.strokeRect(x, y, w, h);

    const headerH = format === 'A3' ? 6.5 : 5.5;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x, y, w, headerH);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = format === 'A3' ? 'bold 2.6px Arial' : 'bold 2.1px Arial';
    ctx.fillText('QUADRO TÉCNICO DE EQUIPAMENTOS, CONDUTORES E PROTEÇÃO (DATA SCHEDULE / BOM)', x + 2.5, y + (headerH * 0.68));

    const isTwoCol = w > 160;
    const col1W = isTwoCol ? Math.round(w * 0.54) : w;
    const col2X = isTwoCol ? x + col1W : x;

    if (isTwoCol) {
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 0.25;
      ctx.beginPath();
      ctx.moveTo(col2X, y + headerH);
      ctx.lineTo(col2X, y + h);
      ctx.stroke();
    }

    ctx.fillStyle = '#000000';
    const fontSize = format === 'A3' ? '1.8px Arial' : '1.5px Arial';
    ctx.font = fontSize;
    const rowGap = format === 'A3' ? 2.8 : 2.3;

    if (isTwoCol) {
      const col1Lines = [
        ...data.modulesInfo,
        ...data.invertersInfo,
        ...data.cablesInfo,
      ];
      let y1 = y + headerH + 2.8;
      const maxRows1 = Math.floor((h - headerH - 1.5) / rowGap);
      col1Lines.slice(0, maxRows1).forEach(line => {
        ctx.fillText(`• ${line}`, x + 2, y1);
        y1 += rowGap;
      });

      const col2Lines = [
        ...data.protectionsInfo,
        ...data.ansiInfo,
      ];
      let y2 = y + headerH + 2.8;
      const maxRows2 = Math.floor((h - headerH - 1.5) / rowGap);
      col2Lines.slice(0, maxRows2).forEach(line => {
        ctx.fillText(`• ${line}`, col2X + 2, y2);
        y2 += rowGap;
      });
    } else {
      const allLines = [
        ...data.modulesInfo,
        ...data.invertersInfo,
        ...data.cablesInfo.slice(0, 2),
        ...data.protectionsInfo.slice(0, 2),
        ...data.ansiInfo.slice(0, 1),
      ];
      let textY = y + headerH + 2.5;
      const maxRows = Math.floor((h - headerH - 1.5) / rowGap);
      allLines.slice(0, maxRows).forEach(line => {
        ctx.fillText(`• ${line}`, x + 2, textY);
        textY += rowGap;
      });
    }

    ctx.restore();
  };

  // ── Desenho do Selo Técnico ABNT ──
  const drawSelo = (
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number,
    engResult: ReturnType<typeof getProjectEngineeringStatus>
  ) => {
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = LW_FRAME;
    ctx.strokeRect(x, y, w, h);

    const logoW = format === 'A3' ? 26 : 22;
    ctx.beginPath();
    ctx.moveTo(x + logoW, y);
    ctx.lineTo(x + logoW, y + h);
    ctx.stroke();

    ctx.font = format === 'A3' ? 'bold 3.6px Arial' : 'bold 3.0px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000000';
    ctx.fillText('SolarCAD', x + logoW / 2, y + h / 2 - 2);
    ctx.font = '1.8px Arial';
    ctx.fillText('Suíte GD', x + logoW / 2, y + h / 2 + 2);
    ctx.textAlign = 'left';

    const ix = x + logoW + 2.0;
    let iy = y + (format === 'A3' ? 4.2 : 3.6);
    const lh = format === 'A3' ? 3.6 : 3.0;

    const titlePrefix = viewMode === 'multifilar'
      ? 'DIAGRAMA MULTIFILAR (NBR 5410)'
      : viewMode === 'communication'
      ? 'DIAGRAMA DE COMUNICAÇÃO & MODBUS RTU'
      : 'DIAGRAMA UNIFILAR';

    ctx.font = format === 'A3' ? 'bold 2.6px Arial' : 'bold 2.2px Arial';
    ctx.fillText(`${titlePrefix} - GERAÇÃO DISTRIBUÍDA`, ix, iy);
    iy += lh;

    ctx.font = format === 'A3' ? '2.1px Arial' : '1.8px Arial';
    ctx.fillText(`CLIENTE: ${projectData.client.name || 'Não informado'} | UC: ${projectData.client.utilityId || 'A definir'}`, ix, iy);
    iy += lh;

    ctx.fillText(`LOCAL: ${projectData.client.address?.city || ''} - ${projectData.client.address?.state || 'RJ'} | DISTR: ${projectData.technical.utility}`, ix, iy);
    iy += lh;

    ctx.fillText(`POT. CC: ${engResult.totalDcPower.toFixed(2)} kWp | POT. CA: ${engResult.totalAcPower.toFixed(2)} kW`, ix, iy);
    iy += lh;

    ctx.fillText(`RT: ${projectData.engineer?.name || 'Não informado'} (${projectData.engineer?.crea || 'CREA/CFT'}) | ART: ${projectData.client.art || 'Pendente'}`, ix, iy);

    ctx.restore();
  };

  useEffect(() => {
    drawDiagram();
  }, [drawDiagram]);

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: format.toLowerCase() as any,
      });

      const canvas = canvasRef.current;
      if (!canvas) return;

      const imgData = canvas.toDataURL('image/png', 1.0);
      doc.addImage(imgData, 'PNG', 0, 0, dims.pageW, dims.pageH);

      const clientName = (projectData.client.name || 'Cliente').replace(/\s+/g, '_');
      doc.save(`${clientName}_Diagrama_${viewMode}_${format}.pdf`);
      toast.success(`Diagrama ${viewMode} exportado com sucesso em Prancha ${format}!`);
    } catch (err: any) {
      toast.error(`Erro ao exportar PDF: ${err.message}`);
    }
  };

  const handleExportDXF = () => {
    try {
      const dxfContent = generateSolarUnifilarDxf(projectData, {
        mode: viewMode === 'multifilar' ? 'multifilar' : 'unifilar',
        showCommunication: viewMode === 'communication',
      });
      const clientName = (projectData.client.name || 'Cliente').replace(/\s+/g, '_');
      downloadDxfFile(`${clientName}_Diagrama_${viewMode}_CAD.dxf`, dxfContent);
      toast.success('Arquivo DXF gerado com AutoCAD Blocks e camadas dedicadas!');
    } catch (err: any) {
      toast.error(`Erro ao exportar DXF: ${err.message}`);
    }
  };

  const handleFitToScreen = () => {
    setFitMode(true);
    setZoom(1);
    toast.info('Visualização ajustada 100% à tela.');
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* ── BARRA SUPERIOR DE CONTROLES: SELEÇÃO DE MODOS DE DIAGRAMAÇÃO & PRANCHA ── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 p-2.5 sm:p-3 bg-muted/40 rounded-xl border border-border">
        {/* Alternador de Modos CAD Avançados com Scroll Horizontal no Mobile */}
        <div className="overflow-x-auto pb-1 md:pb-0 scrollbar-none -mx-1 px-1">
          <div className="flex gap-1 bg-background p-1 rounded-lg border border-input shadow-xs shrink-0 whitespace-nowrap">
            <button
              onClick={() => setViewMode('unifilar')}
              className={`px-2.5 sm:px-3 py-1.5 text-xs rounded-md font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                viewMode === 'unifilar'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" /> Unifilar
            </button>

            <button
              onClick={() => setViewMode('multifilar')}
              className={`px-2.5 sm:px-3 py-1.5 text-xs rounded-md font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                viewMode === 'multifilar'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              <Split className="w-3.5 h-3.5 text-emerald-400" /> Multifilar (NBR 5410)
            </button>

            <button
              onClick={() => setViewMode('communication')}
              className={`px-2.5 sm:px-3 py-1.5 text-xs rounded-md font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                viewMode === 'communication'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-purple-400" /> Comunicação & TC
            </button>

            <button
              onClick={() => setViewMode('roof_mapping')}
              className={`px-2.5 sm:px-3 py-1.5 text-xs rounded-md font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                viewMode === 'roof_mapping'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              }`}
            >
              <Home className="w-3.5 h-3.5 text-cyan-400" /> Planta Telhado 2D
            </button>
          </div>
        </div>

        {/* Controles de Prancha, Zoom e Exportação (Ativos nos Modos Esquemáticos) */}
        {viewMode !== 'roof_mapping' && (
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-between md:justify-end">
            <div className="flex gap-1 bg-background p-1 rounded-md border border-input">
              <button
                onClick={() => { setFormat('A4'); setFitMode(true); }}
                className={`px-2 sm:px-2.5 py-1 text-xs rounded font-medium transition-all ${
                  format === 'A4' ? 'bg-brand-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                A4
              </button>
              <button
                onClick={() => { setFormat('A3'); setFitMode(true); }}
                className={`px-2 sm:px-2.5 py-1 text-xs rounded font-medium transition-all ${
                  format === 'A3' ? 'bg-brand-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                A3
              </button>
            </div>

            <div className="flex items-center gap-0.5 border border-input rounded-md bg-background px-1">
              <Button
                size="icon"
                variant="ghost"
                className="w-7 h-7"
                onClick={() => { setFitMode(false); setZoom(z => Math.max(0.4, Number((z - 0.15).toFixed(2)))); }}
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <span className="text-[11px] font-mono px-1 min-w-[44px] text-center">
                {fitMode ? 'Ajustado' : `${Math.round(zoom * 100)}%`}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="w-7 h-7"
                onClick={() => { setFitMode(false); setZoom(z => Math.min(3.0, Number((z + 0.15).toFixed(2)))); }}
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-1.5 text-[11px] gap-1 text-brand-500"
                onClick={handleFitToScreen}
                title="Ajustar 100% à Largura da Tela"
              >
                <Maximize2 className="w-3 h-3" />
              </Button>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                onClick={handleExportPDF}
                className="text-xs bg-brand-600 hover:bg-brand-700 text-white gap-1 shadow-sm px-2.5 h-8"
              >
                <FileText className="w-3.5 h-3.5" /> PDF
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleExportDXF}
                className="text-xs border-brand-500/40 hover:bg-brand-500/10 text-brand-600 dark:text-brand-300 gap-1 shadow-sm px-2.5 h-8"
                title="Exportar DXF para AutoCAD"
              >
                <Download className="w-3.5 h-3.5 text-brand-500" /> DXF
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── ÁREA PRINCIPAL: CANVAS CAD OU PLANTA DE TELHADO ── */}
      {viewMode === 'roof_mapping' ? (
        <StringRoofMapping projectData={projectData} />
      ) : (
        <div
          ref={containerRef}
          className="w-full overflow-auto bg-slate-900/70 p-2 sm:p-4 md:p-6 rounded-xl border border-border flex justify-center items-start min-h-[350px] md:min-h-[500px] max-h-[82vh]"
        >
          <div
            className="shadow-2xl rounded-lg border border-slate-700 bg-white transition-all overflow-hidden flex-shrink-0"
            style={{
              width: fitMode ? '100%' : `${Math.round((format === 'A3' ? 1400 : 1050) * zoom)}px`,
              minWidth: fitMode ? 'auto' : `${Math.round((format === 'A3' ? 1400 : 1050) * zoom)}px`,
              maxWidth: fitMode ? '100%' : 'none',
              aspectRatio: `${dims.pageW} / ${dims.pageH}`,
            }}
          >
            <canvas
              ref={canvasRef}
              className="w-full h-full block rounded-lg bg-white"
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
