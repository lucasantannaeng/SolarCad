/**
 * Módulo de Renderização de Comunicação, Telemetria & Modbus RTU
 * SolarCAD - Diagramação Elétrica Avançada
 *
 * Padrões e Referências Técnicas:
 * - Modbus-IDA: Modbus over Serial Line Specification & Implementation Guide v1.02
 * - TIA/EIA-485-A: Electrical Characteristics of Generators and Receivers for use in Balanced Digital Multipoint Systems
 * - ABNT NBR 16690: Instalações elétricas de arranjos fotovoltaicos (Requisitos de monitoramento)
 * - IEC 60870-5: Telecontrol equipment and systems
 */

import { ProjectState, EquipmentBlock, ConnectionType } from '@/types';
import { DiagramDimensions } from './diagramLayoutV2';
import { NBR_COLORS } from './multifilarRenderer';

export interface CommunicationOptions {
  dims: DiagramDimensions;
  projectData: ProjectState;
  format: 'A4' | 'A3';
  DPI: number;
}

export const COMM_COLORS = {
  ...NBR_COLORS,
  RS485_BUS: '#7E22CE',       // Barramento RS-485 - Roxo / Púrpura técnico
  RS485_A: '#9333EA',         // RS-485 A (+) - Roxo
  RS485_B: '#6B21A8',         // RS-485 B (-) - Roxo Escuro
  RS485_SHIELD: '#64748B',    // Blindagem / Shield - Slate
  RS485_SHD: '#64748B',       // Blindagem / Shield aterrado
  CT_SIGNAL: '#D97706',       // Sinal Secundário TCs (S1/S2) - Âmbar
  WIFI_WAVE: '#0284C7',       // Ondas Wi-Fi 2.4GHz - Azul Céu
  CLOUD_ACCENT: '#2563EB',    // Nuvem / Servidor - Azul Royal
  APP_ACCENT: '#10B981',      // Destaque Solar no App - Verde Esmeralda
  APP_SCREEN: '#0F172A',      // Tela do Smartphone / App - Slate 900
  ROUTER_BODY: '#1E293B',     // Corpo do Roteador - Slate 800
  BOX_HEADER: '#0F172A',      // Cabeçalho de Caixas Técnicas - Slate 900
  BOX_BG: '#FFFFFF',          // Fundo de Caixas Técnicas - Branco puro
  BOX_BORDER: '#0F172A',      // Borda de Caixas Técnicas - Preto / Slate escuro
  BORDER_SEC: '#64748B',      // Borda Secundária - Cinza Slate
  BOX_MUTED: '#F8FAFC',       // Fundo Secundário - Slate 50
} as const;

/**
 * Desenha um Inversor com Porta de Comunicação COM / RS-485 e Datalogger Wi-Fi
 */
