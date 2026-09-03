import jsPDF from 'jspdf';
import { ProjectState, CompanyProfile } from '@/types';

/**
 * Gera o documento formal em PDF de Procuração Específica para Homologação GD
 * Padrão Jurídico Executivo ABNT / Lei 14.300/2022 e REN ANEEL 1.000/2021
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
  const margin = 16;
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

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. CABEÇALHO EXECUTIVO INSTITUCIONAL
  // ─────────────────────────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 26, 'F');

  // Friso dourado / âmbar decorativo
  doc.setFillColor(217, 119, 6); // Amber 600
  doc.rect(0, 26, pageWidth, 1.2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('INSTRUMENTO PARTICULAR DE PROCURAÇÃO ESPECÍFICA', pageWidth / 2, 10.5, { align: 'center' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240); // Slate 200
  doc.text('HOMOLOGAÇÃO DE MICROGERAÇÃO / MINIGERAÇÃO DISTRIBUÍDA SOLAR FOTOVOLTAICA', pageWidth / 2, 16.5, { align: 'center' });

  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225); // Slate 300
  doc.text('LEI FEDERAL Nº 14.300/2022 • RESOLUÇÃO NORMATIVA ANEEL Nº 1.000/2021', pageWidth / 2, 21.5, { align: 'center' });

  let y = 33;

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. SEÇÃO 1: OUTORGANTE (TITULAR DA UNIDADE CONSUMIDORA)
  // ─────────────────────────────────────────────────────────────────────────────
  const cardPad = 3.5;
  const clientAddressStr = client.address
    ? `${client.address.street || 'Logradouro'}, nº ${client.address.number || 'S/N'}${client.address.complement ? `, ${client.address.complement}` : ''}, ${client.address.neighborhood || ''}, ${client.address.city || ''} - ${client.address.state || 'RJ'}, CEP: ${client.address.zipCode || 'Não informado'}`
    : 'Não informado';

  // Título da Seção
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('1. OUTORGANTE (TITULAR DA UNIDADE CONSUMIDORA):', margin, y);
  y += 3.5;

  // Card do Outorgante
  const card1H = 25;
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, card1H, 1.5, 1.5, 'FD');

  let cy = y + cardPad + 2.5;

  // Linha 1: Nome e CPF/CNPJ
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Nome / Razão Social: ', margin + cardPad, cy);
  const nameW = doc.getTextWidth('Nome / Razão Social: ');
  doc.setFont('helvetica', 'normal');
  doc.text(client.name || 'Não informado', margin + cardPad + nameW, cy);

  const docLabel = 'CPF / CNPJ: ';
  const docVal = client.document || 'Não informado';
  const docW = doc.getTextWidth(docLabel + docVal);
  doc.setFont('helvetica', 'bold');
  doc.text(docLabel, margin + contentWidth - cardPad - docW, cy);
  doc.setFont('helvetica', 'normal');
  doc.text(docVal, margin + contentWidth - cardPad - doc.getTextWidth(docVal), cy);

  cy += 5.5;

  // Linha 2: Código UC, Telefone, E-mail
  doc.setFont('helvetica', 'bold');
  doc.text('Código da Instalação / UC: ', margin + cardPad, cy);
  const ucW = doc.getTextWidth('Código da Instalação / UC: ');
  doc.setFont('helvetica', 'normal');
  doc.text(client.utilityId || 'A definir', margin + cardPad + ucW, cy);

  const telText = `Telefone: ${client.phone || 'Não informado'}   |   E-mail: ${client.email || 'Não informado'}`;
  doc.text(telText, margin + contentWidth - cardPad - doc.getTextWidth(telText), cy);

  cy += 5.5;

  // Linha 3: Endereço da Instalação
  doc.setFont('helvetica', 'bold');
  doc.text('Endereço da Instalação: ', margin + cardPad, cy);
  const endW = doc.getTextWidth('Endereço da Instalação: ');
  doc.setFont('helvetica', 'normal');
  const splitClientAddr = doc.splitTextToSize(clientAddressStr, contentWidth - cardPad * 2 - endW);
  doc.text(splitClientAddr[0] || clientAddressStr, margin + cardPad + endW, cy);

  y += card1H + 5;

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. SEÇÃO 2: OUTORGADOS (EMPRESA INTEGRADORA & PROCURADOR TÉCNICO)
  // ─────────────────────────────────────────────────────────────────────────────
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('2. OUTORGADOS (EMPRESA INTEGRADORA E PROCURADOR TÉCNICO):', margin, y);
  y += 3.5;

  const companyAddressStr = company.address
    ? `${company.address.street || ''}, nº ${company.address.number || ''}${company.address.complement ? `, ${company.address.complement}` : ''}, ${company.address.neighborhood || ''}, ${company.address.city || ''} - ${company.address.state || 'RJ'}, CEP: ${company.address.zipCode || ''}`
    : 'Não informado';

  const repDetails = `${rep.name || 'Responsável Técnico'}, ${rep.qualification || 'Engenheiro Eletricista / Técnico'}, inscrito no CPF sob nº ${rep.cpf || 'Não informado'}, RG nº ${rep.rg || 'Não informado'} (${rep.rgIssuer || 'SSP'}), Registro Profissional ${rep.creaCft || 'Não informado'}/${rep.creaState || 'RJ'}${rep.rnp ? ` (RNP: ${rep.rnp})` : ''}.`;

  const card2H = 34;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, card2H, 1.5, 1.5, 'FD');

  cy = y + cardPad + 2.5;

  // Linha 1: Empresa Integradora e CNPJ
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Empresa Integradora: ', margin + cardPad, cy);
  const empW = doc.getTextWidth('Empresa Integradora: ');
  doc.setFont('helvetica', 'normal');
  doc.text(company.companyName || company.tradeName || 'EMPRESA INTEGRADORA SOLAR', margin + cardPad + empW, cy);

  const cnpjText = `CNPJ: ${company.cnpj || 'Não informado'}`;
  doc.setFont('helvetica', 'bold');
  doc.text(cnpjText, margin + contentWidth - cardPad - doc.getTextWidth(cnpjText), cy);

  cy += 5.5;

  // Linha 2: Endereço Comercial e Telefone
  doc.setFont('helvetica', 'bold');
  doc.text('Endereço Comercial: ', margin + cardPad, cy);
  const cEndW = doc.getTextWidth('Endereço Comercial: ');
  doc.setFont('helvetica', 'normal');
  const splitCompAddr = doc.splitTextToSize(companyAddressStr, contentWidth * 0.65 - cEndW);
  doc.text(splitCompAddr[0] || companyAddressStr, margin + cardPad + cEndW, cy);

  const compPhone = `Telefone: ${company.phone || rep.phone || 'Não informado'}`;
  doc.text(compPhone, margin + contentWidth - cardPad - doc.getTextWidth(compPhone), cy);

  cy += 5.5;

  // Linha 3: Linha divisória interna sutil
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(margin + cardPad, cy, margin + contentWidth - cardPad, cy);
  cy += 3.5;

  // Linha 4: Procurador Legal & Responsável Técnico
  doc.setFont('helvetica', 'bold');
  doc.text('Procurador Legal & Responsável Técnico: ', margin + cardPad, cy);
  cy += 4.2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.0);
  doc.setTextColor(30, 41, 59);
  const splitRep = doc.splitTextToSize(repDetails, contentWidth - cardPad * 2);
  doc.text(splitRep, margin + cardPad, cy);

  y += card2H + 5;

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. SEÇÃO 3: FINALIDADE ESPECÍFICA E PODERES CONFERIDOS
  // ─────────────────────────────────────────────────────────────────────────────
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('3. FINALIDADE E PODERES CONFERIDOS:', margin, y);
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(30, 41, 59);

  const introText = `Pelo presente instrumento particular de procuração, o(a) OUTORGANTE nomeia e constitui o(a) OUTORGADO(A) como seu(sua) bastante procurador(a) com a finalidade específica e exclusiva de representá-lo(a) perante a distribuidora de energia elétrica ${utilityFull}, bem como perante os órgãos reguladores e fiscalizadores competentes (ANEEL, CREA/CFT e Prefeituras), conferindo-lhe amplos poderes para:`;

  const splitIntro = doc.splitTextToSize(introText, contentWidth);
  doc.text(splitIntro, margin, y);
  y += splitIntro.length * 3.7 + 2.5;

  const powersList = [
    { item: 'a)', text: 'Solicitar Consulta de Acesso, Informação de Acesso, Parecer de Acesso e Vistoria Técnica para conexão de sistema de Microgeração ou Minigeração Distribuída (GD) na Unidade Consumidora supracitada;' },
    { item: 'b)', text: 'Assinar e protocolar Formulários de Acesso oficiais, Memoriais Descritivos, Anotações de Responsabilidade Técnica (ART/TRT), Diagramas Unifilares/Multifilares e desenhos técnicos de engenharia;' },
    { item: 'c)', text: 'Requerer inspeções, testes de conformidade, vistoria técnica e a substituição do padrão de medição para medidor bidirecional homologado;' },
    { item: 'd)', text: 'Receber notificações técnicas, responder pedidos de informações, retirar pareceres e assinar o Acordo de Acesso e o Termo de Relacionamento Operacional (TRO);' },
    { item: 'e)', text: 'Solicitar, cadastrar e acompanhar o rateio e a transferência de créditos de energia solar decorrentes da Lei Federal nº 14.300/2022 para Unidades Consumidoras Beneficiárias indicadas pelo titular;' },
    { item: 'f)', text: 'Acessar histórico de consumo e faturas da Unidade Consumidora exclusivamente para instrução do dimensionamento técnico e homologação da usina.' },
  ];

  powersList.forEach(p => {
    doc.setFont('helvetica', 'bold');
    doc.text(p.item, margin + 2, y);
    doc.setFont('helvetica', 'normal');
    const splitP = doc.splitTextToSize(p.text, contentWidth - 8);
    doc.text(splitP, margin + 8, y);
    y += splitP.length * 3.6 + 1.2;
  });

  y += 2.0;

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. SEÇÃO 4: PRAZO DE VALIDADE E DATA
  // ─────────────────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.0);
  doc.setTextColor(71, 85, 105); // Slate 600
  const validText = 'Esta procuração é válida pelo prazo determinado de 12 (doze) meses a contar da data de sua assinatura, sendo vedado o substabelecimento a terceiros sem prévia e expressa anuência do Outorgante.';
  const splitValid = doc.splitTextToSize(validText, contentWidth);
  doc.text(splitValid, margin, y);
  y += splitValid.length * 3.6 + 4;

  const today = new Date();
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const city = client.address?.city || company.address?.city || 'Niterói';
  const state = client.address?.state || company.address?.state || 'RJ';
  const dateStr = `${city} - ${state}, ${today.getDate()} de ${months[today.getMonth()]} de ${today.getFullYear()}.`;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.0);
  doc.setTextColor(15, 23, 42);
  doc.text(dateStr, pageWidth / 2, y, { align: 'center' });
  y += 18;

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. SEÇÃO 5: ASSINATURAS ESPAÇADAS E ALINHADAS
  // ─────────────────────────────────────────────────────────────────────────────
  const colWidth = (contentWidth - 20) / 2;

  // Linha 1: Outorgante (Cliente)
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.35);
  doc.line(margin, y, margin + colWidth, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(client.name || 'OUTORGANTE (TITULAR DA UC)', margin + colWidth / 2, y + 4.2, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`CPF/CNPJ: ${client.document || 'Assinatura Digital / Gov.br'}`, margin + colWidth / 2, y + 8.2, { align: 'center' });
  doc.text('Titular da Unidade Consumidora', margin + colWidth / 2, y + 11.8, { align: 'center' });

  // Linha 2: Outorgado (Empresa / Responsável Técnico)
  const col2X = margin + colWidth + 20;
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.35);
  doc.line(col2X, y, col2X + colWidth, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(rep.name || company.companyName || 'OUTORGADO (PROCURADOR)', col2X + colWidth / 2, y + 4.2, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`CREA/CFT: ${rep.creaCft || 'Procurador Técnico'} | ${company.companyName || 'Empresa Integradora'}`, col2X + colWidth / 2, y + 8.2, { align: 'center' });
  doc.text('Responsável Técnico & Procurador Legal', col2X + colWidth / 2, y + 11.8, { align: 'center' });

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. RODAPÉ DE SEGURANÇA E AUTENTICIDADE
  // ─────────────────────────────────────────────────────────────────────────────
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);

  doc.setFontSize(7.0);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text(
    'SolarCAD Desktop — Suíte Profissional de Homologação GD • Emissão Conforme Lei Federal 14.300/2022 e Resolução Normativa ANEEL 1.000/2021',
    pageWidth / 2,
    pageHeight - 7.5,
    { align: 'center' }
  );

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
