import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ProjectState, UtilityCompany, EquipmentBlock } from '../types';
import { getProjectEngineeringStatus } from './engineering';
import { estimateMonthlyGeneration } from './creditDistribution';
import { getStructureTypeLabel, getAzimuthCardinalLabel } from '../constants';

export const generateMemorialPDF = (project: ProjectState) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;

  const primaryColor = [0, 51, 102] as [number, number, number];

  const drawHeader = () => {
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("MEMORIAL DESCRITIVO", margin, 12);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("MICROGERAÇÃO FOTOVOLTAICA CONECTADA À REDE", margin, 18);
    doc.setFontSize(9);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth - margin, 15, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  };

  const drawFooter = (pageNumber: number) => {
    const footerY = pageHeight - 15;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, footerY, pageWidth - margin, footerY);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`SolarAutoCAD - Suite de Homologação GD`, margin, footerY + 5);
    doc.text(`Página ${pageNumber}`, pageWidth - margin, footerY + 5, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  };

  const checkPageBreak = (neededSpace: number) => {
    if (cursorY + neededSpace > pageHeight - 40) {
      doc.addPage();
      drawHeader();
      cursorY = 35;
    }
  };

  drawHeader();
  let cursorY = 35;

  const addSectionTitle = (text: string) => {
    checkPageBreak(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...primaryColor);
    doc.text(text.toUpperCase(), margin, cursorY);
    doc.setLineWidth(0.5);
    doc.setDrawColor(...primaryColor);
    doc.line(margin, cursorY + 2, pageWidth - margin, cursorY + 2);
    cursorY += 10;
    doc.setTextColor(0, 0, 0);
  };

  // 1. Identification
  addSectionTitle("1. Identificação do Titular e Responsável Técnico");

  autoTable(doc, {
    startY: cursorY,
    head: [],
    body: [
      [{ content: 'Nome do Titular', styles: { fontStyle: 'bold' } }, project.client.name],
      [{ content: 'CPF / CNPJ', styles: { fontStyle: 'bold' } }, project.client.document],
      [{ content: project.technical.utility === UtilityCompany.LIGHT ? 'Código do Cliente' : 'Unidade Consumidora (UC)', styles: { fontStyle: 'bold' } }, project.client.utilityId],
      [{ content: 'Endereço', styles: { fontStyle: 'bold' } }, `${project.client.address.street}, ${project.client.address.number}`],
      [{ content: 'Bairro / Cidade', styles: { fontStyle: 'bold' } }, `${project.client.address.neighborhood} - ${project.client.address.city} / ${project.client.address.state}`],
      [{ content: 'Email', styles: { fontStyle: 'bold' } }, project.client.email],
      [{ content: 'Responsável Técnico', styles: { fontStyle: 'bold' } }, project.engineer?.name || 'Não informado'],
      [{ content: 'Nº CREA', styles: { fontStyle: 'bold' } }, project.engineer?.crea || 'Não informado'],
      [{ content: 'Nº ART', styles: { fontStyle: 'bold' } }, project.client?.art || 'Não informado'],
    ],
    theme: 'grid',
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 50, fillColor: [245, 245, 245] } },
    margin: { left: margin, right: margin },
  });

  cursorY = (doc as any).lastAutoTable.finalY + 10;

  // 2. Technical Data
  addSectionTitle("2. Dados Técnicos da Instalação Existente");

  autoTable(doc, {
    startY: cursorY,
    body: [
      ['Concessionária', project.technical.utility],
      ['Tipo de Fornecimento', project.technical.connectionType],
      ['Nível de Tensão', project.technical.voltage],
      ['Disjuntor Geral (Padrão)', `${project.technical.mainBreaker} A`],
      ['Distância do Padrão', `${project.technical.distance} metros`],
    ],
    theme: 'grid',
    styles: { fontSize: 10 },
    columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold', fillColor: [245, 245, 245] } },
    margin: { left: margin, right: margin },
  });

  cursorY = (doc as any).lastAutoTable.finalY + 15;

  // 3. Equipment - iterate over all blocks
  addSectionTitle("3. Equipamentos do Sistema Fotovoltaico");

  const engResult = getProjectEngineeringStatus(project.equipmentBlocks, project.technical);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Potência Instalada Total (CC): ${engResult.totalDcPower.toFixed(2)} kWp`, margin, cursorY);
  doc.text(`Potência Inversores Total (CA): ${engResult.totalAcPower.toFixed(2)} kW`, margin + 80, cursorY);
  cursorY += 8;

  // Group equipment by model for summary table
  const equipmentRows: any[][] = [];

  // Group modules
  const moduleGroups = new Map<string, { block: EquipmentBlock; totalQty: number }>();
  project.equipmentBlocks.forEach(block => {
    const key = `${block.moduleBrand}-${block.moduleModel}`;
    const existing = moduleGroups.get(key);
    if (existing) {
      existing.totalQty += block.moduleQty;
    } else {
      moduleGroups.set(key, { block, totalQty: block.moduleQty });
    }
  });

  moduleGroups.forEach(({ block, totalQty }) => {
    const totalPower = (block.modulePowerW * totalQty) / 1000;
    equipmentRows.push([
      'Módulo Fotovoltaico', block.moduleBrand, block.moduleModel, totalQty,
      `${block.modulePowerW} W`, `${totalPower.toFixed(2)} kWp`,
    ]);
  });

  // Group inverters
  const inverterGroups = new Map<string, { block: EquipmentBlock; totalQty: number }>();
  project.equipmentBlocks.forEach(block => {
    const key = `${block.inverterBrand}-${block.inverterModel}`;
    const existing = inverterGroups.get(key);
    if (existing) {
      existing.totalQty += block.inverterQty;
    } else {
      inverterGroups.set(key, { block, totalQty: block.inverterQty });
    }
  });

  inverterGroups.forEach(({ block, totalQty }) => {
    const totalPower = block.inverterPowerKw * totalQty;
      const invLabel = block.inverter?.inverterType === 'micro' ? 'Microinversor' : 'Inversor Interativo';
    equipmentRows.push([
      invLabel, block.inverterBrand, block.inverterModel, totalQty,
      `${block.inverterPowerKw} kW`, `${totalPower.toFixed(2)} kW`,
    ]);
  });

  autoTable(doc, {
    startY: cursorY,
    head: [['Item', 'Fabricante', 'Modelo', 'Qtd', 'Potência Unit.', 'Potência Total']],
    body: equipmentRows,
    theme: 'striped',
    headStyles: { fillColor: primaryColor, textColor: 255 },
    styles: { fontSize: 9, halign: 'center' },
    columnStyles: { 0: { halign: 'left' }, 1: { halign: 'left' } },
    margin: { left: margin, right: margin },
  });

  cursorY = (doc as any).lastAutoTable.finalY + 10;

  // Detail per block / roof structure
  if (project.equipmentBlocks.length > 0) {
    checkPageBreak(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Detalhamento por Conjunto e Estrutura de Telhado:", margin, cursorY);
    cursorY += 6;

    project.equipmentBlocks.forEach((block, idx) => {
      checkPageBreak(35);
      const blockDc = (block.modulePowerW * block.moduleQty) / 1000;
      const blockAc = block.inverterPowerKw * block.inverterQty;
      const stringsDesc = block.strings.map((s, i) => `S${i + 1}: ${s.count} mód.`).join(' | ');
      const structDesc = `${getStructureTypeLabel(block.structureType)} • ${block.roofPlaneName || `Água ${idx + 1}`}`;
      const orientDesc = `Azimute: ${getAzimuthCardinalLabel(block.azimuth)} | Inclinação: ${block.tilt ?? 15}°`;

      autoTable(doc, {
        startY: cursorY,
        body: [
          [`Conjunto ${idx + 1}`, `${block.inverterBrand} ${block.inverterModel} (${block.inverterQty}x) + ${block.moduleQty}x ${block.moduleBrand} ${block.moduleModel}`],
          ['Strings', stringsDesc],
          ['Estrutura', `${structDesc} (${orientDesc})`],
          ['Potência', `DC: ${blockDc.toFixed(2)} kWp | AC: ${blockAc.toFixed(2)} kW`],
        ],
        theme: 'grid',
        styles: { fontSize: 9 },
        columnStyles: { 0: { cellWidth: 40, fontStyle: 'bold', fillColor: [245, 245, 245] } },
        margin: { left: margin, right: margin },
      });
      cursorY = (doc as any).lastAutoTable.finalY + 5;
    });
  }

  cursorY += 10;

  // 4. Protections
  addSectionTitle("4. Dispositivos de Proteção e Segurança");

  // Build dynamic DC protection descriptions from engineering results
  const dcProtDesc = engResult.blocks.map((b, i) => {
    const dc = b.dcProtection;
    const fuseStr = dc.fuseRequired
      ? `Fusível gPV ${dc.fuseRating}A / ${dc.fuseVoltage}V (obrigatório: ≥3 strings)`
      : `Fusível gPV ${dc.fuseRating}A / ${dc.fuseVoltage}V (recomendado)`;
    return `Conjunto ${i + 1}: ${fuseStr}. Seccionadora CC ${dc.switchRating}A / ${dc.switchVoltage}V. DPS CC ${dc.dpsClass} ${dc.dpsVoltage}V.`;
  }).join(' ');

  const trafoDesc = engResult.blocks.some(b => b.requiresTransformer)
    ? engResult.blocks.filter(b => b.requiresTransformer).map((b, i) =>
        `Conjunto ${b.blockId}: ${b.transformerResult.reason} (${b.transformerResult.suggestedPowerKva} kVA ${b.transformerResult.type})`
      ).join('. ')
    : '';

  const protections: string[][] = [
    ["Anti-ilhamento", "O inversor cessa o fornecimento de energia à rede em caso de falha ou desligamento da concessionária (tempo < 2s)."],
    ["Sobretensão/Subtensão (59/27)", "Desconexão automática se a tensão sair da faixa operacional configurada."],
    ["Sobrefrequência/Subfrequência (81)", "Operação restrita à faixa de 57,5 Hz a 62 Hz (conforme norma local)."],
    ["Religamento Automático", "O inversor aguarda 180s após o restabelecimento da rede dentro dos parâmetros ideais antes de reconectar."],
    ["Proteção CC (Calculada)", dcProtDesc || "Fusíveis de proteção nas strings (se aplicável) e DPS CC integrados ou externos."],
    ["Proteção CA", `Disjuntor termomagnético ${engResult.totalSuggestedBreaker}A ${engResult.totalBreakerPolarity} e DPS CA no quadro de proteção.`],
  ];

  if (trafoDesc) {
    protections.push(["Transformador Isolador", trafoDesc]);
  }

  autoTable(doc, {
    startY: cursorY,
    head: [['Função de Proteção', 'Descrição']],
    body: protections,
    theme: 'grid',
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
    margin: { left: margin, right: margin },
  });

  cursorY = (doc as any).lastAutoTable.finalY + 15;

  // 5. Rateio de Créditos (Lei 14.300)
  if (project.creditBeneficiaries && project.creditBeneficiaries.length > 0) {
    addSectionTitle("5. Rateio de Créditos e Geração Compartilhada (Lei 14.300)");

    const estGenTotal = estimateMonthlyGeneration(engResult.totalDcPower);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Geração Mensal Estimada da Usina Geradora: ${estGenTotal.toFixed(0)} kWh/mês (HSP 4.8 kWh/m²/dia)`, margin, cursorY);
    cursorY += 6;

    const rateioRows = project.creditBeneficiaries.map((b) => {
      const pct = Number(b.percentage) || 0;
      const estKwh = (estGenTotal * pct) / 100;
      return [
        b.utilityId || 'N/A',
        b.description || 'Beneficiária',
        b.averageConsumptionKwh ? `${b.averageConsumptionKwh} kWh` : '-',
        `${pct.toFixed(2)}%`,
        `${estKwh.toFixed(1)} kWh`,
      ];
    });

    const totalPct = project.creditBeneficiaries.reduce((acc, b) => acc + (Number(b.percentage) || 0), 0);
    rateioRows.push([
      'TOTAL ALOCADO', '', '', `${totalPct.toFixed(2)}%`, `${(estGenTotal * totalPct / 100).toFixed(1)} kWh`
    ]);

    autoTable(doc, {
      startY: cursorY,
      head: [['Nº da UC Beneficiária', 'Identificação / Titular', 'Consumo Médio', '% Rateio', 'Crédito Estimado']],
      body: rateioRows,
      theme: 'striped',
      headStyles: { fillColor: primaryColor, textColor: 255 },
      styles: { fontSize: 8.5, halign: 'center' },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold' }, 1: { halign: 'left' } },
      margin: { left: margin, right: margin },
    });

    cursorY = (doc as any).lastAutoTable.finalY + 15;
  }

  // Standards Section
  const standardsSectionNum = (project.creditBeneficiaries && project.creditBeneficiaries.length > 0) ? "6" : "5";
  addSectionTitle(`${standardsSectionNum}. Normas Técnicas e Regulamentações`);

  const norms = [
    "Lei nº 14.300/2022 - Marco Legal da Microgeração e Minigeração Distribuída.",
    "Resolução Normativa ANEEL nº 1.000/2021 e 1.059/2023.",
    "ABNT NBR 5410 - Instalações elétricas de baixa tensão.",
    "ABNT NBR 16690 - Instalações elétricas de arranjos fotovoltaicos.",
    "ABNT NBR 16149 - Sistemas fotovoltaicos conectados à rede - Características da interface.",
    project.technical.utility === UtilityCompany.LIGHT ? "Norma Técnica Light RECON-BT." : "Norma Técnica Enel CNC-GD.",
  ];

  norms.forEach(norm => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`• ${norm}`, margin + 5, cursorY);
    cursorY += 6;
  });

  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawFooter(i);
  }

  const fileName = `Memorial_${project.client.name.replace(/\s+/g, '_') || 'projeto'}.pdf`;
  doc.save(fileName);
};