export function drawCommunicationInverter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  tag: string,
  brand: string,
  model: string,
  powerKw: number,
  modbusId: number,
  hasDatalogger: boolean = true
) {
  ctx.save();

  // Corpo Principal do Inversor
  ctx.fillStyle = COMM_COLORS.BOX_BG;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = COMM_COLORS.BOX_BORDER;
  ctx.lineWidth = 0.45;
  ctx.strokeRect(x, y, w, h);

  // Faixa de Cabeçalho
  ctx.fillStyle = COMM_COLORS.BOX_HEADER;
  ctx.fillRect(x, y, w, 4.2);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 2.0px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(tag, x + w / 2, y + 3.0);

  // Informações do Inversor
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 1.7px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`${brand} ${model}`, x + w / 2, y + 7.5);
  ctx.font = '1.5px Arial';
  ctx.fillStyle = '#475569';
  ctx.fillText(`Potência Nominal: ${powerKw.toFixed(1)} kW`, x + w / 2, y + 10.5);

  // Porta COM / RS-485 Integrada no Inversor
  const comW = w - 6;
  const comH = 9.5;
  const comX = x + 3;
  const comY = y + 13.0;

  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(comX, comY, comW, comH);
  ctx.strokeStyle = COMM_COLORS.RS485_A;
  ctx.lineWidth = 0.35;
  ctx.strokeRect(comX, comY, comW, comH);

  ctx.fillStyle = COMM_COLORS.RS485_A;
  ctx.font = 'bold 1.6px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`PORTA COM (MODBUS ID: ${String(modbusId).padStart(2, '0')})`, comX + comW / 2, comY + 2.5);

  // Bornes RS-485 (A+, B-, GND/Shield)
  const pinY = comY + 5.5;
  const pinSpacing = comW / 3;

  // Pin A (+)
  const pinAX = comX + pinSpacing * 0.5;
  ctx.fillStyle = COMM_COLORS.RS485_A;
  ctx.beginPath(); ctx.arc(pinAX, pinY, 0.9, 0, 2 * Math.PI); ctx.fill();
  ctx.font = 'bold 1.3px Arial';
  ctx.fillText('A (+)', pinAX, pinY + 3.0);

  // Pin B (-)
  const pinBX = comX + pinSpacing * 1.5;
  ctx.fillStyle = COMM_COLORS.RS485_B;
  ctx.beginPath(); ctx.arc(pinBX, pinY, 0.9, 0, 2 * Math.PI); ctx.fill();
  ctx.fillText('B (-)', pinBX, pinY + 3.0);

  // Pin GND / Shield
  const pinGndX = comX + pinSpacing * 2.5;
  ctx.fillStyle = COMM_COLORS.RS485_SHIELD;
  ctx.beginPath(); ctx.arc(pinGndX, pinY, 0.9, 0, 2 * Math.PI); ctx.fill();
  ctx.fillText('PE/SHD', pinGndX, pinY + 3.0);

  // Datalogger Wi-Fi / DTU Acoplado
  if (hasDatalogger) {
    const dtuW = 14;
    const dtuH = 14;
    const dtuX = x + w + 3;
    const dtuY = y + 4;

    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x + w, y + 10);
    ctx.lineTo(dtuX, y + 10);
    ctx.stroke();

    ctx.fillStyle = '#1E293B';
    ctx.fillRect(dtuX, dtuY, dtuW, dtuH);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 0.35;
    ctx.strokeRect(dtuX, dtuY, dtuW, dtuH);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 1.4px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('DTU / Wi-Fi', dtuX + dtuW / 2, dtuY + 3.2);

    const ledY = dtuY + 6.0;
    ctx.fillStyle = '#22C55E';
    ctx.beginPath(); ctx.arc(dtuX + 3.0, ledY, 0.6, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = '#38BDF8';
    ctx.beginPath(); ctx.arc(dtuX + 7.0, ledY, 0.6, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = '#22C55E';
    ctx.beginPath(); ctx.arc(dtuX + 11.0, ledY, 0.6, 0, 2 * Math.PI); ctx.fill();

    ctx.font = '1.1px Arial';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('PWR NET INV', dtuX + dtuW / 2, dtuY + 8.8);
  }

  ctx.restore();
}

/**
 * Desenha o Roteador Wi-Fi Local (Access Point / WLAN)
 */
export function drawWifiRouter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number = 30,
  h: number = 18
) {
  ctx.save();
  ctx.fillStyle = COMM_COLORS.BOX_BG;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 0.45;
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = '#1E293B';
  ctx.fillRect(x, y, w, 3.5);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 1.6px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('ROTEADOR WI-FI LOCAL', x + w / 2, y + 2.5);

  ctx.fillStyle = '#0F172A';
  ctx.font = '1.5px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('• WLAN 2.4 GHz / 5 GHz', x + 2, y + 6.8);
  ctx.fillText('• IP: 192.168.1.1 (Gateway)', x + 2, y + 9.8);
  ctx.fillText('• Link Internet WAN / Fibra', x + 2, y + 12.8);
  ctx.restore();
}

/**
 * Desenha a Nuvem de Monitoramento SolarCAD Cloud Platform
 */
