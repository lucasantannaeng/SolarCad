import React, { useEffect, useRef, useState } from 'react';
import { ProjectState } from '@/types';
import { getProjectEngineeringStatus, getBlockEngineeringStatus } from '@/services/engineering';
import { getCableForCurrent, getPhases } from '@/components/diagram/cableCalculations';
import { generateSolarUnifilarDxf, downloadDxfFile } from '@/services/dxfExporter';
import { jsPDF } from 'jspdf';
import { Button } from '@/components/ui/button';
import { InfoTrigger } from '@/components/InfoTrigger';
import { Download, Image, ZoomIn, ZoomOut, RotateCcw, FileText } from 'lucide-react';

interface Props {
  projectData: ProjectState;
}

// ── Anchor point system ──
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

// A4 Landscape in mm
const PAGE_W = 297;
const PAGE_H = 210;
const MARGEM_ESQUERDA = 20;
const MARGEM_PADRAO = 7;

const SAFE_W = PAGE_W - MARGEM_ESQUERDA - MARGEM_PADRAO;
const SELO_W = 175;
const SELO_H = 32;
const SELO_X = PAGE_W - MARGEM_PADRAO - SELO_W;
const SELO_Y = PAGE_H - MARGEM_PADRAO - SELO_H;

const DRAW_W = SAFE_W;
const DRAW_H = SELO_Y - MARGEM_PADRAO;

const DPI = 6;
const TEXT_PAD = 1;
const CONN_DOT_R = 1;

// ── LINE WEIGHT HIERARCHY (in mm) ──
const LW_POWER = 0.55;   // Barramentos, fios de potência, cabo principal
const LW_SYMBOL = 0.30;  // Disjuntores, inversores, medidor, módulos, DPS
const LW_FRAME = 0.40;   // Moldura externa e selo
const LW_DETAIL = 0.15;  // Linhas de chamada, hachuras, símbolos finos
const LW_GROUND = 0.45;  // Hastes do símbolo de aterramento NBR

// ── MIN FONT SIZE for technical specs ──
const MIN_SPEC_FONT = 2.5;

