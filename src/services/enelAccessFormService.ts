/**
 * Serviço de Geração do Formulário Oficial de Solicitação de Acesso GD — ENEL Distribuição Rio
 * Regulamentação: Norma Técnica CNC-GD (Enel Brasil / RJ), Resolução Normativa ANEEL nº 1.000/2021 e Lei 14.300/2022.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ProjectState } from '../types';
import { getProjectEngineeringStatus } from './engineering';

export interface EnelAccessFormData {
  clientName: string;
  document: string;
  utilityId: string;
  email: string;
  phone: string;
  art: string;
  addressFull: string;
  city: string;
  state: string;
  engineerName: string;
  engineerCrea: string;
  gdType: string;
}

/**
 * Sanitiza o nome do arquivo removendo caracteres inválidos e normalizando acentos
 */
export function sanitizeClientFileName(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'Cliente'
  );
}

/**
 * Extrai e normaliza os dados do projeto para a Enel Distribuição Rio
 */
export function extractEnelAccessFormData(project: ProjectState): EnelAccessFormData {
  const c = project.client;
  const addr = c.address || { street: '', number: '', neighborhood: '', city: '', state: '', zipCode: '' };
  const addressFull = `${addr.street || ''}, ${addr.number || 'S/N'}${addr.neighborhood ? ' - ' + addr.neighborhood : ''}, ${addr.city || 'Rio de Janeiro'}/${addr.state || 'RJ'}${addr.zipCode ? ' - CEP: ' + addr.zipCode : ''}`;

  return {
    clientName: c.name || 'Cliente Não Informado',
    document: c.document || 'Não informado',
    utilityId: c.utilityId || 'Não informado',
    email: c.email || 'Não informado',
    phone: c.phone || 'Não informado',
    art: c.art || 'Não informado',
    addressFull,
    city: addr.city || 'Rio de Janeiro',
    state: addr.state || 'RJ',
    engineerName: project.engineer?.name || 'Não informado',
    engineerCrea: project.engineer?.crea || 'Não informado',
    gdType: project.gdType || 'Autoconsumo remoto',
  };
}

/**
 * Gera o documento PDF oficial de Solicitação de Acesso da Enel RJ
 */