export function drawCloudPlatform(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number = 40,
  h: number = 25
) {
  ctx.save();
  const cx = x + w / 2;
  const cy = y + h / 2 - 1;

  ctx.fillStyle = '#EFF6FF';
  ctx.strokeStyle = COMM_COLORS.CLOUD_ACCENT;
  ctx.lineWidth = 0.5;

  ctx.beginPath();
  ctx.arc(cx - 8, cy + 1, 6.0, 0, 2 * Math.PI);
  ctx.arc(cx, cy - 3, 7.5, 0, 2 * Math.PI);
  ctx.arc(cx + 8, cy + 1, 6.0, 0, 2 * Math.PI);
  ctx.fillRect(cx - 12, cy + 1, 24, 6.5);
  ctx.fill();

  ctx.fillStyle = COMM_COLORS.CLOUD_ACCENT;
  ctx.font = 'bold 1.8px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('SOLARCAD CLOUD', cx, cy + 1.0);
  ctx.font = '1.4px Arial';
  ctx.fillStyle = '#1E40AF';
  ctx.fillText('Servidor de Telemetria 24/7', cx, cy + 4.2);
  ctx.fillText('MQTT / HTTPS TLS 1.3', cx, cy + 6.8);
  ctx.restore();
}

/**
 * Desenha o Dashboard do App Mobile / Web de Monitoramento Solar
 */
export function drawMonitoringAppDashboard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number = 26,
  h: number = 32
) {
  ctx.save();
  ctx.fillStyle = COMM_COLORS.APP_SCREEN;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = '#1E293B';
  ctx.fillRect(x, y, w, 3.5);
  ctx.fillStyle = '#94A3B8';
  ctx.font = 'bold 1.2px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('SolarCAD Mobile App', x + w / 2, y + 2.5);

  ctx.fillStyle = '#10B981';
  ctx.beginPath(); ctx.arc(x + 3.5, y + 6.0, 0.8, 0, 2 * Math.PI); ctx.fill();
  ctx.font = 'bold 1.3px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('SISTEMA ONLINE', x + 5.5, y + 6.5);

  ctx.fillStyle = '#1E293B';
  ctx.fillRect(x + 2, y + 8.5, w - 4, 8.0);
  ctx.fillStyle = '#F59E0B';
  ctx.font = 'bold 1.3px Arial';
  ctx.fillText('GERAÇÃO FV AGORA', x + 4, y + 11.2);
  ctx.font = 'bold 2.4px Arial';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('18.45 kW', x + 4, y + 15.0);
  ctx.restore();
}

/**
 * Desenha Smart Meter Bidirecional com display LCD e bornes de corrente / RS-485
 */
export function drawCommunicationSmartMeter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  modbusId: number = 2
) {
  ctx.save();
  ctx.fillStyle = COMM_COLORS.BOX_BG;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = COMM_COLORS.BOX_BORDER;
  ctx.lineWidth = 0.45;
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = '#1E293B';
  ctx.fillRect(x, y, w, 4.2);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 1.7px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`SMART METER BIDIRECIONAL (ID: ${String(modbusId).padStart(2, '0')})`, x + w / 2, y + 2.8);

  // Display LCD
  ctx.fillStyle = '#064E3B';
  ctx.fillRect(x + 2, y + 6, w - 4, 6.5);
  ctx.fillStyle = '#34D399';
  ctx.font = 'bold 1.3px Courier New, monospace';
  ctx.fillText('P:+08.45kW  Q:0.0kvar', x + w / 2, y + 10.2);

  ctx.fillStyle = '#0F172A';
  ctx.font = '1.3px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('• Controle de Injeção Zero (Zero Export)', x + 2.5, y + 15.5);
  ctx.fillText('• Medição Bidirecional 4 Quadrantes', x + 2.5, y + 18.5);

  ctx.restore();
}

/**
 * Desenha Transformador de Corrente (TC) Toroidal Bipartido
 */
