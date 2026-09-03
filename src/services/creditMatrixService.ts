/**
 * Serviço de Matriz de Rateio de Créditos GD Multi-Concessionária
 * SolarCAD — Homologação de Micro e Minigeração Distribuída
 * 
 * Suporte Oficial às Distribuidoras:
 * - LIGHT SERVIÇOS DE ELETRICIDADE S.A. (Anexo RECON-BT)
 * - CERCI - COOPERATIVA DE ELETRIFICAÇÃO RURAL DE CANTAGALO (Normas Técnicas CERCI)
 * - GRUPO ENERGISA (Norma Técnica NDU-013)
 * - ENEL DISTRIBUIÇÃO RIO (CNC-GD / Tabela334)
 * 
 * Regulamentação: Lei Federal nº 14.300/2022 e Resolução Normativa ANEEL nº 1.000/2021.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { ProjectState, CreditBeneficiary, GDType, UtilityCompany } from '../types';
import { estimateMonthlyGeneration, validateCreditDistribution } from './creditDistribution';
import { getProjectEngineeringStatus } from './engineering';
import { sanitizeClientFileName } from './enelFormService';

export interface CreditMatrixData {
  utility: UtilityCompany;
  utilityLabel: string;
  normativeRef: string;
  generatorUc: string;
  generatorDocument: string;
  generatorName: string;
  generatorAddress: string;
  gdType: GDType;
  totalDcPowerKwp: number;
  totalAcPowerKw: number;
  monthlyGenerationKwh: number;
  anchorUc?: string;
  beneficiaries: CreditBeneficiary[];
  isValid: boolean;
  totalPercentage: number;
  validationMessage: string;
}

/**
 * Retorna as diretrizes visuais e normativas específicas de cada concessionária
 */
export function getUtilityMatrixConfig(utility: UtilityCompany) {
  switch (utility) {
    case UtilityCompany.LIGHT:
      return {
        label: 'LIGHT SERVIÇOS DE ELETRICIDADE S.A.',
        sublabel: 'ANEXO RECON-BT — FORMULÁRIO DE RATEIO DE CRÉDITOS DE GD',
        normativeRef: 'RECON-BT (Light S.A.), Lei 14.300/2022 e REN ANEEL nº 1.000/2021',
        primaryColor: [15, 23, 42] as [number, number, number], // Slate Navy
        accentColor: [186, 230, 253] as [number, number, number], // Light Blue
        headerHex: '0F172A',
        accentHex: '38BDF8',
        fileTag: 'LIGHT_RECON_BT',
      };
    case UtilityCompany.CERCI:
      return {
        label: 'CERCI — COOPERATIVA DE ELETRIFICAÇÃO DE CANTAGALO LTDA.',
        sublabel: 'ANEXO DE INDICAÇÃO DE BENEFICIÁRIAS E RATEIO DE CRÉDITOS GD',
        normativeRef: 'Normas Técnicas CERCI (Cantagalo/RJ), Lei 14.300/2022 e REN ANEEL 1.000/2021',
        primaryColor: [6, 78, 59] as [number, number, number], // Forest Emerald
        accentColor: [167, 243, 208] as [number, number, number], // Mint
        headerHex: '064E3B',
        accentHex: '10B981',
        fileTag: 'CERCI_CANTAGALO',
      };
    case UtilityCompany.ENERGISA:
      return {
        label: 'GRUPO ENERGISA — DISTRIBUIÇÃO DE ENERGIA S.A.',
        sublabel: 'ANEXO NDU-013 — MATRIZ DE CADASTRO DE UNIDADES BENEFICIÁRIAS DE GD',
        normativeRef: 'Norma Técnica NDU-013 (Energisa RJ/MG), Lei 14.300/2022 e REN ANEEL 1.000/2021',
        primaryColor: [0, 75, 135] as [number, number, number], // Energisa Deep Blue
        accentColor: [254, 215, 170] as [number, number, number], // Warm Orange
        headerHex: '004B87',
        accentHex: 'F97316',
        fileTag: 'ENERGISA_NDU013',
      };
    case UtilityCompany.ENEL_RJ:
    default:
      return {
        label: 'ENEL DISTRIBUIÇÃO RIO DE JANEIRO',
        sublabel: 'FORMULÁRIO DE SOLICITAÇÃO DE RATEIO – GD (CNC-GD)',
        normativeRef: 'Norma Técnica CNC-GD Enel RJ, Lei 14.300/2022 e REN ANEEL 1.000/2021',
        primaryColor: [220, 38, 38] as [number, number, number], // Enel Red
        accentColor: [254, 202, 202] as [number, number, number], // Soft Red
        headerHex: 'DC2626',
        accentHex: 'EF4444',
        fileTag: 'ENEL_RJ_RATEIO',
      };
  }
}

