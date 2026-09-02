/**
 * Serviço de Geração do Formulário Oficial de Rateio de Créditos da ENEL Distribuição Rio
 * Baseado fielmente na planilha oficial: Formulario_Rateio_ENEL_Rj.xlsm
 * Normativas: Lei 14.300/2022 e Resolução Normativa ANEEL nº 1.000/2021.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { ProjectState, CreditBeneficiary, GDType } from '../types';
import { ENEL_RATEIO_TEMPLATE_BASE64 } from '../assets/templates/enelRateioTemplateBase64';

export interface EnelRateioFormData {
  generatorUc: string;
  generatorDocument: string;
  generatorName: string;
  gdType: GDType;
  anchorUc?: string;
  beneficiaries: CreditBeneficiary[];
}

/**
 * Sanitiza o nome do arquivo
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
 * Converte string base64 para Uint8Array no browser e Node.js
 */
function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
  // Fallback para Node.js / Vitest
  const buf = Buffer.from(base64, 'base64');
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

/**
 * Normaliza os dados do formulário a partir do ProjectState
 */
export function extractEnelRateioFormData(project: ProjectState): EnelRateioFormData {
  const generatorUc = (project.client.utilityId || '').replace(/\D/g, '');
  const generatorDoc = project.client.document || '';
  const generatorName = project.client.name || 'Cliente';
  const gdType = project.gdType || 'Autoconsumo remoto';

  const rawBeneficiaries = project.creditBeneficiaries || [];

  // Garante que a lista de participantes inclua a UC Geradora se o usuário não a tiver adicionado
  let beneficiaries = [...rawBeneficiaries];
  const hasGeneratorInList = beneficiaries.some(b => b.isGenerator || b.utilityId.replace(/\D/g, '') === generatorUc);

  if (!hasGeneratorInList && generatorUc) {
    beneficiaries = [
      {
        id: 'gen-auto',
        utilityId: generatorUc,
        document: generatorDoc,
        description: 'UC Geradora (Local)',
        percentage: 0,
        isGenerator: true,
      },
      ...beneficiaries,
    ];
  }

  // Identifica unidade âncora (se houver)
  const anchorItem = beneficiaries.find(b => (b as any).isAnchor);
  const anchorUc = anchorItem ? anchorItem.utilityId.replace(/\D/g, '') : '';

  return {
    generatorUc,
    generatorDocument: generatorDoc,
    generatorName,
    gdType,
    anchorUc,
    beneficiaries,
  };
}

/**
 * Valida a integridade do rateio conforme regras da planilha ENEL RJ (Tabela334)
 */
export function validateEnelRateio(data: EnelRateioFormData): { isValid: boolean; totalPercentage: number; message: string } {
  const totalPercentage = data.beneficiaries.reduce((sum, b) => sum + (Number(b.percentage) || 0), 0);
  const is100 = Math.abs(totalPercentage - 100) < 0.01;

  if (!is100) {
    return {
      isValid: false,
      totalPercentage,
      message: `A soma dos percentuais de rateio é ${totalPercentage.toFixed(2)}% (deve ser exatamente 100,00%).`,
    };
  }

  // Validação de titularidade para Autoconsumo Remoto e Consumo Local
  if (data.gdType === 'Autoconsumo remoto' || data.gdType === 'Consumo local') {
    const genDocRoot = data.generatorDocument.replace(/\D/g, '').slice(0, 8); // Raiz de CPF/CNPJ
    for (const b of data.beneficiaries) {
      if (b.percentage > 0) {
        const bDocRoot = (b.document || data.generatorDocument).replace(/\D/g, '').slice(0, 8);
        if (genDocRoot && bDocRoot && genDocRoot !== bDocRoot) {
          return {
            isValid: false,
            totalPercentage,
            message: `Para ${data.gdType}, todas as UCs beneficiárias devem ter o mesmo titular (mesma raiz de CPF/CNPJ).`,
          };
        }
      }
    }
  }

  return {
    isValid: true,
    totalPercentage: 100,
    message: 'Solicitação válida conforme regras da Enel RJ.',
  };
}