export function drawTelemetryCurrentTransformer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  ratio: string = '100/5A'
) {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = COMM_COLORS.CT_SIGNAL;
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  ctx.ellipse(x, y, 2.2, 4.0, 0, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = COMM_COLORS.CT_SIGNAL;
  ctx.fillRect(x - 0.6, y - 4.0, 1.2, 8.0);

  ctx.font = 'bold 1.6px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y - 5.5);
  ctx.font = '1.2px Arial';
  ctx.fillText(ratio, x, y - 4.0);
  ctx.restore();
}

/**
 * Desenha a Tabela de Parâmetros de Comunicação e Modbus RTU no Rodapé (Schedule BOM)
 */
export function drawCommunicationScheduleTable(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  numInvertersOrProjectData: number | ProjectState = 1
) {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 0.40;
  ctx.strokeRect(x, y, w, h);

  const headerH = 5.5;
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(x, y, w, headerH);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 2.1px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('ESPECIFICAÇÕES DE TELEMETRIA, COMUNICAÇÃO & MODBUS RTU', x + 3, y + 3.0);

  const isTwoCol = w > 160;
  const col1W = isTwoCol ? Math.round(w * 0.52) : w;
  const col2X = isTwoCol ? x + col1W : x;

  if (isTwoCol) {
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 0.25;
    ctx.beginPath();
    ctx.moveTo(col2X, y + headerH);
    ctx.lineTo(col2X, y + h);
    ctx.stroke();
  }

  ctx.fillStyle = '#0F172A';
  ctx.font = '1.5px Arial';
  const rowGap = 2.5;

  const numInvs = typeof numInvertersOrProjectData === 'number'
    ? numInvertersOrProjectData
    : numInvertersOrProjectData.equipmentBlocks.reduce((acc, b) => acc + (b.inverterQty || 1), 0);

  const col1Lines: string[] = [
    '• Protocolo Serial: Modbus RTU sobre RS-485 (Half-Duplex 2 fios + Malha Blindada)',
    '• Parâmetros de Comunicação: Taxa 9600 bps | 8 Bits de Dados | Sem Paridade | 1 Stop Bit (9600-8-N-1)',
    `• Endereçamento Modbus: Inversores (IDs: 01 a ${String(numInvs).padStart(2, '0')}) | Smart Meter (ID: ${String(numInvs + 1).padStart(2, '0')})`,
    '• Meio Físico: Cabo STP 1 Par Trançado Blindado 2x24 AWG (120 Ω) | Resistor de Terminação 120 Ω nas pontas',
  ];

  const col2Lines: string[] = [
    '• Sensores de Corrente (TCs): Núcleo Bipartido Classe 0.5s instalado nas fases do Padrão de Entrada',
    '• Enlace Wireless: Wi-Fi IEEE 802.11 b/g/n (2.4 GHz) | Segurança WPA2-PSK / AES',
    '• Enlace Cloud: Conexão Criptografada TLS 1.3 / MQTT com SolarCAD Cloud Server 24/7',
  ];

  if (isTwoCol) {
    let y1 = y + headerH + 2.5;
    col1Lines.forEach(line => {
      ctx.fillText(line, x + 3, y1);
      y1 += rowGap;
    });

    let y2 = y + headerH + 2.5;
    col2Lines.forEach(line => {
      ctx.fillText(line, col2X + 3, y2);
      y2 += rowGap;
    });
  } else {
    let yAll = y + headerH + 2.5;
    [...col1Lines.slice(0, 2), ...col2Lines.slice(0, 2)].forEach(line => {
      ctx.fillText(line, x + 3, yAll);
      yAll += rowGap;
    });
  }

  ctx.restore();
}

/**
 * Função Principal de Renderização do Diagrama de Comunicação & TC / Modbus (Modo 3)
 */
export function renderCommunicationDiagram(
  ctx: CanvasRenderingContext2D,
  options: CommunicationOptions
) {
  const { dims, projectData } = options;

  const blocks = projectData.equipmentBlocks;
  const physicalInverters: { block: EquipmentBlock; bIdx: number; invIdx: number }[] = [];
  blocks.forEach((block, bIdx) => {
    const qty = block.inverterQty || 1;
    for (let i = 0; i < qty; i++) {
      physicalInverters.push({ block, bIdx, invIdx: i });
    }
  });

  const numInvs = physicalInverters.length;
  const zoneW = dims.drawW;

  // ── 1. ZONEAMENTO VERTICAL DO ESQUEMÁTICO ──
  const invTopY = 8;
  const invH = 24;
  const invW = Math.min(34, Math.max(26, (zoneW - 50) / Math.max(numInvs, 1) - 10));
  const colSpacing = (zoneW - 30) / Math.max(numInvs, 1);

  const busY = 48; // Barramento RS-485 horizontal
  const lowerZoneY = 62; // Zona inferior de Smart Meter, TCs e Gateway

  const rs485Drops: { x: number; id: number }[] = [];

  // ── 2. DESENHO DOS INVERSORES COM RÉGUA DE BORNES MODBUS ──
  physicalInverters.forEach((phys, pIdx) => {
    const { block, bIdx, invIdx } = phys;
    const invX = 14 + pIdx * colSpacing;
    const isMicro = block.inverter?.inverterType === 'micro';
    const tagInv = isMicro ? `MICRO-${bIdx + 1}` : `INV-${bIdx + 1}${numInvs > 1 ? `.#${invIdx + 1}` : ''}`;
    const brand = (block.inverterBrand || block.inverter?.brand || 'Solar').toUpperCase();
    const model = (block.inverterModel || block.inverter?.model || '').toUpperCase();
    const pwr = (block.inverterPowerKw || block.inverter?.power || 0).toFixed(1);
    const modbusId = pIdx + 1;

    ctx.save();
    ctx.fillStyle = COMM_COLORS.BOX_BG;
    ctx.fillRect(invX, invTopY, invW, invH);
    ctx.strokeStyle = COMM_COLORS.BOX_BORDER;
    ctx.lineWidth = 0.40;
    ctx.strokeRect(invX, invTopY, invW, invH);

    ctx.fillStyle = COMM_COLORS.BOX_HEADER;
    ctx.fillRect(invX, invTopY, invW, 4.0);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 1.8px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(tagInv, invX + invW / 2, invTopY + 2.8);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 1.6px Arial';
    ctx.fillText(`${brand} ${model}`, invX + invW / 2, invTopY + 7.5);
    ctx.font = '1.4px Arial';
    ctx.fillStyle = '#475569';
    ctx.fillText(`Potência Nominal: ${pwr} kW`, invX + invW / 2, invTopY + 10.5);

    // Régua de Bornes RS-485 na Base do Inversor
    const termBoxW = invW - 4;
    const termBoxH = 8.5;
    const termBoxX = invX + 2;
    const termBoxY = invTopY + 13.5;

    ctx.fillStyle = COMM_COLORS.BOX_MUTED;
    ctx.fillRect(termBoxX, termBoxY, termBoxW, termBoxH);
    ctx.strokeStyle = COMM_COLORS.RS485_BUS;
    ctx.lineWidth = 0.30;
    ctx.strokeRect(termBoxX, termBoxY, termBoxW, termBoxH);

    ctx.fillStyle = COMM_COLORS.RS485_BUS;
    ctx.font = 'bold 1.5px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`PORTA COM (ID: ${String(modbusId).padStart(2, '0')})`, termBoxX + termBoxW / 2, termBoxY + 2.4);

    const pinY = termBoxY + 5.2;
    const step = termBoxW / 3;

    // Pino A (+)
    const pinA = termBoxX + step * 0.5;
    ctx.fillStyle = COMM_COLORS.RS485_A;
    ctx.beginPath(); ctx.arc(pinA, pinY, 0.7, 0, 2 * Math.PI); ctx.fill();
    ctx.font = 'bold 1.2px Arial';
    ctx.fillText('A (+)', pinA, pinY + 2.5);

    // Pino B (-)
    const pinB = termBoxX + step * 1.5;
    ctx.fillStyle = COMM_COLORS.RS485_B;
    ctx.beginPath(); ctx.arc(pinB, pinY, 0.7, 0, 2 * Math.PI); ctx.fill();
    ctx.fillText('B (-)', pinB, pinY + 2.5);

    // Pino Shield / Terra
    const pinShd = termBoxX + step * 2.5;
    ctx.fillStyle = COMM_COLORS.RS485_SHD;
    ctx.beginPath(); ctx.arc(pinShd, pinY, 0.7, 0, 2 * Math.PI); ctx.fill();
    ctx.fillText('SHD', pinShd, pinY + 2.5);

    ctx.restore();

    const dropX = invX + invW / 2;
    rs485Drops.push({ x: dropX, id: modbusId });
  });

  // ── 3. BARRAMENTO SERIAL RS-485 MODBUS RTU (DAISY-CHAIN) ──
  const busStartX = 14;
  const busEndX = Math.max(...rs485Drops.map(d => d.x), 180) + 12;

  ctx.save();
  ctx.strokeStyle = COMM_COLORS.RS485_BUS;
  ctx.lineWidth = 0.55;

  ctx.beginPath();
  ctx.moveTo(busStartX, busY);
  ctx.lineTo(busEndX, busY);
  ctx.stroke();

  // Resistor de Terminação 120 Ω (Esquerda)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(busStartX - 4, busY - 1.8, 4, 3.6);
  ctx.strokeStyle = COMM_COLORS.RS485_BUS;
  ctx.lineWidth = 0.35;
  ctx.strokeRect(busStartX - 4, busY - 1.8, 4, 3.6);
  ctx.fillStyle = COMM_COLORS.RS485_BUS;
  ctx.font = 'bold 1.2px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('120Ω', busStartX - 2, busY + 0.6);
  ctx.font = '1.1px Arial';
  ctx.fillText('Terminação', busStartX - 2, busY + 3.8);

  // Resistor de Terminação 120 Ω (Direita)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(busEndX, busY - 1.8, 4, 3.6);
  ctx.strokeRect(busEndX, busY - 1.8, 4, 3.6);
  ctx.fillStyle = COMM_COLORS.RS485_BUS;
  ctx.font = 'bold 1.2px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('120Ω', busEndX + 2, busY + 0.6);
  ctx.font = '1.1px Arial';
  ctx.fillText('Terminação', busEndX + 2, busY + 3.8);

  // Derivações dos Inversores
  rs485Drops.forEach(drop => {
    ctx.strokeStyle = COMM_COLORS.RS485_BUS;
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(drop.x, invTopY + invH);
    ctx.lineTo(drop.x, busY);
    ctx.stroke();

    ctx.fillStyle = COMM_COLORS.RS485_BUS;
    ctx.beginPath();
    ctx.arc(drop.x, busY, 0.9, 0, 2 * Math.PI);
    ctx.fill();
  });

  ctx.fillStyle = COMM_COLORS.RS485_BUS;
  ctx.font = 'bold 1.7px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('BARRAMENTO RS-485 MODBUS RTU (Par Trançado Blindado 2x24 AWG + 120Ω)', busStartX + 10, busY - 2.0);
  ctx.restore();

  // ── 4. ZONA INFERIOR ESQUERDA: SMART METER BIDIRECIONAL ──
  const meterW = 54;
  const meterH = 34;
  const meterX = 14;
  const meterY = lowerZoneY + 4;
  const smartMeterId = numInvs + 1;

  ctx.save();
  ctx.fillStyle = COMM_COLORS.BOX_BG;
  ctx.fillRect(meterX, meterY, meterW, meterH);
  ctx.strokeStyle = COMM_COLORS.BOX_BORDER;
  ctx.lineWidth = 0.45;
  ctx.strokeRect(meterX, meterY, meterW, meterH);

  ctx.fillStyle = '#1E293B';
  ctx.fillRect(meterX, meterY, meterW, 4.2);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 1.7px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`SMART METER BIDIRECIONAL (ID MODBUS: ${String(smartMeterId).padStart(2, '0')})`, meterX + meterW / 2, meterY + 2.8);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 1.5px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('• Analisador Multimedidor 4 Quadrantes', meterX + 2.5, meterY + 7.5);
  ctx.fillText('• Controle Dinâmico de Anti-Injeção Zero', meterX + 2.5, meterY + 10.5);
  ctx.font = '1.3px Arial';
  ctx.fillStyle = '#475569';
  ctx.fillText('• Grandezas: P(kW), Q(kvar), V(V), I(A), FP, Freq(Hz)', meterX + 2.5, meterY + 13.5);

  const ctTermW = meterW - 5;
  const ctTermH = 7.5;
  const ctTermX = meterX + 2.5;
  const ctTermY = meterY + 16.0;

  ctx.fillStyle = '#FFFBEB';
  ctx.fillRect(ctTermX, ctTermY, ctTermW, ctTermH);
  ctx.strokeStyle = COMM_COLORS.CT_SIGNAL;
  ctx.lineWidth = 0.30;
  ctx.strokeRect(ctTermX, ctTermY, ctTermW, ctTermH);

  ctx.fillStyle = COMM_COLORS.CT_SIGNAL;
  ctx.font = 'bold 1.3px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('ENTRADAS DE MEDIÇÃO DE CORRENTE (TCs 100/5A)', ctTermX + ctTermW / 2, ctTermY + 2.5);
  ctx.font = '1.2px Arial';
  ctx.fillText('Terminais: IA1/IA2 | IB1/IB2 | IC1/IC2 (Sinal S1/S2)', ctTermX + ctTermW / 2, ctTermY + 5.5);

  const rsTermW = meterW - 5;
  const rsTermH = 6.5;
  const rsTermX = meterX + 2.5;
  const rsTermY = meterY + 25.0;

  ctx.fillStyle = '#FAF5FF';
  ctx.fillRect(rsTermX, rsTermY, rsTermW, rsTermH);
  ctx.strokeStyle = COMM_COLORS.RS485_BUS;
  ctx.lineWidth = 0.30;
  ctx.strokeRect(rsTermX, rsTermY, rsTermW, rsTermH);

  ctx.fillStyle = COMM_COLORS.RS485_BUS;
  ctx.font = 'bold 1.3px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('PORTA SERIAL RS-485 (MODBUS ESCRAPO)', rsTermX + rsTermW / 2, rsTermY + 2.4);
  ctx.font = '1.2px Arial';
  ctx.fillText('Bornes: Pino 24 (A+) | Pino 25 (B-) | Pino 26 (SHD)', rsTermX + rsTermW / 2, rsTermY + 5.0);

  ctx.restore();

  // Conexão do Smart Meter para o Barramento RS-485
  ctx.save();
  ctx.strokeStyle = COMM_COLORS.RS485_BUS;
  ctx.lineWidth = 0.50;
  ctx.beginPath();
  ctx.moveTo(meterX + meterW / 2, meterY);
  ctx.lineTo(meterX + meterW / 2, busY);
  ctx.stroke();

  ctx.fillStyle = COMM_COLORS.RS485_BUS;
  ctx.beginPath();
  ctx.arc(meterX + meterW / 2, busY, 0.9, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();

  // ── 5. ZONA CENTRAL: DATALOGGER & GATEWAY DE SUPERVISÃO ──
  const gwW = 44;
  const gwH = 28;
  const gwX = meterX + meterW + 16;
  const gwY = lowerZoneY + 7;

  ctx.save();
  ctx.fillStyle = COMM_COLORS.BOX_BG;
  ctx.fillRect(gwX, gwY, gwW, gwH);
  ctx.strokeStyle = COMM_COLORS.BORDER_SEC;
  ctx.lineWidth = 0.40;
  ctx.strokeRect(gwX, gwY, gwW, gwH);

  ctx.fillStyle = '#0369A1';
  ctx.fillRect(gwX, gwY, gwW, 4.2);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 1.7px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('DATALOGGER / SMART GATEWAY', gwX + gwW / 2, gwY + 2.8);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 1.5px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('• Concentrador Serial RS-485', gwX + 2.5, gwY + 8.0);
  ctx.fillText('• Enlace Ethernet RJ-45 & Wi-Fi', gwX + 2.5, gwY + 11.2);
  ctx.font = '1.3px Arial';
  ctx.fillStyle = '#475569';
  ctx.fillText('• Protocolo TCP/IP - MQTT / TLS 1.3', gwX + 2.5, gwY + 14.5);
  ctx.fillText('• Buffer de Memória Offline (24h)', gwX + 2.5, gwY + 17.5);
  ctx.fillText('• IP Estático: 192.168.1.50 (VLAN FV)', gwX + 2.5, gwY + 20.5);

  ctx.fillStyle = '#F0F9FF';
  ctx.fillRect(gwX + 2, gwY + 22.5, gwW - 4, 4.0);
  ctx.strokeStyle = '#0284C7';
  ctx.lineWidth = 0.25;
  ctx.strokeRect(gwX + 2, gwY + 22.5, gwW - 4, 4.0);
  ctx.fillStyle = '#0369A1';
  ctx.font = 'bold 1.2px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('ENLACE PARA NUVEM / PORTAL DE MONITORAMENTO', gwX + gwW / 2, gwY + 25.2);
  ctx.restore();

  // Conexão do Gateway para o Barramento RS-485
  ctx.save();
  ctx.strokeStyle = COMM_COLORS.RS485_BUS;
  ctx.lineWidth = 0.50;
  ctx.beginPath();
  ctx.moveTo(gwX + gwW / 2, gwY);
  ctx.lineTo(gwX + gwW / 2, busY);
  ctx.stroke();

  ctx.fillStyle = COMM_COLORS.RS485_BUS;
  ctx.beginPath();
  ctx.arc(gwX + gwW / 2, busY, 0.9, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();

  // ── 6. ZONA DIREITA: PADRÃO DE ENTRADA & SENSORES DE CORRENTE (TCs) ──
  const gridZoneX = gwX + gwW + 16;
  const gridZoneW = zoneW - gridZoneX - 4;
  const gridZoneY = lowerZoneY + 2;
  const gridZoneH = 38;

  ctx.save();
  ctx.setLineDash([1.5, 1.5]);
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 0.35;
  ctx.strokeRect(gridZoneX, gridZoneY, gridZoneW, gridZoneH);
  ctx.setLineDash([]);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 1.8px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('PADRÃO DE ENTRADA & MEDIÇÃO DE TELEMETRIA', gridZoneX + 3, gridZoneY + 3.6);

  ctx.fillStyle = '#475569';
  ctx.font = '1.3px Arial';
  ctx.fillText('Sentido Fluxo: Concessionária ➔ Cargas Locais', gridZoneX + 3, gridZoneY + 6.8);

  const isTri = projectData.technical.connectionType === ConnectionType.TRIPHASIC;
  const isBi = projectData.technical.connectionType === ConnectionType.BIPHASIC;

  const phaseConductors = isTri
    ? [
        { id: 'R', label: 'Fase R (L1)', color: NBR_COLORS.PHASE_R },
        { id: 'S', label: 'Fase S (L2)', color: NBR_COLORS.PHASE_S },
        { id: 'T', label: 'Fase T (L3)', color: NBR_COLORS.PHASE_T },
      ]
    : isBi
    ? [
        { id: 'R', label: 'Fase R (L1)', color: NBR_COLORS.PHASE_R },
        { id: 'S', label: 'Fase S (L2)', color: NBR_COLORS.PHASE_S },
      ]
    : [
        { id: 'R', label: 'Fase R (L1)', color: NBR_COLORS.PHASE_R },
      ];

  const phaseSpacing = 6.2;
  const phaseStartY = gridZoneY + 12.0;

  phaseConductors.forEach((phase, idx) => {
    const py = phaseStartY + idx * phaseSpacing;

    ctx.save();
    ctx.strokeStyle = phase.color;
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    ctx.moveTo(gridZoneX + 4, py);
    ctx.lineTo(gridZoneX + gridZoneW - 20, py);
    ctx.stroke();

    ctx.fillStyle = phase.color;
    ctx.font = 'bold 1.5px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(phase.label, gridZoneX + gridZoneW - 18, py + 0.6);

    const tcX = gridZoneX + 18 + idx * 16;

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = COMM_COLORS.CT_SIGNAL;
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.ellipse(tcX, py, 2.0, 3.8, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = COMM_COLORS.CT_SIGNAL;
    ctx.fillRect(tcX - 0.5, py - 3.8, 1.0, 7.6);

    ctx.font = 'bold 1.5px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`TC-${phase.id}`, tcX, py - 4.5);
    ctx.font = '1.2px Arial';
    ctx.fillText('100/5A', tcX, py - 2.5);

    ctx.strokeStyle = COMM_COLORS.CT_SIGNAL;
    ctx.lineWidth = 0.40;
    ctx.setLineDash([0.8, 0.8]);
    ctx.beginPath();
    ctx.moveTo(tcX, py + 3.8);
    ctx.lineTo(tcX, gridZoneY + gridZoneH - 4);
    ctx.lineTo(meterX + meterW, gridZoneY + gridZoneH - 4);
    ctx.stroke();

    ctx.fillStyle = COMM_COLORS.CT_SIGNAL;
    ctx.beginPath(); ctx.arc(tcX, py + 3.8, 0.6, 0, 2 * Math.PI); ctx.fill();

    ctx.restore();
  });

  ctx.fillStyle = COMM_COLORS.CT_SIGNAL;
  ctx.font = 'bold 1.4px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('Sinal Secundário TCs (Pares Trançados S1 / S2 - 2x1.5mm²)', gridZoneX + 4, gridZoneY + gridZoneH - 6.0);
  ctx.restore();
}
