import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ProjectState, CompanyProfile } from '@/types';

/**
 * Gera o documento formal em PDF de Procuração Específica para Homologação GD (Lei 14.300 / REN 1.000 ANEEL)
 */
export function generatePowerOfAttorneyPDF(
  project: ProjectState,
  company: CompanyProfile
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;

  const client = project.client;
  const rep = company.legalRepresentative;
  const utility = project.technical.utility;

  const utilityNames: Record<string, string> = {
    LIGHT: 'LIGHT SERVIÇOS DE ELETRICIDADE S.A.',
    ENEL_RJ: 'ENEL DISTRIBUIÇÃO RIO (AMPLA ENERGIA E SERVIÇOS S.A.)',
    CERCI: 'COOPERATIVA DE ELETRIFICAÇÃO RURAL DE CANTAGALO (CERCI)',
    ENERGISA: 'ENERGISA MINAS RIO / ENERGISA DISTRIBUIÇÃO S.A.',
  };

  const utilityFull = utilityNames[utility] || utility || 'CONCESSIONÁRIA LOCAL DE ENERGIA ELÉTRICA';

  // --- Cabeçalho Corporativo ---
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('INSTRUMENTO PARTICULAR DE PROCURAÇÃO', pageWidth / 2, 12, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // Slate 300
  doc.text('HOMOLOGAÇÃO DE MICROGERAÇÃO / MINIGERAÇÃO DISTRIBUÍDA — LEI 14.300/2022', pageWidth / 2, 19, { align: 'center' });
  doc.text('RESOLUÇÃO NORMATIVA ANEEL Nº 1.000/2021', pageWidth / 2, 24, { align: 'center' });

  let y = 36;

  // --- Seção 1: OUTORGANTE (Titular da UC / Cliente) ---
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('1. OUTORGANTE (TITULAR DA UNIDADE CONSUMIDORA):', margin, y);
  y += 4;

  const clientAddressStr = client.address
    ? `${client.address.street || 'Logradouro'}, nº ${client.address.number || 'S/N'}, ${client.address.neighborhood || ''}, ${client.address.city || ''} - ${client.address.state || 'RJ'}, CEP: ${client.address.zipCode || ''}`
    : 'Não informado';

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
    body: [
      [
        { content: `Nome/Razão Social: ${client.name || 'Não informado'}`, colSpan: 2 },
        { content: `CPF/CNPJ: ${client.document || 'Não informado'}` },
      ],
      [
        { content: `Código do Cliente / UC: ${client.utilityId || 'A definir'}`, colSpan: 1 },
        { content: `Telefone: ${client.phone || 'Não informado'}` },
        { content: `E-mail: ${client.email || 'Não informado'}` },
      ],
      [
        { content: `Endereço da Instalação: ${clientAddressStr}`, colSpan: 3 },
      ],
    ],
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // --- Seção 2: OUTORGADOS (Empresa Integradora & Procurador Legal) ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('2. OUTORGADOS (EMPRESA INTEGRADORA E PROCURADOR TÉCNICO):', margin, y);
  y += 4;

  const companyAddressStr = company.address
    ? `${company.address.street || ''}, nº ${company.address.number || ''}, ${company.address.neighborhood || ''}, ${company.address.city || ''} - ${company.address.state || 'RJ'}, CEP: ${company.address.zipCode || ''}`
    : 'Não informado';

  const repDetails = `${rep.name || 'Responsável Técnico'}, ${rep.qualification || 'Engenheiro/Técnico Responsável'}, inscrito no CPF sob nº ${rep.cpf || 'Não informado'}, RG nº ${rep.rg || ''} (${rep.rgIssuer || 'Órgão Emissor'}), Registro Profissional ${rep.creaCft || 'Não informado'}/${rep.creaState || 'RJ'}${rep.rnp ? ` (RNP: ${rep.rnp})` : ''}.`;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
    body: [
      [
        { content: `Empresa Integradora: ${company.companyName || company.tradeName || 'EMPRESA INTEGRADORA SOLAR'}`, colSpan: 2 },
        { content: `CNPJ: ${company.cnpj || 'Não informado'}` },
      ],
      [
        { content: `Endereço Comercial: ${companyAddressStr}`, colSpan: 2 },
        { content: `Telefone: ${company.phone || rep.phone || 'Não informado'}` },
      ],
      [
        { content: `Procurador Legal & Responsável Técnico:\n${repDetails}`, colSpan: 3 },
      ],
    ],
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // --- Seção 3: PODERES E FINALIDADE ESPECÍFICA ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('3. FINALIDADE E PODERES CONFERIDOS:', margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);

  const powerText = `Pelo presente instrumento particular de procuração, o(a) OUTORGANTE nomeia e constitui o(a) OUTORGADO(A) como seu(sua) bastante procurador(a) com a finalidade exclusiva de representá-lo(a) perante a distribuidora de energia elétrica ${utilityFull}, bem como perante os órgãos reguladores e fiscalizadores competentes (ANEEL, CREA/CFT e Prefeituras), conferindo-lhe poderes específicos para:

a) Solicitar Consulta de Acesso, Parecer de Acesso e Vistoria para conexão de sistema de Microgeração ou Minigeração Distribuída (GD) na Unidade Consumidora supracitada;
b) Assinar e protocolar Formulários de Acesso, Memoriais Descritivos, Anotações de Responsabilidade Técnica (ART/TRT), Diagramas Unifilares, Desenhos Técnicos e demais documentos de engenharia;
c) Requerer inspeções, testes de conformidade, vistoria técnica e a substituição do sistema de medição para medidor bidirecional;
d) Receber notificações, notificações de exigências técnicas, orientações, pareceres e assinar o Acordo de Acesso / Termo de Relacionamento Operacional (TRO);
e) Solicitar e acompanhar o rateio e transferência de créditos de energia solar decorrentes da Lei Federal nº 14.300/2022 para Unidades Consumidoras Beneficiárias de mesma titularidade ou cooperadas/consorciadas;
f) Acessar histórico de consumo e faturas da referida Unidade Consumidora exclusivamente para instrução do dimensionamento e homologação técnica.`;

  const splitPowers = doc.splitTextToSize(powerText, contentWidth);
  doc.text(splitPowers, margin, y);
  y += splitPowers.length * 3.8 + 4;

  // --- Seção 4: VALIDADE E LOCAL ---
  const today = new Date();
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const dateStr = `${client.address?.city || company.address?.city || 'Rio de Janeiro'}, ${today.getDate()} de ${months[today.getMonth()]} de ${today.getFullYear()}.`;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Esta procuração é válida pelo prazo de 12 (doze) meses a contar da data de sua assinatura, sendo vedado o substabelecimento sem expressa anuência.', margin, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(dateStr, pageWidth / 2, y, { align: 'center' });
  y += 16;

  // --- Seção 5: ASSINATURAS ---
  const colWidth = (contentWidth - 16) / 2;

  // Linha Outorgante
  doc.setDrawColor(100, 116, 139);
  doc.line(margin, y, margin + colWidth, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(client.name || 'OUTORGANTE (CLIENTE)', margin + colWidth / 2, y + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`CPF/CNPJ: ${client.document || 'Assinatura Digital / Gov.br'}`, margin + colWidth / 2, y + 8, { align: 'center' });

  // Linha Outorgado
  doc.line(margin + colWidth + 16, y, pageWidth - margin, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(rep.name || company.companyName || 'OUTORGADO (PROCURADOR)', margin + colWidth + 16 + colWidth / 2, y + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`CREA/CFT: ${rep.creaCft || 'Procurador Responsável'}`, margin + colWidth + 16 + colWidth / 2, y + 8, { align: 'center' });

  // Rodapé
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Documento gerado automaticamente pelo SolarCAD Desktop — Suíte Profissional de Homologação GD', pageWidth / 2, pageHeight - 6, { align: 'center' });

  return doc;
}

/**
 * Dispara o download da Procuração GD em PDF
 */
export function downloadPowerOfAttorneyPDF(
  project: ProjectState,
  company: CompanyProfile
): void {
  const doc = generatePowerOfAttorneyPDF(project, company);
  const clientName = (project.client.name || 'Cliente').replace(/\s+/g, '_');
  const utility = project.technical.utility || 'Concessionaria';
  doc.save(`${clientName}_Procuracao_Homologacao_${utility}.pdf`);
}
