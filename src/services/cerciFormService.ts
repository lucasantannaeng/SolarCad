/**
 * Serviço de Geração do Formulário Oficial de Solicitação de Acesso GD — CERCI
 * Cooperativa de Eletrificação e Desenvolvimento Rural de Cantagalo Ltda. (Região Serrana - RJ)
 * Regulamentação: Normas Técnicas CERCI, REN ANEEL nº 1.000/2021 e Lei 14.300/2022.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ProjectState } from '../types';
import { getProjectEngineeringStatus } from './engineering';

export interface CerciFormData {
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
 * Sanitiza o nome do arquivo removendo caracteres inválidos
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
 * Extrai e normaliza os dados do projeto para a CERCI
 */
export function extractCerciFormData(project: ProjectState): CerciFormData {
  const c = project.client;
  const addr = c.address || { street: '', number: '', neighborhood: '', city: '', state: '', zipCode: '' };
  const addressFull = `${addr.street || ''}, ${addr.number || 'S/N'}${addr.neighborhood ? ' - ' + addr.neighborhood : ''}, ${addr.city || 'Cantagalo'}/${addr.state || 'RJ'}${addr.zipCode ? ' - CEP: ' + addr.zipCode : ''}`;

  return {
    clientName: c.name || 'Cooperado Não Informado',
    document: c.document || 'Não informado',
    utilityId: c.utilityId || 'Não informado',
    email: c.email || 'Não informado',
    phone: c.phone || 'Não informado',
    art: c.art || 'Não informado',
    addressFull,
    city: addr.city || 'Cantagalo',
    state: addr.state || 'RJ',
    engineerName: project.engineer?.name || 'Não informado',
    engineerCrea: project.engineer?.crea || 'Não informado',
    gdType: project.gdType || 'Autoconsumo remoto',
  };
}

/**
 * Gera o documento PDF oficial de Solicitação de Acesso da CERCI (Cantagalo/RJ)
 */