/**
 * Normaliza os dados do rateio a partir do ProjectState
 */
export function extractCreditMatrixData(project: ProjectState): CreditMatrixData {
  const utility = project.technical?.utility || UtilityCompany.LIGHT;
  const config = getUtilityMatrixConfig(utility);

  const generatorUc = (project.client?.utilityId || '').trim();
  const generatorDoc = project.client?.document || '';
  const generatorName = project.client?.name || 'Cliente';
  const gdType = project.gdType || 'Autoconsumo remoto';

  const addr = project.client?.address || { street: '', number: '', neighborhood: '', city: '', state: '', zipCode: '' };
  const generatorAddress = `${addr.street || ''}, ${addr.number || 'S/N'}${addr.neighborhood ? ' - ' + addr.neighborhood : ''}, ${addr.city || 'Cidade'}/${addr.state || 'RJ'}${addr.zipCode ? ' - CEP: ' + addr.zipCode : ''}`;

  const engResult = getProjectEngineeringStatus(project.equipmentBlocks || [], project.technical);
  const totalDcPowerKwp = engResult.totalDcPower;
  const totalAcPowerKw = engResult.totalAcPower;
  const monthlyGenerationKwh = Math.round(estimateMonthlyGeneration(totalDcPowerKwp));

  const rawBeneficiaries = project.creditBeneficiaries || [];

  // Garante que a lista de participantes inclua a UC Geradora se o usuário não a tiver inserido explicitamente
  let beneficiaries = [...rawBeneficiaries];
  const hasGen = beneficiaries.some(b => b.isGenerator || b.utilityId.replace(/\D/g, '') === generatorUc.replace(/\D/g, ''));

  if (!hasGen && generatorUc) {
    beneficiaries = [
      {
        id: 'ucp-auto',
        utilityId: generatorUc,
        document: generatorDoc,
        description: 'UC Geradora Principal (Local)',
        percentage: beneficiaries.length === 0 ? 100 : 0,
        isGenerator: true,
        averageConsumptionKwh: 0,
      },
      ...beneficiaries,
    ];
  }

  const validation = validateCreditDistribution(beneficiaries, monthlyGenerationKwh);

  // Unidade âncora (se houver)
  const anchorItem = beneficiaries.find(b => (b as any).isAnchor);
  const anchorUc = anchorItem ? anchorItem.utilityId.replace(/\D/g, '') : '';

  let validationMessage = 'Distribuição de créditos regular e 100% alocada.';
  if (!validation.isValid) {
    validationMessage = `Soma dos percentuais (${validation.totalPercentage.toFixed(2)}%) excede 100%.`;
  } else if (!validation.isComplete) {
    validationMessage = `Soma dos percentuais (${validation.totalPercentage.toFixed(2)}%) é inferior a 100%. Saldo restante: ${(100 - validation.totalPercentage).toFixed(2)}%.`;
  }

  return {
    utility,
    utilityLabel: config.label,
    normativeRef: config.normativeRef,
    generatorUc,
    generatorDocument: generatorDoc,
    generatorName,
    generatorAddress,
    gdType,
    totalDcPowerKwp,
    totalAcPowerKw,
    monthlyGenerationKwh,
    anchorUc,
    beneficiaries,
    isValid: validation.isValid && validation.isComplete,
    totalPercentage: validation.totalPercentage,
    validationMessage,
  };
}

/**
 * Gera o documento PDF oficial da Matriz de Rateio Multi-Concessionária
 */