export const DiagramCanvas: React.FC<Props> = ({ projectData }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const drawDiagram = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = PAGE_W * DPI;
    canvas.height = PAGE_H * DPI;
    ctx.scale(DPI, DPI);

    // Global line style for smooth connections
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);

    // ── MOLDURA ──
    ctx.strokeStyle = '#000';
    ctx.lineWidth = LW_FRAME;
    ctx.strokeRect(MARGEM_ESQUERDA, MARGEM_PADRAO, SAFE_W, PAGE_H - MARGEM_PADRAO * 2);

    // ── SELO ──
    const engResult = getProjectEngineeringStatus(projectData.equipmentBlocks, projectData.technical);
    drawSelo(ctx, SELO_X, SELO_Y, engResult);

    // ── TRANSLATE to safe drawing origin ──
    ctx.save();
    ctx.translate(MARGEM_ESQUERDA, MARGEM_PADRAO);
    ctx.beginPath();
    ctx.rect(0, 0, DRAW_W, DRAW_H);
    ctx.clip();

    const phases = getPhases(projectData.technical.connectionType);

    // ══════════════════════════════════════════════════════
    // ── DRAWING PRIMITIVES (all return Anchors) ──
    // ══════════════════════════════════════════════════════

    const drawConnDot = (x: number, y: number) => {
      ctx.save();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(x, y, CONN_DOT_R, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    };

    const drawLabel = (
      text: string,
      x: number,
      y: number,
      opts?: { align?: CanvasTextAlign; font?: string; bold?: boolean; spec?: boolean; noMask?: boolean }
    ) => {
      ctx.save();
      const rawFont = opts?.font || '2.5px Arial';
      // Parse "<size>px Arial" → enforce minimum for spec labels
      const sizeMatch = rawFont.match(/([\d.]+)px\s+(.+)/);
      let parsedSize = sizeMatch ? parseFloat(sizeMatch[1]) : 2.5;
      const family = sizeMatch ? sizeMatch[2] : 'Arial';
      if (opts?.spec) parsedSize = Math.max(parsedSize, MIN_SPEC_FONT);
      const finalFont = `${parsedSize}px ${family}`;
      ctx.font = opts?.bold ? `bold ${finalFont}` : finalFont;
      ctx.textAlign = opts?.align || 'left';

      // Text Halo (contorno branco) — substitui a caixa branca para não amputar o desenho
      if (!opts?.noMask) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = Math.max(parsedSize * 0.4, 0.8);
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(text, x, y);
      }

      // Texto principal em preto
      ctx.fillStyle = '#000000';
      ctx.fillText(text, x, y);
      ctx.restore();
    };

    // ── drawConnection: routes a wire between two anchors using 90° bends (POWER weight) ──
    const drawConnection = (from: Anchor, to: Anchor, opts?: { dot?: 'start' | 'end' | 'both' | 'none'; weight?: number }) => {
      ctx.save();
      // Garante linha preta sólida e espessura de potência (eliminando heranças de #555/dashed)
      ctx.strokeStyle = '#000000';
      ctx.setLineDash([]);
      ctx.lineCap = 'square';
      ctx.lineJoin = 'miter';
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

    // ── drawModule: returns anchors ──
    const drawModule = (x: number, y: number, w: number, h: number): Anchors => {
      ctx.save();
      ctx.lineWidth = LW_SYMBOL;
      ctx.strokeRect(x, y, w, h);
      ctx.beginPath();
      ctx.moveTo(x, y + h - 1.5);
      ctx.lineTo(x + w, y + 1.5);
      ctx.stroke();
      ctx.font = '2px Arial';
      ctx.fillStyle = '#000';
      ctx.fillText('+', x + 0.5, y + 2.5);
      ctx.fillText('−', x + w - 1.5, y + h - 0.8);
      ctx.restore();
      return {
        top: { x: x + w / 2, y },
        bottom: { x: x + w / 2, y: y + h },
        left: { x, y: y + h / 2 },
        right: { x: x + w, y: y + h / 2 },
        center: { x: x + w / 2, y: y + h / 2 },
      };
    };

    // ── drawFuse: returns left/right anchors ──
    const drawFuse = (x: number, y: number): Anchors => {
      const w = 5, h = 2;
      ctx.save();
      ctx.lineWidth = LW_SYMBOL;
      ctx.strokeRect(x - w / 2, y - h / 2, w, h);
      const leftAnchor = { x: x - w / 2 - 1.5, y };
      const rightAnchor = { x: x + w / 2 + 1.5, y };
      ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(leftAnchor.x, leftAnchor.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(rightAnchor.x, rightAnchor.y); ctx.stroke();
      ctx.restore();
      return { left: leftAnchor, right: rightAnchor, center: { x, y } };
    };

    // ── drawSwitch: returns left/right anchors ──
    const drawSwitch = (x: number, y: number): Anchors => {
      ctx.save();
      ctx.lineWidth = LW_SYMBOL;
      const r = 0.7;
      const leftA = { x: x - 3, y };
      const rightA = { x: x + 3, y };
      ctx.beginPath(); ctx.arc(leftA.x, leftA.y, r, 0, 2 * Math.PI); ctx.fill();
      ctx.beginPath(); ctx.arc(rightA.x, rightA.y, r, 0, 2 * Math.PI); ctx.fill();
      ctx.beginPath(); ctx.moveTo(leftA.x, leftA.y); ctx.lineTo(x + 2.5, y - 2.5); ctx.stroke();
      ctx.restore();
      return { left: leftA, right: rightA, center: { x, y } };
    };

    // ── drawBreaker: returns top/bottom anchors ──
    const drawBreaker = (x: number, y: number, poles: number): Anchors => {
      ctx.save();
      ctx.lineWidth = LW_SYMBOL;
      const spacing = 1.8;
      const startX = x - ((poles - 1) * spacing) / 2;
      for (let i = 0; i < poles; i++) {
        const px = startX + i * spacing;
        ctx.beginPath(); ctx.moveTo(px, y - 3); ctx.lineTo(px, y + 3); ctx.stroke();
        ctx.beginPath(); ctx.arc(px - 0.8, y, 0.5, 0, 2 * Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px - 0.8, y - 0.8); ctx.lineTo(px + 0.8, y + 0.8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px + 0.8, y - 0.8); ctx.lineTo(px - 0.8, y + 0.8); ctx.stroke();
      }
      if (poles > 1) {
        ctx.lineWidth = LW_DETAIL;
        ctx.beginPath();
        ctx.moveTo(startX, y - 3);
        ctx.lineTo(startX + (poles - 1) * spacing, y - 3);
        ctx.stroke();
      }
      ctx.restore();
      return {
        top: { x, y: y - 3 },
        bottom: { x, y: y + 3 },
        center: { x, y },
      };
    };

    // ── drawGround: NBR standard — vertical stem + 3 decreasing horizontal lines ──
    const drawGround = (x: number, y: number): Anchors => {
      const topA = { x, y };
      ctx.save();
      ctx.lineWidth = LW_GROUND;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 2.5); ctx.stroke();
      ctx.lineWidth = LW_GROUND;
      ctx.beginPath(); ctx.moveTo(x - 3, y + 2.5); ctx.lineTo(x + 3, y + 2.5); ctx.stroke();
      ctx.lineWidth = LW_SYMBOL;
      ctx.beginPath(); ctx.moveTo(x - 2, y + 3.5); ctx.lineTo(x + 2, y + 3.5); ctx.stroke();
      ctx.lineWidth = LW_DETAIL;
      ctx.beginPath(); ctx.moveTo(x - 1, y + 4.5); ctx.lineTo(x + 1, y + 4.5); ctx.stroke();
      ctx.restore();
      return { top: topA };
    };

    // ── drawDPS: returns top anchor ──
    const drawDPS = (x: number, y: number, label: string): Anchors => {
      const w = 4, h = 7;
      const topA = { x, y };
      ctx.save();
      ctx.lineWidth = LW_SYMBOL;
      ctx.strokeRect(x - w / 2, y, w, h);
      ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + h + 2); ctx.stroke();
      ctx.restore();
      drawGround(x, y + h + 2);
      if (label) {
        drawLabel(label, x, y - 1.5, { align: 'center', font: '2.5px Arial', spec: true });
      }
      return { top: topA, bottom: { x, y: y + h } };
    };

    // ── drawInverter: returns all anchors ──
    const drawInverter = (x: number, y: number, w: number, h: number): Anchors => {
      ctx.save();
      ctx.lineWidth = LW_SYMBOL;
      ctx.fillStyle = '#FFF';
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      ctx.lineTo(x + w, y);
      ctx.stroke();
      ctx.font = 'bold 2.5px Arial';
      ctx.fillStyle = '#000';
      ctx.fillText('CC', x + 1, y + 4);
      ctx.fillText('CA', x + w - 4.5, y + h - 1.5);
      ctx.font = 'bold 2px Arial';
      ctx.fillText('=', x + 2, y + h - 2);
      ctx.fillText('~', x + w - 3, y + 3);
      ctx.restore();
      return {
        top: { x: x + w / 2, y },
        bottom: { x: x + w / 2, y: y + h },
        left: { x, y: y + h / 2 },
        right: { x: x + w, y: y + h / 2 },
        center: { x: x + w / 2, y: y + h / 2 },
      };
    };

    const drawWiringSymbols = (x: number, y: number, p: number) => {
      const h = 3, sp = 1.2;
      let sx = x - (p * sp) / 2;
      ctx.save();
      ctx.lineWidth = LW_DETAIL;
      for (let i = 0; i < p; i++) {
        ctx.beginPath(); ctx.moveTo(sx, y - h / 2); ctx.lineTo(sx, y + h / 2); ctx.stroke();
        sx += sp;
      }
      sx += sp;
      ctx.beginPath();
      ctx.moveTo(sx, y - h / 2); ctx.lineTo(sx, y + h / 2);
      ctx.lineTo(sx + 1, y - h / 2);
      ctx.stroke();
      sx += sp + 0.8;
      ctx.beginPath();
      ctx.moveTo(sx, y - h / 2); ctx.lineTo(sx, y + h / 2);
      ctx.moveTo(sx - 0.8, y - h / 2); ctx.lineTo(sx + 0.8, y - h / 2);
      ctx.stroke();
      ctx.restore();
    };

    const drawAnsiBlocks = (x: number, y: number) => {
      const codes = ["27", "59", "25", "81O", "81U"];
      const boxSize = 5;
      const gap = 0.8;
      ctx.save();
      ctx.lineWidth = LW_SYMBOL;
      codes.forEach((code, i) => {
        const yPos = y + i * (boxSize + gap);
        ctx.fillStyle = '#FFF';
        ctx.fillRect(x, yPos, boxSize, boxSize);
        ctx.strokeRect(x, yPos, boxSize, boxSize);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 2.5px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(code, x + boxSize / 2, yPos + boxSize / 2 + 0.9);
      });
      ctx.textAlign = 'left';
      ctx.restore();
    };


    const clampX = (v: number) => Math.max(1, Math.min(v, DRAW_W - 1));
    const clampY = (v: number) => Math.max(1, Math.min(v, DRAW_H - 1));

    // ══════════════════════════════════════════════════════
    // ── BLOCK FLOWCHART ──
    // ══════════════════════════════════════════════════════
    const drawBlockFlowchart = () => {
      const x = 2, y = 2, boxW = 22, boxH = 7, gap = 6;
      const boxes = ["Geração", "Proteção", "Medição", "Rede"];
      ctx.font = 'bold 3px Arial';
      ctx.fillStyle = '#000';
      ctx.fillText("DIAGRAMA DE BLOCOS:", x, y + 3);
      let cx = x;
      const startY = y + 6;
      boxes.forEach((text, i) => {
        ctx.fillStyle = '#FFF';
        ctx.fillRect(cx, startY, boxW, boxH);
        ctx.strokeRect(cx, startY, boxW, boxH);
        ctx.fillStyle = '#000';
        ctx.font = '2.8px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(text, cx + boxW / 2, startY + boxH / 2 + 1);
        ctx.textAlign = 'left';
        if (i < boxes.length - 1) {
          const arrowStart = { x: cx + boxW, y: startY + boxH / 2 };
          const arrowEnd = { x: cx + boxW + gap, y: startY + boxH / 2 };
          drawConnection(arrowStart, arrowEnd);
          ctx.beginPath();
          ctx.moveTo(arrowEnd.x, arrowEnd.y);
          ctx.lineTo(arrowEnd.x - 1.5, arrowEnd.y - 1);
          ctx.lineTo(arrowEnd.x - 1.5, arrowEnd.y + 1);
          ctx.fill();
        }
        cx += boxW + gap;
      });
    };

    drawBlockFlowchart();

    // ══════════════════════════════════════════════════════
    // ── ZONE DEFINITIONS ──
    // ══════════════════════════════════════════════════════
    const maxDrawH = DRAW_H;
    const ccTop = 20;
    const ccBot = 52;
    const convTop = 57;
    const convBot = 95;
    const caTop = 122;
    const caBot = Math.min(160, maxDrawH - 8);
    const mainBusY = Math.min(168, maxDrawH - 15);

    const blocks = projectData.equipmentBlocks;

    // ── 1. FLATTEN: expand inverterQty into physical inverter instances ──
    interface PhysicalInverter {
      block: typeof blocks[0];
      bIdx: number;
      invIdx: number;
    }
    const physicalInverters: PhysicalInverter[] = [];
    blocks.forEach((block, bIdx) => {
      const qty = block.inverterQty || 1;
      for (let i = 0; i < qty; i++) {
        physicalInverters.push({ block, bIdx, invIdx: i });
      }
    });
    const numInvs = physicalInverters.length;
    const colWidth = (DRAW_W - 4) / Math.max(numInvs, 1);

    const caEntryPoints: { centerX: number; caEntryAnchor: Anchor; blockCable: ReturnType<typeof getCableForCurrent>; blockPhases: number }[] = [];
    let sharedTrunkData: { troncoX: number; sharedCable: ReturnType<typeof getCableForCurrent>; sharedPhases: number } | null = null;

    // ── 2. DRAW each physical inverter column (CC + Conversion zones) ──
    physicalInverters.forEach((phys, pIdx) => {
      const { block, bIdx, invIdx } = phys;
      const bx = 2 + pIdx * colWidth;
      const bw = colWidth - 4;
      const centerX = clampX(bx + bw / 2);

      const blockEng = getBlockEngineeringStatus(block, projectData.technical);
      const blockCable = getCableForCurrent(blockEng.nominalCurrent, projectData.technical);
      const blockPhases = block.inverter.outputPhases === 3 ? 3 : (block.inverter.outputPhases === 2 ? 2 : phases);

      // ── ZONE CC: Modules + StringBox (only draw for invIdx === 0 to avoid duplicate strings) ──
      const numStrings = block.strings.length;
      const moduleW = 5;
      const moduleH = 8;
      const stringSpacing = Math.min(12, (ccBot - ccTop - moduleH) / Math.max(numStrings, 1));
      const stringsStartY = ccTop + ((ccBot - ccTop) - (numStrings - 1) * stringSpacing) / 2;

      const dcBusX = clampX(bx + bw * 0.35);

      if (invIdx === 0) {
        // Draw strings only once per block (first physical inverter of that block)
        block.strings.forEach((str, sIdx) => {
          const sy = clampY(stringsStartY + sIdx * stringSpacing);
          const mx = clampX(bx + 3);

          const modAnch = drawModule(mx, sy - moduleH / 2, moduleW, moduleH);

          if (sIdx === 0) {
            // Consolida Nome e Potência ACIMA do primeiro módulo (evita colisão com os de baixo)
            drawLabel(`${block.moduleBrand || 'PV'} ${block.moduleModel || ''}`, mx, sy - moduleH / 2 - 5, { font: '2.2px Arial', spec: true });
            drawLabel(`${block.modulePowerW}W`, mx, sy - moduleH / 2 - 2, { font: '2.2px Arial', spec: true });
          }
          drawLabel(`S${sIdx + 1}: ${str.count} mód.`, mx + moduleW + 2, sy - 1, { font: '2.5px Arial', spec: true });

          const fuseX = mx + moduleW + 6.5;
          const fuseAnch = drawFuse(fuseX, sy);
          drawConnection(modAnch.right!, fuseAnch.left!, { dot: 'start' });

          const busAnchor: Anchor = { x: dcBusX, y: sy };
          drawConnection(fuseAnch.right!, busAnchor, { dot: 'end' });

          if (sIdx === 0) {
            drawLabel('6mm² 1,5kV CC', fuseAnch.center!.x, sy - 3.5, { align: 'center', font: '2.5px Arial', spec: true });
          }
        });

        // DC Bus vertical line
        if (numStrings > 1) {
          const busTop: Anchor = { x: dcBusX, y: stringsStartY };
          const busBot: Anchor = { x: dcBusX, y: stringsStartY + (numStrings - 1) * stringSpacing };
          const prevLW = ctx.lineWidth;
          ctx.lineWidth = 0.5;
          drawConnection(busTop, busBot);
          ctx.lineWidth = prevLW;
        }

        // DC switch on bus
        const midCC = (ccTop + ccBot) / 2;
        const switchAnchor: Anchor = { x: dcBusX + 5, y: midCC };
        const dcBusMidAnchor: Anchor = { x: dcBusX, y: midCC };
        drawConnection(dcBusMidAnchor, { x: switchAnchor.x - 3, y: midCC });
        const swAnch = drawSwitch(switchAnchor.x, midCC);

        // DPS CC
        const dpsCCx = clampX(dcBusX + 12);
        const dpsCCbus: Anchor = { x: dpsCCx, y: midCC };
        drawConnection(swAnch.right!, dpsCCbus, { dot: 'end' });
        const dpsDown: Anchor = { x: dpsCCx, y: midCC + 6 };
        drawConnection(dpsCCbus, dpsDown);
        drawDPS(dpsCCx, midCC + 6, "DPS CC");

        // Vertical line: DC zone → Inverter
        const invEntryX = centerX;
        const dcExitAnchor: Anchor = { x: dpsCCx + 6, y: midCC };
        const invTopAnchor: Anchor = { x: invEntryX, y: convTop + 2 };
        drawConnection(swAnch.right!, { x: dpsCCx + 6, y: midCC });
        drawConnection(dcExitAnchor, invTopAnchor, { dot: 'end' });
      } else {
        // For additional physical inverters of the same block, draw a shared DC bus tap
        const midCC = (ccTop + ccBot) / 2;
        // Draw a label indicating shared string box
        drawLabel(`(INV ${invIdx + 1}/${block.inverterQty || 1})`, centerX, ccTop + 5, { align: 'center', font: '2.5px Arial', spec: true });
        // Draw vertical line from DC zone down to inverter
        const invTopAnchor: Anchor = { x: centerX, y: convTop + 2 };
        const dcTapAnchor: Anchor = { x: centerX, y: ccBot - 2 };
        drawConnection(dcTapAnchor, invTopAnchor, { dot: 'end' });
        // Horizontal tap from original DC bus
        const origDcBusX = clampX((2 + (pIdx - invIdx) * colWidth) + (colWidth - 4) * 0.35);
        drawConnection({ x: origDcBusX, y: midCC }, { x: centerX, y: midCC }, { dot: 'start' });
        drawConnection({ x: centerX, y: midCC }, dcTapAnchor);
      }

      // ── ZONE CONVERSION: Inverter ──
      const invW = 15;
      const invH = 12;
      const invX = centerX - invW / 2;
      const invY = convTop + ((convBot - convTop) - invH) / 2;

      const invAnch = drawInverter(invX, invY, invW, invH);

      const invLabel = (block.inverterQty || 1) > 1
        ? `${block.inverterBrand || 'INV'} ${block.inverterModel || ''} #${invIdx + 1}`
        : `${block.inverterBrand || 'INV'} ${block.inverterModel || ''}`;
      // Textos do Inversor deslocados para a ESQUERDA do componente
      const textRightX = invX - 3; // 3mm de respiro da borda esquerda do inversor
      const textMidY = invY + (invH / 2); // Centralizado verticalmente
      drawLabel(invLabel, textRightX, textMidY - 2, { align: 'right', font: '2.6px Arial', bold: true, spec: true });
      drawLabel(`${block.inverterPowerKw}kW`, textRightX, textMidY + 2, { align: 'right', font: '2.5px Arial', spec: true });

      // Connect DC line to inverter top
      const invTopAnchorFinal: Anchor = { x: centerX, y: convTop + 2 };
      drawConnection(invTopAnchorFinal, invAnch.top!, { dot: 'both' });

      // Ground at inverter base
      drawGround(centerX, invAnch.bottom!.y);

      // ANSI blocks
      drawAnsiBlocks(clampX(invX + invW + 3), invY);

      // ── Inverter output → CA zone ──
      const invOutBottom: Anchor = { x: centerX, y: invAnch.bottom!.y + 5 };
      const caEntryAnchor: Anchor = { x: centerX, y: caTop + 2 };
      drawConnection(invOutBottom, caEntryAnchor, { dot: 'both' });

      caEntryPoints.push({ centerX, caEntryAnchor, blockCable, blockPhases });
    });

    // ══════════════════════════════════════════════════════
    // ── SHARED CA BOX (Centralized Vertical Trunk) ──
    // ══════════════════════════════════════════════════════
    if (caEntryPoints.length > 0) {
      const sharedCable = caEntryPoints[0].blockCable;
      const sharedPhases = Math.max(...caEntryPoints.map(p => p.blockPhases));
      const allEntryXs = caEntryPoints.map(p => p.centerX);
      const minEntryX = Math.min(...allEntryXs);
      const maxEntryX = Math.max(...allEntryXs);

      const busbarAcY = caTop + 8; // Horizontal aggregation bar
      const troncoX = minEntryX + (maxEntryX - minEntryX) / 2;
      const breakerY = busbarAcY + 15;

      // DPS deslocado para a direita, abrindo espaço para textos laterais do disjuntor
      const dpsCaX = clampX(troncoX + 28);

      // 1. DESENHO DA CAIXA TRACEJADA (Englobando o novo layout com DPS afastado)
      const boxLeft = Math.max(2, minEntryX - 10);
      const boxRight = clampX(dpsCaX + 10);
      const boxTop = caTop + 2;
      const boxBot = breakerY + 12;

      ctx.save();
      ctx.setLineDash([1, 1]);
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 0.4;
      ctx.strokeRect(boxLeft, boxTop, boxRight - boxLeft, boxBot - boxTop);
      ctx.restore();
      ctx.strokeStyle = '#000';

      drawLabel('CAIXA DE CONEXÃO CA', boxLeft + 2, boxTop + 4, { font: '2.2px Arial', bold: true, spec: true });

      // 2. Barramento de Agrupamento Horizontal
      drawConnection({ x: minEntryX, y: busbarAcY }, { x: maxEntryX, y: busbarAcY }, { weight: LW_POWER });

      // Conecta todos os inversores a este barramento
      caEntryPoints.forEach(({ centerX: cx, caEntryAnchor: entry }) => {
        drawConnection(entry, { x: cx, y: busbarAcY }, { dot: 'end', weight: LW_POWER });
      });

      // 3. Eixo Central (Tronco Vertical) descendo para o disjuntor
      drawConnection({ x: troncoX, y: busbarAcY }, { x: troncoX, y: breakerY - 3 }, { dot: 'start', weight: LW_POWER });

      // 4. Disjuntor de proteção geral — MESMO valor exibido no "Resumo de Engenharia > Proteção Geral"
      const correctBreakerLabel = `${engResult.totalSuggestedBreaker}A ${engResult.totalBreakerPolarity}`;
      const polesForDraw = engResult.totalBreakerPolarity === 'Tripolar' ? 3 : 2;

      const brkAnch = drawBreaker(troncoX, breakerY, polesForDraw);

      // 5. Textos do disjuntor posicionados ABAIXO do símbolo, deslocados à direita para não cortar o fio vertical
      const brkTextX = troncoX + 4;
      drawLabel(correctBreakerLabel, brkTextX, breakerY + 6, { align: 'left', font: '1.8px Arial', bold: true, spec: true });
      drawLabel('DISJUNTOR PROTEÇÃO', brkTextX, breakerY + 10, { align: 'left', font: '1.8px Arial', spec: true });

      // 6. Conecta o DPS lateralmente (agora mais afastado)
      drawConnection({ x: troncoX, y: busbarAcY + 4 }, { x: dpsCaX, y: busbarAcY + 4 }, { dot: 'start' });
      drawConnection({ x: dpsCaX, y: busbarAcY + 4 }, { x: dpsCaX, y: breakerY });
      drawDPS(dpsCaX, breakerY + 1, sharedCable.dps);

      // 7. Descida Direta e contínua para o Barramento Principal
      drawConnection(brkAnch.bottom!, { x: troncoX, y: mainBusY }, { dot: 'end', weight: LW_POWER });

      // Guarda dados para desenhar especificações de cabo + símbolos APÓS o barramento principal
      sharedTrunkData = { troncoX, sharedCable, sharedPhases };
    }

    // ══════════════════════════════════════════════════════
    // ── MAIN CA BUS (horizontal, fixed Y) ──
    // ══════════════════════════════════════════════════════
    const busStartX = 5;
    const seloLeftBoundary = SELO_X - MARGEM_ESQUERDA;
    const busEndX = Math.min(DRAW_W - 5, seloLeftBoundary - 3);

    const mainBusLeft: Anchor = { x: busStartX, y: mainBusY };
    const mainBusRight: Anchor = { x: busEndX, y: mainBusY };
    drawConnection(mainBusLeft, mainBusRight, { weight: LW_POWER });

    drawLabel('BARRAMENTO CA PRINCIPAL', busStartX, mainBusY + 5, { font: '2px Arial', bold: true, spec: true });

    // ── UC label centered on Main Bus (between trunk and grid entry) ──
    if (sharedTrunkData) {
      const { troncoX } = sharedTrunkData;
      const gridNodeXPreview = busEndX - 55 + 15; // mirrors gridBoxLeft + 15 (mainBkX) below
      const cableLabelX = troncoX + (gridNodeXPreview - troncoX) / 2;
      drawLabel(`UC: ${projectData.client.utilityId}`, cableLabelX, mainBusY - 3, { align: 'center', font: '1.8px Arial', bold: true, spec: true });
    }

    // ══════════════════════════════════════════════════════
    // ── GRID STANDARD (Padrão de Entrada) ──
    // ══════════════════════════════════════════════════════
    const gridBoxW = 55;
    const gridBoxH = 38;
    const gridBoxRight = busEndX;
    const gridBoxLeft = gridBoxRight - gridBoxW;
    // 1. FUSÃO DE EIXOS: O Padrão de Entrada senta EXATAMENTE no Barramento Principal
    const gridMidY = mainBusY;
    const gridBoxTop = gridMidY - 15;
    const gridBoxBot = gridBoxTop + gridBoxH;

    ctx.save();
    ctx.lineWidth = LW_DETAIL;
    ctx.setLineDash([1, 1]);
    ctx.strokeStyle = '#555';
    ctx.strokeRect(gridBoxLeft, gridBoxTop, gridBoxW, gridBoxH);
    ctx.restore();
    ctx.strokeStyle = '#000';

    drawLabel('PADRÃO DE ENTRADA', gridBoxLeft + 2, gridBoxTop + 3, { font: '2.2px Arial', bold: true, spec: true });

    // Warning plate
    const plateW = 25, plateH = 8;
    const plateX = gridBoxLeft + 2;
    const plateY = gridBoxTop + 7;
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(plateX, plateY, plateW, plateH);
    ctx.save();
    ctx.lineWidth = LW_SYMBOL;
    ctx.strokeRect(plateX, plateY, plateW, plateH);
    ctx.restore();
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.font = 'bold 2.8px Arial';
    ctx.fillText('CUIDADO', plateX + plateW / 2, plateY + 3.5);
    ctx.font = 'bold 2.5px Arial';
    ctx.fillText('GERAÇÃO PRÓPRIA', plateX + plateW / 2, plateY + 6.5);
    ctx.textAlign = 'left';

    // Main breaker — anchored. Labels reposicionados ABAIXO para evitar colisão com nós da linha.
    const mainBkX = gridBoxLeft + 15;
    const mainBrkAnch = drawBreaker(mainBkX, gridMidY, phases);
    // Amperagem + polaridade ABAIXO do disjuntor
    const gridPolarity = phases === 3 ? 'Tripolar' : phases === 2 ? 'Bipolar' : 'Monopolar';
    drawLabel(`${projectData.technical.mainBreaker}A ${gridPolarity}`, mainBkX, gridMidY + 9, { align: 'center', font: '1.8px Arial', spec: true });
    // Título do componente logo abaixo da amperagem
    drawLabel('DISJUNTOR PADRÃO', mainBkX, gridMidY + 13, { align: 'center', font: '1.8px Arial', bold: true, spec: true });

    // Meter (enlarged)
    const meterX = gridBoxLeft + 38;
    const meterDiam = 10;
    const meterRad = meterDiam / 2;
    const meterAnchor: Anchor = { x: meterX, y: gridMidY };
    ctx.save();
    ctx.lineWidth = LW_SYMBOL;
    ctx.beginPath();
    ctx.arc(meterX, gridMidY, meterRad, 0, 2 * Math.PI);
    ctx.fillStyle = '#FFF';
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#000';
    drawLabel('kWh', meterX, gridMidY + 0.8, { align: 'center', font: '2.5px Arial', bold: true, spec: true });
    drawLabel('Medidor Bidirecional', meterX, gridMidY - meterRad - 2.5, { align: 'center', font: '2.5px Arial', spec: true });

    // ── Continuous power path (LW_POWER, preto): Main Bus → Breaker → Meter → Grid ──
    // FUSÃO: barramento e padrão estão no mesmo eixo Y, sem degraus verticais.
    // Linha do barramento entra direto no disjuntor (horizontal contínua).
    drawConnection({ x: gridBoxLeft, y: gridMidY }, { x: mainBrkAnch.top!.x, y: gridMidY }, { weight: LW_POWER });

    // Breaker right → meter left (continuous horizontal)
    const breakerRight: Anchor = { x: mainBrkAnch.bottom!.x + 8, y: gridMidY };
    const meterLeft: Anchor = { x: meterX - meterRad, y: gridMidY };
    drawConnection(breakerRight, meterLeft, { dot: 'both', weight: LW_POWER });

    // ── Conexões de Potência (Linhas limpas, sem lixo) ──
    // Garante a conexão física contínua do nó direito do medidor até a rede e a proteção
    drawConnection({ x: meterX + meterRad, y: gridMidY }, { x: gridBoxRight, y: gridMidY }, { dot: 'start', weight: LW_POWER });
    // Se o tronco da proteção estiver fora da caixa, estende a linha principal para soldá-los
    const troncoXForWeld = sharedTrunkData?.troncoX;
    if (troncoXForWeld !== undefined && troncoXForWeld > gridBoxRight) {
      drawConnection({ x: gridBoxRight, y: gridMidY }, { x: troncoXForWeld, y: gridMidY }, { dot: 'end', weight: LW_POWER });
    } else {
      drawConnection({ x: gridBoxRight, y: gridMidY }, { x: gridBoxRight + 5, y: gridMidY }, { weight: LW_POWER });
    }

    // ── Rótulo Único do Cabo de Entrada (centralizado e blindado pelo Halo) ──
    const gridCableX = meterX + meterRad + ((gridBoxRight - (meterX + meterRad)) / 2);
    const gridCableSize = projectData.technical.mainBreaker > 50 ? '16' : '10';
    const defaultCableSpec = `3#${gridCableSize}mm² + 1#${gridCableSize}mm²(T) 750V`;
    drawLabel(defaultCableSpec, gridCableX, gridMidY - 3.5, { align: 'center', font: '1.8px Arial', spec: true });
    drawWiringSymbols(gridCableX, gridMidY, phases);

    // Grid/network triangle
    const netX = clampX(gridBoxRight + 8);
    ctx.beginPath();
    ctx.moveTo(netX, gridMidY);
    ctx.lineTo(netX + 4, gridMidY - 3);
    ctx.lineTo(netX + 4, gridMidY + 3);
    ctx.closePath();
    ctx.fill();

    drawLabel(`REDE ${projectData.technical.utility}`, netX + 6, gridMidY - 4, { font: '2.8px Arial', bold: true, spec: true });
    drawLabel(`${projectData.technical.voltage}`, netX + 6, gridMidY - 7.5, { font: '2.5px Arial', spec: true });

    // Ground near grid box — connected to breaker, shifted left of selo
    const groundX = clampX(Math.min(gridBoxLeft + 10, seloLeftBoundary - 8));
    const groundY = gridBoxBot + 1;
    if (groundY + 5 < DRAW_H - 2) {
      const groundTop: Anchor = { x: groundX, y: gridMidY };
      const groundBot: Anchor = { x: groundX, y: groundY };
      drawConnection(groundTop, groundBot, { dot: 'start' });
      drawGround(groundX, groundY);
    }

    // ── PROTECTION SPECS TEXT ──
    const specY = caTop - 18;
    if (specY > ccBot + 5) {
      drawLabel('Requisitos de Proteção do Inversor:', 2, specY, { font: '2.8px Arial', bold: true, spec: true });
      const lh = 3.2;
      const col1Lines = [
        '(59) Sobretensão: Tensão de fase máx. 10% acima da nominal. Tempo ≤ 1,0s.',
        '(27) Subtensão: Tensão de fase máx. 10% abaixo da nominal. Tempo ≤ 3,0s.',
      ];
      const col2Lines = [
        '(81O/U) Frequência: 59,5–60,5 Hz. Tempo ≤ 5,0s.',
        '(25) Sincronismo: Δφ 10°, ΔV 0,05pu, Δf 0,1Hz. Tempo ≤ 0,2s.',
      ];
      col1Lines.forEach((l, i) => {
        drawLabel(l, 2, specY + 4 + i * lh, { font: '2.5px Arial', spec: true });
      });
      col2Lines.forEach((l, i) => {
        drawLabel(l, DRAW_W / 2, specY + 4 + i * lh, { font: '2.5px Arial', spec: true });
      });
      drawLabel('PADRÃO DE CORES NBR 5410: Fases: Preto/Branco/Vermelho | Neutro: Azul Claro | Terra: Verde/Verde-Amarelo', 2, specY + 4 + 3 * lh, { font: '2.5px Arial', bold: true, spec: true });
    }

    ctx.restore();
  };

  const drawSelo = (ctx: CanvasRenderingContext2D, x: number, y: number, engResult: ReturnType<typeof getProjectEngineeringStatus>) => {
    ctx.save();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = LW_FRAME;
    ctx.strokeRect(x, y, SELO_W, SELO_H);

    const logoW = 28;
    const infoW = 95;
    ctx.beginPath(); ctx.moveTo(x + logoW, y); ctx.lineTo(x + logoW, y + SELO_H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + logoW + infoW, y); ctx.lineTo(x + logoW + infoW, y + SELO_H); ctx.stroke();

    ctx.font = 'bold 4px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000';
    ctx.fillText('SolarCAD', x + logoW / 2, y + SELO_H / 2 - 2);
    ctx.font = '2px Arial';
    ctx.fillText('Suite GD', x + logoW / 2, y + SELO_H / 2 + 2);
    ctx.textAlign = 'left';

    const selopad = 1.5; // 1.5mm padding from borders
    const ix = x + logoW + selopad;
    let iy = y + selopad + 2;
    const ilh = 3.2;
    ctx.font = 'bold 2.5px Arial';
    ctx.fillText('DIAGRAMA UNIFILAR - MICROGERAÇÃO FOTOVOLTAICA', ix, iy);
    iy += ilh;
    ctx.font = '2.2px Arial';
    ctx.fillText(`CLIENTE: ${projectData.client.name.toUpperCase()}`, ix, iy);
    iy += ilh;
    const addr = projectData.client.address;
    const addrText = `END.: ${addr.street}, ${addr.number} - ${addr.neighborhood} - ${addr.city}/${addr.state}`;
    ctx.fillText(addrText.substring(0, 80), ix, iy);
    iy += ilh;
    ctx.fillText(`UC: ${projectData.client.utilityId} | Concessionária: ${projectData.technical.utility}`, ix, iy);
    iy += ilh;
    ctx.fillText(`Pot. CC: ${engResult.totalDcPower.toFixed(2)} kWp | Pot. CA: ${engResult.totalAcPower.toFixed(2)} kW`, ix, iy);
    iy += ilh;
    ctx.fillText(`Disj. Geral: ${engResult.totalSuggestedBreaker}A ${engResult.totalBreakerPolarity}`, ix, iy);
    iy += ilh;
    const blockDescriptions = projectData.equipmentBlocks.map((b, i) => `B${i + 1}: ${b.inverterQty}x ${b.inverterBrand} ${b.inverterModel} + ${b.moduleQty}x ${b.moduleBrand}`).join(' | ');
    ctx.font = '1.8px Arial';
    ctx.fillText(blockDescriptions.substring(0, 100), ix, iy);

    const rx = x + logoW + infoW + selopad;
    let ry = y + selopad + 2;
    const rlh = 3.2;
    ctx.font = 'bold 2.2px Arial';
    ctx.fillText('RESPONSÁVEL TÉCNICO', rx, ry);
    ry += rlh;
    ctx.font = '2.2px Arial';
    ctx.fillText(`Eng. ${projectData.engineer?.name || 'N/A'}`, rx, ry);
    ry += rlh;
    ctx.fillText(`CREA: ${projectData.engineer?.crea || 'N/A'}`, rx, ry);
    ry += rlh;
    ctx.fillText(`ART: ${projectData.client?.art || 'N/A'}`, rx, ry);
    ry += rlh * 1.5;
    ctx.fillText(`Data: ${new Date().toLocaleDateString('pt-BR')}`, rx, ry);
    ry += rlh;
    ctx.fillText('Escala: Sem Escala (Dim. em mm)', rx, ry);
    ry += rlh;
    ctx.font = '1.8px Arial';
    ctx.fillText('Folha: A4 Paisagem (297x210mm)', rx, ry);

    ctx.restore();
  };

  useEffect(() => {
    drawDiagram();
  }, [projectData]);

  const handleDownloadPDF = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [PAGE_W, PAGE_H],
      compress: true,
    });
    pdf.setProperties({
      title: `Diagrama Unifilar - ${projectData.client.name || 'Projeto'}`,
      subject: `Microgeração FV - UC ${projectData.client.utilityId || ''}`,
      author: projectData.engineer?.name || 'SolarCAD',
      creator: 'SolarCAD - Suite GD',
    });
    const imgData = canvas.toDataURL('image/png', 1.0);
    // 'SLOW' = max-quality compression, preserves thin lines
    pdf.addImage(imgData, 'PNG', 0, 0, PAGE_W, PAGE_H, undefined, 'SLOW');
    pdf.save(`Diagrama_${projectData.client.name.replace(/\s+/g, '_') || 'projeto'}.pdf`);
  };

  const [zoom, setZoom] = useState<number>(1.0);

  const handleDownloadDXF = () => {
    const dxfContent = generateSolarUnifilarDxf(projectData);
    const filename = `Diagrama_${projectData.client.name.replace(/\s+/g, '_') || 'projeto'}.dxf`;
    downloadDxfFile(filename, dxfContent);
  };

  const handleDownloadPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `Diagrama_${projectData.client.name.replace(/\s+/g, '_') || 'projeto'}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  };

  return (
    <div className="flex flex-col items-center w-full">
      <div className="w-full flex flex-wrap justify-between items-center gap-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Diagrama Unifilar Interativo</span>
          <InfoTrigger helpKey="diagram" />
        </div>

        {/* Controles de Zoom & Ações de Exportação */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-background border border-border rounded-lg p-0.5 shadow-sm">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setZoom(z => Math.max(0.5, Math.round((z - 0.15) * 100) / 100))}
              title="Diminuir Zoom"
            >
              <ZoomOut size={14} />
            </Button>
            <span className="text-xs font-mono px-2 text-muted-foreground">{Math.round(zoom * 100)}%</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setZoom(z => Math.min(2.5, Math.round((z + 0.15) * 100) / 100))}
              title="Aumentar Zoom"
            >
              <ZoomIn size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground"
              onClick={() => setZoom(1.0)}
              title="Resetar Zoom"
            >
              <RotateCcw size={12} />
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={handleDownloadDXF} className="gap-1.5 border-emerald-600/40 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40" title="Exportar para AutoCAD (DXF R12/R2000)">
            <FileText size={15} /> Exportar DXF
          </Button>

          <Button variant="outline" size="sm" onClick={handleDownloadPNG} className="gap-1.5">
            <Image size={15} /> Baixar PNG
          </Button>

          <Button size="sm" onClick={handleDownloadPDF} className="gap-1.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground">
            <Download size={15} /> Baixar PDF
          </Button>
        </div>
      </div>

      <div className="w-full overflow-auto bg-muted p-4 rounded-lg border border-border flex justify-center min-h-[420px]">
        <div 
          className="transition-transform duration-150 origin-top flex justify-center items-center"
          style={{ transform: `scale(${zoom})` }}
        >
          <canvas
            ref={canvasRef}
            className="bg-white shadow-xl max-w-full h-auto rounded"
            style={{ maxHeight: '600px', imageRendering: 'crisp-edges' }}
          />
        </div>
      </div>
    </div>
  );
};