export function generateCerciFormPDF(project: ProjectState): { fileName: string; doc: jsPDF } {
  const data = extractCerciFormData(project);
  const cleanName = sanitizeClientFileName(data.clientName);
  const fileName = `${cleanName}_Formulario_Acesso_CERCI.pdf`;

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
  // 1. Cabeçalho Oficial Corporativo — CERCI
  // ═══════════════════════════════════════════════════
  doc.setFillColor(6, 78, 59); // Forest Emerald Green
  doc.rect(margin, y, contentWidth, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('CERCI — COOPERATIVA DE ELETRIFICAÇÃO DE CANTAGALO LTDA.', margin + 5, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(167, 243, 208); // Emerald Light
  doc.text('Região Serrana e Centro-Norte Fluminense — Cantagalo / Cordeiro / Macuco / Região (RJ)', margin + 5, y + 12.5);
  doc.setTextColor(226, 232, 240);
  doc.text('Formulário de Solicitação de Acesso de Microgeração Distribuída — REN ANEEL 1.000/2021 & Lei 14.300/2022', margin + 5, y + 17);

  y += 27;

  // Título da Seção
  doc.setTextColor(6, 78, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('SOLICITAÇÃO DE ACESSO GD — COOPERATIVA CERCI', pageWidth / 2, y, { align: 'center' });

  y += 7;

  // ═══════════════════════════════════════════════════
  // 2. Seção 1: Identificação do Cooperado / Titular da UC
  // ═══════════════════════════════════════════════════
  autoTable(doc, {
    startY: y,
    head: [[{ content: '1. IDENTIFICAÇÃO DO COOPERADO / UNIDADE CONSUMIDORA', colSpan: 2 }]],
    body: [
      [{ content: 'Nome do Cooperado / Razão Social:', styles: { fontStyle: 'bold' } }, data.clientName],
      [{ content: 'CPF / CNPJ:', styles: { fontStyle: 'bold' } }, data.document],
      [{ content: 'Matrícula / Código do Cooperado (UC):', styles: { fontStyle: 'bold' } }, data.utilityId],
      [{ content: 'Localização da Propriedade / Endereço:', styles: { fontStyle: 'bold' } }, data.addressFull],
      [{ content: 'Telefone de Contato:', styles: { fontStyle: 'bold' } }, data.phone],
      [{ content: 'E-mail:', styles: { fontStyle: 'bold' } }, data.email],
      [{ content: 'Modalidade de Geração Distribuída:', styles: { fontStyle: 'bold' } }, data.gdType],
    ],
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2, textColor: [15, 23, 42] },
    headStyles: { fillColor: [6, 78, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    columnStyles: { 0: { cellWidth: 58, fillColor: [240, 253, 244] } },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // ═══════════════════════════════════════════════════
  // 3. Seção 2: Padrão de Entrada e Atendimento (CERCI)
  // ═══════════════════════════════════════════════════
  autoTable(doc, {
    startY: y,
    head: [[{ content: '2. CARACTERÍSTICAS DA LIGAÇÃO E PADRÃO DE ENTRADA (CERCI)', colSpan: 4 }]],
    body: [
      [
        { content: 'Permissionária / Distribuidora:', styles: { fontStyle: 'bold', fillColor: [240, 253, 244] } },
        'CERCI - Cooperativa Cantagalo (RJ)',
        { content: 'Tipo de Fornecimento:', styles: { fontStyle: 'bold', fillColor: [240, 253, 244] } },
        project.technical.connectionType,
      ],
      [
        { content: 'Tensão de Fornecimento:', styles: { fontStyle: 'bold', fillColor: [240, 253, 244] } },
        project.technical.voltage,
        { content: 'Disjuntor Geral Padrão:', styles: { fontStyle: 'bold', fillColor: [240, 253, 244] } },
        `${project.technical.mainBreaker} A`,
      ],
      [
        { content: 'Distância do Padrão à Rede:', styles: { fontStyle: 'bold', fillColor: [240, 253, 244] } },
        `${project.technical.distance} metros`,
        { content: 'Classificação da Unidade:', styles: { fontStyle: 'bold', fillColor: [240, 253, 244] } },
        'Baixa Tensão (Rural / Urbano)',
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2, textColor: [15, 23, 42] },
    headStyles: { fillColor: [6, 78, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    columnStyles: { 0: { cellWidth: 46 }, 2: { cellWidth: 42 } },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // ═══════════════════════════════════════════════════
  // 4. Seção 3: Dados Técnicos da Central Geradora Solar Fotovoltaica
  // ═══════════════════════════════════════════════════
  const totalModQty = project.equipmentBlocks.reduce((acc, b) => acc + (b.moduleQty || 0), 0);
  const totalInvQty = project.equipmentBlocks.reduce((acc, b) => acc + (b.inverterQty || 1), 0);
  const fdiRatio = eng.totalAcPower > 0 ? (eng.totalDcPower / eng.totalAcPower) * 100 : 0;

  autoTable(doc, {
    startY: y,
    head: [[{ content: '3. PARÂMETROS DA USINA FOTOVOLTAICA GERADORA', colSpan: 4 }]],
    body: [
      [
        { content: 'Potência Total CC (kWp):', styles: { fontStyle: 'bold', fillColor: [240, 253, 244] } },
        `${eng.totalDcPower.toFixed(2)} kWp`,
        { content: 'Potência Total CA Inversores:', styles: { fontStyle: 'bold', fillColor: [240, 253, 244] } },
        `${eng.totalAcPower.toFixed(2)} kW`,
      ],
      [
        { content: 'Fator de Sobrecarga (CC/CA):', styles: { fontStyle: 'bold', fillColor: [240, 253, 244] } },
        `${fdiRatio.toFixed(1)} %`,
        { content: 'Corrente Nominal CA de Saída:', styles: { fontStyle: 'bold', fillColor: [240, 253, 244] } },
        `${eng.totalNominalCurrent.toFixed(2)} A`,
      ],
      [
        { content: 'Quantidade de Módulos FV:', styles: { fontStyle: 'bold', fillColor: [240, 253, 244] } },
        `${totalModQty} unidades`,
        { content: 'Quantidade de Inversores/Micros:', styles: { fontStyle: 'bold', fillColor: [240, 253, 244] } },
        `${totalInvQty} unidades`,
      ],
      [
        { content: 'Disjuntor CA Sugerido:', styles: { fontStyle: 'bold', fillColor: [240, 253, 244] } },
        `Disjuntor ${eng.totalSuggestedBreaker} A (${eng.totalBreakerPolarity})`,
        { content: 'Fonte e Tecnologia:', styles: { fontStyle: 'bold', fillColor: [240, 253, 244] } },
        'Solar Fotovoltaica (Silício)',
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2, textColor: [15, 23, 42] },
    headStyles: { fillColor: [6, 78, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    columnStyles: { 0: { cellWidth: 46 }, 2: { cellWidth: 46 } },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // Detalhamento dos Equipamentos por Bloco
  const equipRows = project.equipmentBlocks.map((b, idx) => {
    const stringDesc = b.strings?.map(s => `${s.count} mods`).join(' + ') || 'N/A';
    return [
      `Bloco ${idx + 1}`,
      `${b.moduleBrand || b.module?.brand} ${b.moduleModel || b.module?.model} (${b.modulePowerW || b.module?.power}W) - Qtd: ${b.moduleQty} un`,
      `${b.inverterBrand || b.inverter?.brand} ${b.inverterModel || b.inverter?.model} (${b.inverterPowerKw || b.inverter?.power}kW) - Qtd: ${b.inverterQty} un`,
      stringDesc,
      `${((b.modulePowerW * b.moduleQty) / 1000).toFixed(2)} kWp / ${(b.inverterPowerKw * b.inverterQty).toFixed(2)} kW`,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Item', 'Módulos Fotovoltaicos', 'Inversores / Microinversores', 'Arranjo Strings', 'Potência CC / CA']],
    body: equipRows.length > 0 ? equipRows : [['1', 'Módulo Padrão 550W', 'Inversor Padrão 5kW', '1x 10', '5.50 kWp / 5.00 kW']],
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2, textColor: [15, 23, 42] },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 15, fontStyle: 'bold' },
      1: { cellWidth: 55 },
      2: { cellWidth: 55 },
      3: { cellWidth: 25 },
      4: { cellWidth: 32, fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // ═══════════════════════════════════════════════════
  // 5. Seção 4: Responsável Técnico pelo Projeto
  // ═══════════════════════════════════════════════════
  autoTable(doc, {
    startY: y,
    head: [[{ content: '4. RESPONSÁVEL TÉCNICO PELO PROJETO E EXECUÇÃO', colSpan: 3 }]],
    body: [
      [
        { content: 'Nome do Profissional:', styles: { fontStyle: 'bold', fillColor: [240, 253, 244] } },
        { content: 'Registro Profissional (CREA/CFT):', styles: { fontStyle: 'bold', fillColor: [240, 253, 244] } },
        { content: 'Número da ART / TRT:', styles: { fontStyle: 'bold', fillColor: [240, 253, 244] } },
      ],
      [
        data.engineerName,
        data.engineerCrea,
        data.art,
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2, textColor: [15, 23, 42] },
    headStyles: { fillColor: [6, 78, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    margin: { left: margin, right: margin },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // ═══════════════════════════════════════════════════
  // 6. Termo de Declaração Técnica e Normas de Segurança CERCI
  // ═══════════════════════════════════════════════════
  doc.setFillColor(240, 253, 244);
  doc.rect(margin, y, contentWidth, 20, 'F');
  doc.setDrawColor(187, 247, 208);
  doc.rect(margin, y, contentWidth, 20, 'D');

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.8);
  doc.setTextColor(22, 101, 52);
  const termoText = `Declaro para os devidos fins de conexão à rede da CERCI (Cooperativa Cantagalo Ltda.), sob as penas da lei, que o sistema gerador fotovoltaico especificado atende integralmente aos padrões técnicos da CERCI, normas ABNT NBR 16690, NBR 5410, NBR IEC 62116 (proteção anti-ilhamento), Resolução Normativa ANEEL nº 1.000/2021 e Lei nº 14.300/2022. Os inversores possuem certificação compulsória no INMETRO e sistema de desconexão automática em caso de interrupção do fornecimento da cooperativa.`;
  const splitTermo = doc.splitTextToSize(termoText, contentWidth - 6);
  doc.text(splitTermo, margin + 3, y + 4.5);

  y += 24;

  // ═══════════════════════════════════════════════════
  // 7. Bloco de Assinaturas e Local/Data
  // ═══════════════════════════════════════════════════
  const currentDateStr = new Date().toLocaleDateString('pt-BR');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const locationCity = data.city || 'Cantagalo';
  doc.text(`${locationCity} - RJ, ${currentDateStr}`, pageWidth / 2, y, { align: 'center' });

  y += 10;

  const sigColW = 75;
  const sigX1 = margin + 10;
  const sigX2 = pageWidth - margin - sigColW - 10;

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);

  // Linha 1 - Cooperado
  doc.line(sigX1, y, sigX1 + sigColW, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(data.clientName, sigX1 + sigColW / 2, y + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Cooperado Titular / CPF: ${data.document}`, sigX1 + sigColW / 2, y + 7.5, { align: 'center' });

  // Linha 2 - Responsável Técnico
  doc.line(sigX2, y, sigX2 + sigColW, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(data.engineerName, sigX2 + sigColW / 2, y + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Resp. Técnico / CREA: ${data.engineerCrea}`, sigX2 + sigColW / 2, y + 7.5, { align: 'center' });

  // Rodapé Técnico
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('SolarCAD — Formulário Oficial de Solicitação de Acesso GD (CERCI Cantagalo/RJ)', margin, pageHeight - 8);
  doc.text('Página 1 de 1', pageWidth - margin, pageHeight - 8, { align: 'right' });

  return { fileName, doc };
}

/**
 * Dispara o download do PDF do formulário da CERCI no navegador
 */
export function downloadCerciFormPDF(project: ProjectState): void {
  const { fileName, doc } = generateCerciFormPDF(project);
  doc.save(fileName);
}