export function generateCreditMatrixPDF(project: ProjectState): { fileName: string; doc: jsPDF } {
  const data = extractCreditMatrixData(project);
  const config = getUtilityMatrixConfig(data.utility);
  const cleanName = sanitizeClientFileName(data.generatorName);
  const fileName = `${cleanName}_Matriz_Rateio_${config.fileTag}.pdf`;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = 12;

  // ═══════════════════════════════════════════════════
  // 1. Cabeçalho Oficial Corporativo da Concessionária
  // ═══════════════════════════════════════════════════
  doc.setFillColor(...config.primaryColor);
  doc.rect(margin, y, contentWidth, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(config.label, margin + 5, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...config.accentColor);
  doc.text(config.sublabel, margin + 5, y + 12.5);
  doc.text(config.normativeRef, margin + 5, y + 17);

  y += 26;

  // ═══════════════════════════════════════════════════
  // 2. Banner de Título
  // ═══════════════════════════════════════════════════
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 7, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('ANEXO DE CADASTRO E RATEIO DE CRÉDITOS — SISTEMA DE COMPENSAÇÃO DE ENERGIA (SCEE)', pageWidth / 2, y + 4.8, { align: 'center' });

  y += 10;

  // ═══════════════════════════════════════════════════
  // 3. Seção 1: Dados da Unidade Geradora (UCP)
  // ═══════════════════════════════════════════════════
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('1. DADOS DA UNIDADE CONSUMIDORA GERADORA (UCP):', margin, y);

  y += 3;

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    margin: { left: margin, right: margin },
    head: [
      ['CÓDIGO DA UC GERADORA', 'TITULAR / RAZÃO SOCIAL', 'CPF / CNPJ', 'MODALIDADE DE GD'],
    ],
    headStyles: {
      fillColor: config.primaryColor,
      textColor: 255,
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 2,
    },
    body: [
      [
        { content: data.generatorUc || 'A definir', styles: { fontStyle: 'bold', halign: 'center', fontSize: 8.5 } },
        { content: data.generatorName || 'Não informado', styles: { fontSize: 8 } },
        { content: data.generatorDocument || 'Não informado', styles: { fontStyle: 'bold', halign: 'center', fontSize: 8 } },
        { content: data.gdType || 'Autoconsumo remoto', styles: { fontStyle: 'bold', halign: 'center', fontSize: 8 } },
      ],
      [
        { content: `Endereço: ${data.generatorAddress}`, colSpan: 4, styles: { fontSize: 7, textColor: [71, 85, 105] } },
      ],
      [
        {
          content: `Potência Instalada: ${data.totalDcPowerKwp.toFixed(2)} kWp (CC) / ${data.totalAcPowerKw.toFixed(2)} kW (CA)  |  Geração Média Estimada: ${data.monthlyGenerationKwh} kWh/mês`,
          colSpan: 4,
          styles: { fontSize: 7.5, fontStyle: 'bold', fillColor: [248, 250, 252], halign: 'center' },
        },
      ],
    ],
    bodyStyles: { cellPadding: 2.2 },
  });

  y = (doc as any).lastAutoTable.finalY + 5;

  // ═══════════════════════════════════════════════════
  // 4. Declaração Formal nos termos da Lei 14.300 e REN 1.000
  // ═══════════════════════════════════════════════════
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 12, 1, 1, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  const declarationText = `O titular acima qualificado solicita à distribuidora a alocação e o rateio do excedente de energia elétrica gerado pela UC nº ${data.generatorUc || '___'}, nos termos da Lei Federal nº 14.300/2022 e da Resolução Normativa ANEEL nº 1.000/2021, entre as unidades consumidoras beneficiárias descritas na matriz abaixo:`;
  const splitDec = doc.splitTextToSize(declarationText, contentWidth - 6);
  doc.text(splitDec, margin + 3, y + 4.5);

  y += 15;

  // ═══════════════════════════════════════════════════
  // 5. Seção 2: Matriz de Rateio das UCs Beneficiárias (UCBs)
  // ═══════════════════════════════════════════════════
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('2. MATRIZ DE PERCENTUAIS DE RATEIO DE CRÉDITOS DE ENERGIA:', margin, y);

  y += 3;

  const tableRows = data.beneficiaries.map((b, idx) => {
    const isGen = b.isGenerator || b.utilityId.replace(/\D/g, '') === data.generatorUc.replace(/\D/g, '');
    const desc = isGen ? 'UC Geradora Principal (Local)' : b.description || `Beneficiária ${idx + 1}`;
    const pct = Number(b.percentage) || 0;
    const estKwh = Math.round((data.monthlyGenerationKwh * pct) / 100);
    const avgCons = Number(b.averageConsumptionKwh) || 0;

    return [
      `${idx + 1}`,
      b.utilityId.replace(/\D/g, '') || '-',
      b.document || data.generatorDocument || '-',
      desc,
      avgCons > 0 ? `${avgCons} kWh` : '-',
      `${pct.toFixed(2)}%`,
      `${estKwh} kWh`,
      data.isValid ? 'CONFORME' : 'VERIFICAR',
    ];
  });

  // Linha de total
  const totalRow = [
    '',
    'TOTAL GERAL',
    '',
    '',
    '',
    `${data.totalPercentage.toFixed(2)}%`,
    `${data.monthlyGenerationKwh} kWh`,
    data.isValid ? '100% ALOCADO' : 'PENDENTE',
  ];

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    margin: { left: margin, right: margin },
    head: [
      ['Nº', 'CÓDIGO DA UC', 'CPF / CNPJ DO TITULAR', 'IDENTIFICAÇÃO / ENDEREÇO', 'CONSUMO MÉDIO', '% RATEIO', 'CRÉDITO ESTIMADO', 'STATUS'],
    ],
    headStyles: {
      fillColor: config.primaryColor,
      textColor: 255,
      fontSize: 6.8,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 2,
    },
    body: [...tableRows, totalRow],
    bodyStyles: {
      fontSize: 6.8,
      textColor: [30, 41, 59],
      cellPadding: 1.6,
      halign: 'center',
    },
    didParseCell: function (hook) {
      if (hook.row.index === tableRows.length) {
        hook.cell.styles.fontStyle = 'bold';
        hook.cell.styles.fillColor = [241, 245, 249];
        if (hook.column.index === 5 || hook.column.index === 7) {
          hook.cell.styles.textColor = data.isValid ? [22, 101, 52] : [185, 28, 28];
        }
      }
      if (hook.column.index === 7 && hook.section === 'body') {
        const txt = String(hook.cell.raw || '');
        if (txt.includes('CONFORME') || txt.includes('100%')) {
          hook.cell.styles.textColor = [22, 101, 52];
          hook.cell.styles.fontStyle = 'bold';
        } else {
          hook.cell.styles.textColor = [185, 28, 28];
          hook.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // ═══════════════════════════════════════════════════
  // 6. Bloco da Unidade Âncora e Regras
  // ═══════════════════════════════════════════════════
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    margin: { left: margin, right: margin },
    body: [
      [
        { content: 'Unidade Âncora (Prioritária):', styles: { fontStyle: 'bold', fontSize: 7, fillColor: [248, 250, 252], width: 42 } },
        { content: data.anchorUc ? `UC nº ${data.anchorUc}` : 'Não indicada (Diferenças residuais alocadas na UC Geradora Principal)', styles: { fontSize: 7 } },
      ],
      [
        {
          content: 'Nota Técnica: Conforme REN ANEEL 1.000/2021, alterações nos percentuais de rateio devem ser solicitadas à distribuidora com antecedência mínima de 60 (sessenta) dias da data de faturamento.',
          colSpan: 2,
          styles: { fontSize: 6.2, fontStyle: 'italic', textColor: [100, 116, 139] },
        },
      ],
    ],
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // ═══════════════════════════════════════════════════
  // 7. Bloco de Assinaturas (Titular e Responsável Técnico)
  // ═══════════════════════════════════════════════════
  const colWidth = (contentWidth - 10) / 2;

  // Assinatura Titular
  doc.setDrawColor(148, 163, 184);
  doc.line(margin, y, margin + colWidth, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(data.generatorName || 'Titular da UC Geradora', margin + colWidth / 2, y + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`CPF/CNPJ: ${data.generatorDocument || '___________________'}`, margin + colWidth / 2, y + 7.5, { align: 'center' });
  doc.text('Titular / Outorgante', margin + colWidth / 2, y + 11, { align: 'center' });

  // Assinatura Responsável Técnico
  const rep = project.companyProfile?.legalRepresentative;
  const rtName = rep?.name || project.engineer?.name || 'Responsável Técnico';
  const rtReg = rep?.creaCft || project.engineer?.crea || 'CREA/CFT';

  doc.line(margin + colWidth + 10, y, margin + contentWidth, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(rtName, margin + colWidth + 10 + colWidth / 2, y + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Registro: ${rtReg}`, margin + colWidth + 10 + colWidth / 2, y + 7.5, { align: 'center' });
  doc.text('Responsável Técnico do Projeto', margin + colWidth + 10 + colWidth / 2, y + 11, { align: 'center' });

  const dataAtual = new Date().toLocaleDateString('pt-BR');
  doc.setFontSize(6.5);
  doc.text(`Data de Emissão: ${dataAtual}`, pageWidth / 2, y + 18, { align: 'center' });

  // Rodapé Oficial
  doc.setFontSize(5.8);
  doc.setTextColor(148, 163, 184);
  doc.text(`SolarCAD — Matriz Oficial de Rateio de Créditos GD (${config.normativeRef})`, margin, 290);
  doc.text('Página 1 de 1', pageWidth - margin, 290, { align: 'right' });

  return { fileName, doc };
}

/**
 * Preenche e exporta a planilha Excel estruturada de Rateio Multi-Concessionária
 */
export async function generateCreditMatrixExcel(project: ProjectState): Promise<{ fileName: string; buffer: ArrayBuffer }> {
  const data = extractCreditMatrixData(project);
  const config = getUtilityMatrixConfig(data.utility);
  const cleanName = sanitizeClientFileName(data.generatorName);
  const fileName = `${cleanName}_Matriz_Rateio_${config.fileTag}.xlsx`;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SolarCAD - Homologação Fotovoltaica';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Matriz de Rateio GD', {
    pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  // 1. Cabeçalho Corporativo
  ws.mergeCells('A1:G1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `${config.label} — SISTEMA DE COMPENSAÇÃO DE ENERGIA ELÉTRICA (SCEE)`;
  titleCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: config.headerHex } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;

  ws.mergeCells('A2:G2');
  const subCell = ws.getCell('A2');
  subCell.value = `${config.sublabel} | ${config.normativeRef}`;
  subCell.font = { name: 'Arial', size: 8.5, italic: true, color: { argb: 'FF334155' } };
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 18;

  // 2. Dados da Unidade Geradora (UCP)
  ws.mergeCells('A4:G4');
  const sec1 = ws.getCell('A4');
  sec1.value = '1. IDENTIFICAÇÃO DA UNIDADE CONSUMIDORA GERADORA (UCP)';
  sec1.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
  sec1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
  ws.getRow(4).height = 20;

  ws.getCell('A5').value = 'Código da UC:';
  ws.getCell('B5').value = data.generatorUc || 'Não informado';
  ws.getCell('C5').value = 'Titular:';
  ws.getCell('D5').value = data.generatorName;
  ws.getCell('E5').value = 'CPF / CNPJ:';
  ws.getCell('F5').value = data.generatorDocument;
  ws.getCell('G5').value = data.gdType;
  ws.getRow(5).font = { name: 'Arial', size: 8.5 };

  ws.getCell('A6').value = 'Endereço:';
  ws.mergeCells('B6:G6');
  ws.getCell('B6').value = data.generatorAddress;
  ws.getRow(6).font = { name: 'Arial', size: 8.5 };

  ws.getCell('A7').value = 'Potência Instalada:';
  ws.getCell('B7').value = `${data.totalDcPowerKwp.toFixed(2)} kWp (CC)`;
  ws.getCell('C7').value = 'Potência CA:';
  ws.getCell('D7').value = `${data.totalAcPowerKw.toFixed(2)} kW (CA)`;
  ws.getCell('E7').value = 'Geração Média:';
  ws.getCell('F7').value = `${data.monthlyGenerationKwh} kWh/mês`;
  ws.getRow(7).font = { name: 'Arial', size: 8.5, bold: true };

  // 3. Tabela de Beneficiárias
  ws.mergeCells('A9:G9');
  const sec2 = ws.getCell('A9');
  sec2.value = '2. MATRIZ DE DISTRIBUIÇÃO E PERCENTUAIS DE RATEIO DE CRÉDITOS';
  sec2.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
  sec2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: config.headerHex } };
  ws.getRow(9).height = 20;

  const headerRow = ws.getRow(10);
  headerRow.values = [
    'Nº',
    'Código da UC',
    'CPF / CNPJ',
    'Identificação / Titular',
    'Consumo Médio (kWh)',
    '% do Rateio',
    'Crédito Estimado (kWh)',
  ];
  headerRow.font = { name: 'Arial', size: 8.5, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.height = 22;

  for (let c = 1; c <= 7; c++) {
    const cell = headerRow.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  let startRow = 11;
  data.beneficiaries.forEach((b, idx) => {
    const row = ws.getRow(startRow + idx);
    const isGen = b.isGenerator || b.utilityId.replace(/\D/g, '') === data.generatorUc.replace(/\D/g, '');
    const desc = isGen ? 'UC Geradora Principal (Local)' : b.description || `Beneficiária ${idx + 1}`;
    const pct = (Number(b.percentage) || 0) / 100;
    const avgCons = Number(b.averageConsumptionKwh) || 0;

    row.values = [
      idx + 1,
      b.utilityId.replace(/\D/g, '') || '-',
      b.document || data.generatorDocument || '-',
      desc,
      avgCons > 0 ? avgCons : '-',
      pct,
      Math.round(data.monthlyGenerationKwh * pct),
    ];

    row.font = { name: 'Arial', size: 8.5 };
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(2).alignment = { horizontal: 'center' };
    row.getCell(3).alignment = { horizontal: 'center' };
    row.getCell(5).alignment = { horizontal: 'right' };
    row.getCell(6).alignment = { horizontal: 'right' };
    row.getCell(6).numFmt = '0.00%';
    row.getCell(7).alignment = { horizontal: 'right' };
    row.getCell(7).numFmt = '#,##0';
  });

  const lastBeneficiaryRow = startRow + data.beneficiaries.length - 1;
  const totalRowNum = lastBeneficiaryRow + 1;
  const totalRowExcel = ws.getRow(totalRowNum);

  totalRowExcel.getCell(1).value = '';
  totalRowExcel.getCell(2).value = 'TOTAL DO RATEIO';
  totalRowExcel.getCell(3).value = '';
  totalRowExcel.getCell(4).value = '';
  totalRowExcel.getCell(5).value = '';
  totalRowExcel.getCell(6).value = { formula: `SUM(F${startRow}:F${lastBeneficiaryRow})` };
  totalRowExcel.getCell(6).numFmt = '0.00%';
  totalRowExcel.getCell(7).value = { formula: `SUM(G${startRow}:G${lastBeneficiaryRow})` };
  totalRowExcel.getCell(7).numFmt = '#,##0';

  totalRowExcel.font = { name: 'Arial', size: 9, bold: true };
  for (let c = 1; c <= 7; c++) {
    totalRowExcel.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  }

  // Ajusta larguras das colunas
  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 18;
  ws.getColumn(3).width = 20;
  ws.getColumn(4).width = 32;
  ws.getColumn(5).width = 22;
  ws.getColumn(6).width = 16;
  ws.getColumn(7).width = 24;

  const buffer = await workbook.xlsx.writeBuffer();
  return { fileName, buffer };
}

/**
 * Dispara o download direto do PDF de Rateio Multi-Concessionária
 */
export function downloadCreditMatrixPDF(project: ProjectState): string {
  const { fileName, doc } = generateCreditMatrixPDF(project);
  doc.save(fileName);
  return fileName;
}

/**
 * Dispara o download direto da planilha Excel (.xlsx) de Rateio Multi-Concessionária
 */
export async function downloadCreditMatrixExcel(project: ProjectState): Promise<string> {
  const { fileName, buffer } = await generateCreditMatrixExcel(project);
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return fileName;
}