/**
 * Gera o PDF oficial do Formulário de Rateio da Enel RJ idêntico à planilha oficial
 * Nome do arquivo: "[Nome_do_cliente]_Formulário_Rateio_ENEL_Rj.pdf"
 */
export function generateEnelRateioPDF(project: ProjectState): { fileName: string; doc: jsPDF } {
  const data = extractEnelRateioFormData(project);
  const cleanName = sanitizeClientFileName(data.generatorName);
  const fileName = `${cleanName}_Formulário_Rateio_ENEL_Rj.pdf`;

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
  // 1. Cabeçalho Oficial Enel Distribuição Rio
  // ═══════════════════════════════════════════════════
  // Badge INTERNAL
  doc.setFillColor(71, 85, 105);
  doc.rect(margin, y, 22, 5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('INTERNAL', margin + 3, y + 3.8);

  // Endereço Corporativo Enel RJ (Lado Direito)
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Enel Distribuição Rio de Janeiro', pageWidth - margin, y + 4, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Av. Oscar Niemeyer, nº 2000, Bloco 01 - Sala 701', pageWidth - margin, y + 7.5, { align: 'right' });
  doc.text('Aqwa Corporate, Santo Cristo, CEP: 20220-297 - Rio de Janeiro - RJ', pageWidth - margin, y + 11, { align: 'right' });

  // Versão do Formulário
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Versão do Formulário: 04/06/2025', margin, y + 11);

  y += 16;

  // ═══════════════════════════════════════════════════
  // 2. Banner de Título Oficial
  // ═══════════════════════════════════════════════════
  doc.setFillColor(220, 38, 38); // Enel Red primary banner
  doc.rect(margin, y, contentWidth, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Formulário de Solicitação de Rateio – GD', pageWidth / 2, y + 6.8, { align: 'center' });

  y += 14;

  // ═══════════════════════════════════════════════════
  // 3. Seção 1: Identificação da Unidade Consumidora Geradora
  // ═══════════════════════════════════════════════════
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('1. Identificação da Unidade Consumidora Geradora:', margin, y);

  y += 3;

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    margin: { left: margin, right: margin },
    head: [
      [
        'CÓDIGO DA UC:\n(Unidade Consumidora):\nSem dígito',
        'CPF/CNPJ\n(Do titular da Unidade Consumidora):\nNúmeros com pontos e traço',
        'Qual tipo de Geração Distribuída\né utilizada pela Unidade Geradora?',
      ],
    ],
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [30, 41, 59],
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      cellPadding: 2,
    },
    body: [
      [
        { content: data.generatorUc || 'Não informado', styles: { fontStyle: 'bold', fontSize: 8.5, textColor: [185, 28, 28], halign: 'center' } },
        { content: data.generatorDocument || 'Não informado', styles: { fontStyle: 'bold', fontSize: 8, halign: 'center' } },
        { content: data.gdType || 'Autoconsumo remoto', styles: { fontStyle: 'bold', fontSize: 8, halign: 'center' } },
      ],
    ],
    bodyStyles: {
      cellPadding: 3,
    },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // ═══════════════════════════════════════════════════
  // 4. Declaração Formal nos termos da REN ANEEL 1.000/2021
  // ═══════════════════════════════════════════════════
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 14, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  const declarationText = `Solicito que o excedente de energia injetada na rede pela unidade consumidora geradora nº ${data.generatorUc || '___'} esteja disponível para alocação nos termos da REN ANEEL 1.000/2021, e seja rateada entre as unidades consumidoras abaixo relacionadas, conforme percentuais discriminados.`;
  const splitDec = doc.splitTextToSize(declarationText, contentWidth - 6);
  doc.text(splitDec, margin + 3, y + 5);

  y += 18;

  // ═══════════════════════════════════════════════════
  // 5. Seção 2: Lista de UCs Participantes e Percentuais de Rateio
  // ═══════════════════════════════════════════════════
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('2. Lista de unidades consumidoras participantes do sistema de compensação indicando a porcentagem de rateio dos créditos e o enquadramento:', margin, y);

  y += 3;

  const validation = validateEnelRateio(data);

  const tableRows = data.beneficiaries.map((b, idx) => {
    const isGen = b.isGenerator || b.utilityId.replace(/\D/g, '') === data.generatorUc;
    const desc = isGen ? 'UC Geradora (Local)' : b.description || `UC Beneficiária ${idx + 1}`;
    const pct = Number(b.percentage) || 0;
    const statusLabel = validation.isValid ? 'OK' : 'CORRIGIR';

    return [
      `${idx + 1}`,
      b.utilityId.replace(/\D/g, '') || '-',
      b.document || data.generatorDocument || '-',
      `${pct.toFixed(2)}%`,
      statusLabel,
      desc,
    ];
  });

  // Linha de total
  const totalRow = [
    '',
    'TOTAL DO RATEIO',
    '',
    `${validation.totalPercentage.toFixed(2)}%`,
    validation.isValid ? 'OK' : 'CORRIGIR',
    validation.isValid ? '100% ALOCADO' : 'PENDENTE DE AJUSTE',
  ];

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    margin: { left: margin, right: margin },
    head: [
      ['Nº', 'UC\n(Unidade Consumidora - Sem dígito)', 'CPF/CNPJ\nNúmeros com pontos e traço', '% do Rateio', 'Solicitação válida?', 'Identificação / Enquadramento'],
    ],
    headStyles: {
      fillColor: [220, 38, 38],
      textColor: 255,
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 2,
    },
    body: [...tableRows, totalRow],
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
      cellPadding: 1.8,
      halign: 'center',
    },
    didParseCell: function (dataHook) {
      if (dataHook.row.index === tableRows.length) {
        dataHook.cell.styles.fontStyle = 'bold';
        dataHook.cell.styles.fillColor = [241, 245, 249];
        if (dataHook.column.index === 3 || dataHook.column.index === 4) {
          dataHook.cell.styles.textColor = validation.isValid ? [22, 101, 52] : [185, 28, 28];
        }
      }
      if (dataHook.column.index === 4 && dataHook.section === 'body') {
        const txt = dataHook.cell.raw as string;
        if (txt === 'OK') {
          dataHook.cell.styles.textColor = [22, 101, 52];
          dataHook.cell.styles.fontStyle = 'bold';
        } else if (txt === 'CORRIGIR') {
          dataHook.cell.styles.textColor = [185, 28, 28];
          dataHook.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // ═══════════════════════════════════════════════════
  // 6. Bloco da Unidade Âncora e Avisos Oficiais
  // ═══════════════════════════════════════════════════
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    margin: { left: margin, right: margin },
    body: [
      [
        { content: 'Unidade Âncora:', styles: { fontStyle: 'bold', fontSize: 7.5, fillColor: [248, 250, 252], width: 35 } },
        { content: data.anchorUc ? `UC nº ${data.anchorUc}` : 'Não indicada (Diferença alocada na UC Geradora)', styles: { fontSize: 7.5 } },
      ],
      [
        {
          content: 'Importante: Caso não seja indicada uma âncora, a diferença será alocada na unidade geradora, não podendo ser rateada novamente.',
          colSpan: 2,
          styles: { fontSize: 6.5, fontStyle: 'italic', textColor: [100, 116, 139] },
        },
      ],
    ],
  });

  y = (doc as any).lastAutoTable.finalY + 12;

  // ═══════════════════════════════════════════════════
  // 7. Bloco de Assinatura do Titular
  // ═══════════════════════════════════════════════════
  const sigWidth = 80;
  const sigX = margin + (contentWidth - sigWidth) / 2;

  doc.setDrawColor(148, 163, 184);
  doc.line(sigX, y, sigX + sigWidth, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(data.generatorName || 'Titular da Unidade Geradora', pageWidth / 2, y + 4.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`CPF/CNPJ: ${data.generatorDocument || '___________________'}`, pageWidth / 2, y + 8, { align: 'center' });

  const dataAtual = new Date().toLocaleDateString('pt-BR');
  doc.text(`Rio de Janeiro - RJ, ${dataAtual}`, pageWidth / 2, y + 12.5, { align: 'center' });

  // Rodapé Oficial
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text('SolarCAD — Formulário Oficial Enel Distribuição Rio de Janeiro (Lei 14.300 / REN ANEEL 1.000/2021)', margin, 290);
  doc.text('Página 1 de 1', pageWidth - margin, 290, { align: 'right' });

  return { fileName, doc };
}

/**
 * Preenche e exporta a planilha Excel oficial da ENEL RJ (.xlsm / .xlsx)
 * CARREGANDO DIRETAMENTE O TEMPLATE ORIGINAL Formulario_Rateio_ENEL_Rj.xlsm
 * Preserva 100% da formatação, fontes, cores, fórmulas, bordas e abas da Enel RJ.
 */
export async function generateEnelRateioExcel(project: ProjectState): Promise<{ fileName: string; buffer: ArrayBuffer }> {
  const data = extractEnelRateioFormData(project);
  const cleanName = sanitizeClientFileName(data.generatorName);
  const fileName = `${cleanName}_Formulario_Rateio_ENEL_Rj.xlsm`;

  const workbook = new ExcelJS.Workbook();
  const templateBytes = base64ToUint8Array(ENEL_RATEIO_TEMPLATE_BASE64);
  await workbook.xlsx.load(templateBytes);

  const ws = workbook.getWorksheet('Planilha de Cadastro do Rateio') || workbook.worksheets[0];

  // 1. Identificação da Unidade Consumidora Geradora
  ws.getCell('C10').value = data.generatorUc || '';
  ws.getCell('G10').value = data.generatorDocument || '';
  ws.getCell('M10').value = data.gdType || 'Autoconsumo remoto';

  // 2. Preenchimento da Tabela de UCs Participantes (Linhas a partir de 23)
  data.beneficiaries.forEach((b, idx) => {
    const rowNum = 23 + idx;
    ws.getCell(`A${rowNum}`).value = idx + 1;
    ws.getCell(`B${rowNum}`).value = b.utilityId.replace(/\D/g, '');
    ws.getCell(`C${rowNum}`).value = b.document || data.generatorDocument;
    ws.getCell(`D${rowNum}`).value = (Number(b.percentage) || 0) / 100; // Porcentagem decimal (ex: 0.40 para 40%)
  });

  // Limpa linhas excedentes caso o projeto tenha menos de 10 participantes
  for (let r = 23 + data.beneficiaries.length; r <= 32; r++) {
    ws.getCell(`B${r}`).value = null;
    ws.getCell(`C${r}`).value = null;
    ws.getCell(`D${r}`).value = null;
  }

  // 3. Unidade Âncora (H27)
  if (data.anchorUc) {
    ws.getCell('H27').value = data.anchorUc;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return { fileName, buffer };
}

/**
 * Dispara o download direto do PDF de Rateio da Enel RJ
 */
export function downloadEnelRateioPDF(project: ProjectState): string {
  const { fileName, doc } = generateEnelRateioPDF(project);
  doc.save(fileName);
  return fileName;
}

/**
 * Dispara o download direto da planilha Excel (.xlsm) de Rateio da Enel RJ preenchida no template original
 */
export async function downloadEnelRateioExcel(project: ProjectState): Promise<string> {
  const { fileName, buffer } = await generateEnelRateioExcel(project);
  const blob = new Blob([buffer], { type: 'application/vnd.ms-excel.sheet.macroEnabled.12' });
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

/**
 * Alias padronizado para download do formulário de rateio da Enel
 */
export function downloadEnelFormPDF(project: ProjectState): void {
  downloadEnelRateioPDF(project);
}
