/**
 * Gerador e Exportador de Arquivos DXF (AutoCAD R12 / R2000) para Projetos Fotovoltaicos
 * Compatível com software CAD de concessionárias de energia (Enel, CPFL, Cemig, Equatorial).
 */

import { ProjectState } from '../types';
import { getProjectEngineeringStatus } from './engineering';

export interface DxfEntity {
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

export function generateSolarUnifilarDxf(projectData: ProjectState): string {
  const eng = getProjectEngineeringStatus(projectData.equipmentBlocks, projectData.technical);
  const entities: DxfEntity[] = [];

  // 1. Moldura A4 (297 x 210 mm)
  entities.push({ type: 'RECT', layer: 'FRAME', x1: 20, y1: 10, x2: 287, y2: 200 });

  // 2. Selo Técnico
  entities.push({ type: 'RECT', layer: 'TITLE_BLOCK', x1: 120, y1: 10, x2: 287, y2: 45 });
  entities.push({ type: 'TEXT', layer: 'TEXT', x1: 125, y1: 38, text: `CLIENTE: ${projectData.client.name.toUpperCase()}`, size: 3.0 });
  entities.push({ type: 'TEXT', layer: 'TEXT', x1: 125, y1: 30, text: `LOCAL: ${projectData.client.city} - ${projectData.client.state}`, size: 2.5 });
  entities.push({ type: 'TEXT', layer: 'TEXT', x1: 125, y1: 22, text: `POT. CC: ${eng.totalDcPower.toFixed(2)} kWp | POT. CA: ${eng.totalAcPower.toFixed(2)} kW`, size: 2.5 });
  entities.push({ type: 'TEXT', layer: 'TEXT', x1: 125, y1: 14, text: `DISJUNTOR SUGERIDO: ${eng.totalSuggestedBreaker}A (${eng.totalBreakerPolarity})`, size: 2.5 });

  // 3. Rede e Ponto de Conexão
  entities.push({ type: 'LINE', layer: 'POWER', x1: 40, y1: 170, x2: 40, y2: 70 });
  entities.push({ type: 'TEXT', layer: 'TEXT', x1: 30, y1: 175, text: `REDE DA DISTRIBUIDORA (${projectData.technical.voltage})`, size: 3.0 });

  // 4. Inversores e Blocos Fotovoltaicos
  let startX = 70;
  projectData.equipmentBlocks.forEach((block, idx) => {
    // Inversor
    entities.push({ type: 'RECT', layer: 'EQUIPMENT', x1: startX, y1: 120, x2: startX + 35, y2: 155 });
    entities.push({ type: 'TEXT', layer: 'TEXT', x1: startX + 2, y1: 145, text: `INVERSOR ${idx + 1}`, size: 2.5 });
    entities.push({ type: 'TEXT', layer: 'TEXT', x1: startX + 2, y1: 135, text: `${block.inverter.model}`, size: 2.0 });
    entities.push({ type: 'TEXT', layer: 'TEXT', x1: startX + 2, y1: 125, text: `${block.inverter.power} kW (${block.inverter.outputPhases}F)`, size: 2.0 });

    // Conexão CC (Módulos -> Inversor)
    entities.push({ type: 'LINE', layer: 'DC_CABLE', x1: startX + 17.5, y1: 120, x2: startX + 17.5, y2: 90 });
    entities.push({ type: 'RECT', layer: 'MODULES', x1: startX + 5, y1: 70, x2: startX + 30, y2: 90 });
    entities.push({ type: 'TEXT', layer: 'TEXT', x1: startX + 7, y1: 82, text: `${block.moduleQty}x ${block.module.power}W`, size: 2.0 });
    entities.push({ type: 'TEXT', layer: 'TEXT', x1: startX + 7, y1: 74, text: `${block.module.brand}`, size: 1.8 });

    // Conexão CA (Inversor -> Barramento)
    entities.push({ type: 'LINE', layer: 'AC_CABLE', x1: startX + 17.5, y1: 155, x2: startX + 17.5, y2: 170 });
    entities.push({ type: 'LINE', layer: 'AC_CABLE', x1: startX + 17.5, y1: 170, x2: 40, y2: 170 });

    startX += 45;
  });

  // Constrói arquivo DXF
  let dxf = `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n`;
  dxf += `0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n4\n`;
  ['FRAME', 'TITLE_BLOCK', 'POWER', 'EQUIPMENT', 'DC_CABLE', 'AC_CABLE', 'MODULES', 'TEXT'].forEach(layer => {
    dxf += `0\nLAYER\n2\n${layer}\n70\n0\n62\n7\n6\nCONTINUOUS\n`;
  });
  dxf += `0\nENDTAB\n0\nENDSEC\n`;
  dxf += `0\nSECTION\n2\nENTITIES\n`;

  entities.forEach(ent => {
    if (ent.type === 'LINE') {
      dxf += `0\nLINE\n8\n${ent.layer}\n10\n${ent.x1}\n20\n${ent.y1}\n30\n0.0\n11\n${ent.x2}\n21\n${ent.y2}\n31\n0.0\n`;
    } else if (ent.type === 'RECT') {
      dxf += `0\nLINE\n8\n${ent.layer}\n10\n${ent.x1}\n20\n${ent.y1}\n30\n0.0\n11\n${ent.x2}\n21\n${ent.y1}\n31\n0.0\n`;
      dxf += `0\nLINE\n8\n${ent.layer}\n10\n${ent.x2}\n20\n${ent.y1}\n30\n0.0\n11\n${ent.x2}\n21\n${ent.y2}\n31\n0.0\n`;
      dxf += `0\nLINE\n8\n${ent.layer}\n10\n${ent.x2}\n20\n${ent.y2}\n30\n0.0\n11\n${ent.x1}\n21\n${ent.y2}\n31\n0.0\n`;
      dxf += `0\nLINE\n8\n${ent.layer}\n10\n${ent.x1}\n20\n${ent.y2}\n30\n0.0\n11\n${ent.x1}\n21\n${ent.y1}\n31\n0.0\n`;
    } else if (ent.type === 'TEXT') {
      dxf += `0\nTEXT\n8\n${ent.layer}\n10\n${ent.x1}\n20\n${ent.y1}\n30\n0.0\n40\n${ent.size || 2.5}\n1\n${ent.text}\n`;
    }
  });

  dxf += `0\nENDSEC\n0\nEOF\n`;
  return dxf;
}

export function downloadDxfFile(filename: string, dxfContent: string) {
  const blob = new Blob([dxfContent], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.dxf') ? filename : `${filename}.dxf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