export function generateEnelAccessFormPDF(project: ProjectState): { fileName: string; doc: jsPDF } {
  const data = extractEnelAccessFormData(project);
  const cleanName = sanitizeClientFileName(data.clientName);
  const fileName = `${cleanName}_Formulario_Acesso_ENEL_RJ.pdf`;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 12;

  const eng = getProjectEngineeringStatus(project.equipmentBlocks, project.technical);

  // ═══════════════════════════════════════════════════
  // 1. Cabeçalho Corporativo — Enel Distribuição Rio
  // ═══════════════════════════════════════════════════
  doc.setFillColor(220, 38, 38); // Enel Red primary banner
  doc.rect(margin, y, contentWidth, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('ENEL DISTRIBUIÇÃO RIO DE JANEIRO', margin + 5, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(254, 226, 226); // Light rose accent
  doc.text('CNC-GD — Conexão de Microgeração e Minigeração Distribuída ao Sistema Elétrico', margin + 5, y + 12.5);
  doc.text('Formulário de Solicitação de Acesso (REN ANEEL nº 1.000/2021 e Lei nº 14.300/2022)', margin + 5, y + 17.5);

  doc.setFillColor(185, 28, 28);
  doc.roundedRect(pageWidth - margin - 42, y + 4, 38, 14, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('ANEXO I — CNC-GD', pageWidth - margin - 23, y + 10, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('MICROGERAÇÃO', pageWidth - margin - 23, y + 14.5, { align: 'center' });

  y += 26;

  // ═══════════════════════════════════════════════════
  // 2. Identificação do Titular e da Unidade Consumidora
  // ═══════════════════════════════════════════════════
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    margin: { left: margin, right: margin },
    head: [['1. IDENTIFICAÇÃO DO TITULAR / ACESSANTE E DA UNIDADE CONSUMIDORA', '']],
    headStyles: {
      fillColor: [239, 68, 68],
      textColor: 255,
      fontSize: 8.5,
      fontStyle: 'bold',
      cellPadding: 2.2,
    },
    body: [
      [
        { content: `Nome / Razão Social: ${data.clientName}`, styles: { fontStyle: 'bold' } },
        { content: `CPF / CNPJ: ${data.document}` },
      ],
      [
        { content: `Nº da Unidade Consumidora (UC): ${data.utilityId}`, styles: { fontStyle: 'bold', textColor: [185, 28, 28] } },
        { content: `Modalidade de GD: ${data.gdType}` },
      ],
      [
        { content: `Endereço da Instalação: ${data.addressFull}`, colSpan: 2 },
      ],
      [
        { content: `E-mail: ${data.email}` },
        { content: `Telefone / WhatsApp: ${data.phone}` },
      ],
    ],
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 2,
    },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // ═══════════════════════════════════════════════════
  // 3. Padrão de Entrada e Características da Ligação
  // ═══════════════════════════════════════════════════
  const connLabel = project.technical.connectionType === 'MONOFASICO' ? 'Monofásico' : project.technical.connectionType === 'BIFASICO' ? 'Bifásico' : 'Trifásico';

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    margin: { left: margin, right: margin },
    head: [['2. CARACTERÍSTICAS DA CONEXÃO E PADRÃO DE ENTRADA (ENEL RJ)', '']],
    headStyles: {
      fillColor: [239, 68, 68],
      textColor: 255,
      fontSize: 8.5,
      fontStyle: 'bold',
      cellPadding: 2.2,
    },
    body: [
      [
        { content: `Tensão de Atendimento: ${project.technical.voltage}` },
        { content: `Tipo de Ligação: ${connLabel}` },
      ],
      [
        { content: `Disjuntor Geral de Entrada: ${project.technical.mainBreaker} A` },
        { content: `Distância Padrão → Inversores: ${project.technical.distance || 20} metros` },
      ],
      [
        { content: `Concessionária: Enel Distribuição Rio de Janeiro` },
        { content: `Classificação Tarifária: Baixa Tensão (Grupo B)` },
      ],
    ],
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 2,
    },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // ═══════════════════════════════════════════════════
  // 4. Dados Técnicos da Central Geradora Solar Fotovoltaica
  // ═══════════════════════════════════════════════════
  const rowsEquip = project.equipmentBlocks.map((b, idx) => {
    const isMicro = b.inverter.inverterType === 'micro';
    const topologia = isMicro ? 'Microinversor' : 'Inversor String';
    const numStrings = b.strings?.length || 1;
    return [
      `Conjunto #${idx + 1} (${topologia})`,
      `${b.moduleQty}x ${b.moduleBrand || 'Módulo'} ${b.moduleModel || ''} (${b.modulePowerW}W)`,
      `${b.inverterQty}x ${b.inverterBrand || 'Inversor'} ${b.inverterModel || ''} (${b.inverterPowerKw} kW)`,
      `${numStrings} String(s) / Entrada(s)`,
      `${((b.moduleQty * b.modulePowerW) / 1000).toFixed(2)} kWp / ${(b.inverterQty * b.inverterPowerKw).toFixed(2)} kW`,
    ];
  });

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    margin: { left: margin, right: margin },
    head: [
      ['3. DADOS TÉCNICOS DA GERAÇÃO FOTOVOLTAICA (EQUIPAMENTOS HOMOLOGADOS INMETRO)', '', '', '', ''],
      ['Conjunto / Topologia', 'Módulos Fotovoltaicos', 'Inversores / Conversores', 'Arranjo / MPPTs', 'Potência CC / CA'],
    ],
    headStyles: {
      fillColor: [239, 68, 68],
      textColor: 255,
      fontSize: 7.5,
      fontStyle: 'bold',
      cellPadding: 2,
    },
    body: rowsEquip,
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
      cellPadding: 2,
    },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // ═══════════════════════════════════════════════════
  // 5. Resumo Global de Potência e Proteção CA da Usina
  // ═══════════════════════════════════════════════════
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    margin: { left: margin, right: margin },
    body: [
      [
        {
          content: `Potência Total Instalada (CC): ${eng.totalDcPower.toFixed(2)} kWp`,
          styles: { fontStyle: 'bold', textColor: [15, 23, 42], fontSize: 8 },
        },
        {
          content: `Potência Nominal dos Inversores (CA): ${eng.totalAcPower.toFixed(2)} kW`,
          styles: { fontStyle: 'bold', textColor: [185, 28, 28], fontSize: 8 },
        },
      ],
      [
        {
          content: `Corrente Nominal Total CA: ${eng.totalNominalCurrent.toFixed(1)} A`,
          styles: { fontSize: 7.5, textColor: [71, 85, 105] },
        },
        {
          content: `Proteção Geral do Sistema FV: Disjuntor ${eng.totalSuggestedBreaker}A ${eng.totalBreakerPolarity}`,
          styles: { fontSize: 7.5, fontStyle: 'bold', textColor: [185, 28, 28] },
        },
      ],
      [
        {
          content: `Fator de Sobredimensionamento (FDR / Ratio): ${(eng.totalDcPower / Math.max(eng.totalAcPower, 0.01)).toFixed(2)}`,
          styles: { fontSize: 7.5, textColor: [71, 85, 105] },
        },
        {
          content: `Proteção Anti-Ilhamento: Integrada conforme NBR IEC 62116 / ABNT NBR 16149`,
          styles: { fontSize: 7.5, textColor: [22, 101, 52] },
        },
      ],
    ],
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // ═══════════════════════════════════════════════════
  // 6. Responsabilidade Técnica (ART / CREA)
  // ═══════════════════════════════════════════════════
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    margin: { left: margin, right: margin },
    head: [['4. RESPONSÁVEL TÉCNICO PELO PROJETO E EXECUÇÃO', '']],
    headStyles: {
      fillColor: [239, 68, 68],
      textColor: 255,
      fontSize: 8.5,
      fontStyle: 'bold',
      cellPadding: 2.2,
    },
    body: [
      [
        { content: `Engenheiro(a) Responsável: ${data.engineerName}`, styles: { fontStyle: 'bold' } },
        { content: `Registro Profissional (CREA/CAU): ${data.engineerCrea}` },
      ],
      [
        { content: `Número da ART / RRT: ${data.art}`, styles: { fontStyle: 'bold', textColor: [185, 28, 28] } },
        { content: `Normas Aplicáveis: ABNT NBR 5410, NBR 16690 e CNC-GD Enel RJ` },
      ],
    ],
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 2,
    },
  });

  y = (doc as any).lastAutoTable.finalY + 5;

  // ═══════════════════════════════════════════════════
  // 7. Termo de Compromisso e Declaração de Conformidade
  // ═══════════════════════════════════════════════════
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 22, 1.5, 1.5, 'FD');

  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('5. DECLARAÇÃO DO RESPONSÁVEL TÉCNICO E DO TITULAR', margin + 3, y + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  const termoTexto =
    'Declaramos que o projeto e as instalações da central de microgeração distribuída acima discriminada atendem integralmente à legislação do setor elétrico (Lei nº 14.300/2022), às Resoluções Normativas da ANEEL (REN nº 1.000/2021) e aos padrões técnicos da ENEL DISTRIBUIÇÃO RIO (Norma CNC-GD), possuindo proteção anti-ilhamento certificada para desconexão automática em caso de interrupção no fornecimento da rede da distribuidora.';
  
  const splitTermo = doc.splitTextToSize(termoTexto, contentWidth - 6);
  doc.text(splitTermo, margin + 3, y + 8.5);

  y += 28;

  // ═══════════════════════════════════════════════════
  // 8. Bloco de Assinaturas
  // ═══════════════════════════════════════════════════
  const colSigW = (contentWidth - 10) / 2;
  const sigY = y + 10;

  // Assinatura Titular
  doc.setDrawColor(148, 163, 184);
  doc.line(margin, sigY, margin + colSigW, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(data.clientName, margin + colSigW / 2, sigY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Titular da UC: ${data.utilityId}`, margin + colSigW / 2, sigY + 7.5, { align: 'center' });
  doc.text(`CPF/CNPJ: ${data.document}`, margin + colSigW / 2, sigY + 11, { align: 'center' });

  // Assinatura Responsável Técnico
  const sig2X = margin + colSigW + 10;
  doc.line(sig2X, sigY, sig2X + colSigW, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(data.engineerName, sig2X + colSigW / 2, sigY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`CREA/CAU: ${data.engineerCrea}`, sig2X + colSigW / 2, sigY + 7.5, { align: 'center' });
  doc.text(`ART: ${data.art}`, sig2X + colSigW / 2, sigY + 11, { align: 'center' });

  // Data e Rodapé
  const dataExtenso = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`${data.city} - ${data.state}, ${dataExtenso}`, pageWidth / 2, sigY + 17, { align: 'center' });

  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text('SolarCAD — Sistema Profissional de Homologação e Engenharia Fotovoltaica', margin, 290);
  doc.text('Página 1 de 1', pageWidth - margin, 290, { align: 'right' });

  return { fileName, doc };
}

/**
 * Executa o download direto do formulário oficial de Solicitação de Acesso da Enel RJ
 */
export function downloadEnelAccessFormPDF(project: ProjectState): string {
  const { fileName, doc } = generateEnelAccessFormPDF(project);
  doc.save(fileName);
  return fileName;
}
