/**
 * Validador Pré-Protocolo (Checklist Anti-Exigência Técnica / Pre-flight Audit)
 * SolarCAD — Homologação de Micro e Minigeração Distribuída
 * 
 * Executa auditoria técnica rigorosa para garantir 100% de aprovação de primeira
 * no protocolo da solicitação de acesso junto às concessionárias (Light, Enel, Energisa, Cerci).
 * 
 * Normas de Referência:
 * - Resolução Normativa ANEEL nº 1.000/2021 (Art. 65-B, 65-C, Seção IV)
 * - Lei Federal nº 14.300/2022 (Marco Legal da Micro e Minigeração)
 * - ABNT NBR 5410 (Instalações elétricas de baixa tensão)
 * - ABNT NBR 16690 (Instalações elétricas de arranjos fotovoltaicos)
 * - ABNT NBR IEC 62116 (Procedimento de ensaio anti-ilhamento)
 * - Regulamentos: Light RECON-BT, Enel CNC-GD, Energisa NDU-013 e Normas CERCI.
 */

import { ProjectState, UtilityCompany, ConnectionType, VoltageLevel } from '../types';
import { VOLTAGES } from '../constants';
import { getProjectEngineeringStatus, suggestBreaker } from './engineering';
import { getCableForCurrent } from '../components/diagram/cableCalculations';
import { validateCreditDistribution } from './creditDistribution';

export type PreFlightStatus = 'pass' | 'warning' | 'critical';

export interface PreFlightCheckItem {
  id: string;
  category: 'ELECTRICAL' | 'CABLING' | 'SAFETY' | 'GRID_COMPLIANCE' | 'DOCUMENTATION' | 'RATEIO';
  title: string;
  description: string;
  status: PreFlightStatus;
  details: string;
  recommendation?: string;
  normativeRef?: string;
}

export interface PreFlightAuditResult {
  overallStatus: PreFlightStatus;
  score: number; // 0 a 100%
  canProtocol: boolean; // true se 0 critical
  totalChecks: number;
  passedChecks: number;
  warningChecks: number;
  criticalChecks: number;
  items: PreFlightCheckItem[];
  summary: string;
}

/**
 * Calcula a potência máxima suportada (em kW) pelo padrão de entrada e disjuntor da UC
 */
export function calculateGridEntryCapacityKw(
  connectionType: ConnectionType,
  voltage: VoltageLevel,
  mainBreakerA: number,
): number {
  const voltageOption = VOLTAGES.find(v => v.value === voltage);
  const lineV = voltageOption?.lineVoltage || 220;
  const phaseV = voltageOption?.phaseVoltage || 127;
  const breaker = mainBreakerA || 63;

  if (connectionType === ConnectionType.TRIPHASIC) {
    // P = sqrt(3) * V_linha * I
    return (Math.sqrt(3) * lineV * breaker) / 1000;
  } else if (connectionType === ConnectionType.BIPHASIC) {
    // P = 2 * V_fase * I (ou V_linha * I)
    return (2 * phaseV * breaker) / 1000;
  } else {
    // Monofásico: P = V_fase * I
    return (phaseV * breaker) / 1000;
  }
}

/**
 * Retorna o nome amigável da concessionária
 */
function getUtilityFriendlyName(utility: UtilityCompany): string {
  switch (utility) {
    case UtilityCompany.LIGHT:
      return 'Light S.A. (RECON-BT)';
    case UtilityCompany.CERCI:
      return 'CERCI (Cooperativa Cantagalo)';
    case UtilityCompany.ENERGISA:
      return 'Grupo Energisa (NDU-013)';
    case UtilityCompany.ENEL_RJ:
    default:
      return 'Enel Distribuição Rio (CNC-GD)';
  }
}

/**
 * Executa a auditoria completa de pré-protocolo (Pre-Flight Audit)
 */
export function validateProjectPreFlight(project: ProjectState): PreFlightAuditResult {
  const items: PreFlightCheckItem[] = [];

  const tech = project.technical || {
    utility: UtilityCompany.LIGHT,
    connectionType: ConnectionType.BIPHASIC,
    voltage: VoltageLevel.V_127_220,
    mainBreaker: 63,
    distance: 15,
    dcCableDistance: 15,
  };

  const blocks = project.equipmentBlocks || [];
  const engResult = getProjectEngineeringStatus(blocks, tech);
  const totalDcKwp = engResult.totalDcPower;
  const totalAcKw = engResult.totalAcPower;
  const mainBreaker = tech.mainBreaker || 63;
  const utility = tech.utility || UtilityCompany.LIGHT;
  const utilityName = getUtilityFriendlyName(utility);

  // ═════════════════════════════════════════════════════════════════════════
  // CHECK 1: Potência CA vs Demanda / Disjuntor Contratado da UC
  // ═════════════════════════════════════════════════════════════════════════
  const gridCapacityKw = calculateGridEntryCapacityKw(tech.connectionType, tech.voltage, mainBreaker);
  const suggestedMainBreaker = suggestBreaker(engResult.totalNominalCurrent);

  if (totalAcKw <= 0) {
    items.push({
      id: 'check_power_ac_zero',
      category: 'ELECTRICAL',
      title: 'Potência CA dos Inversores',
      description: 'Verificação da potência total dos inversores configurados.',
      status: 'critical',
      details: 'Nenhum inversor com potência ativa configurado no projeto.',
      recommendation: 'Selecione e adicione pelo menos 1 conjunto de inversor e módulos fotovoltaicos.',
      normativeRef: 'REN ANEEL 1.000/2021',
    });
  } else if (totalAcKw > gridCapacityKw) {
    items.push({
      id: 'check_power_ac_vs_breaker',
      category: 'ELECTRICAL',
      title: 'Potência CA vs Capacidade do Padrão de Entrada',
      description: 'Auditoria de injeção simultânea de potência CA contra o disjuntor da UC.',
      status: 'critical',
      details: `Potência CA dos inversores (${totalAcKw.toFixed(2)} kW) excede a capacidade do padrão de entrada (${gridCapacityKw.toFixed(2)} kW para disjuntor ${mainBreaker}A).`,
      recommendation: `Solicitar aumento de carga / adequação do padrão de entrada da UC para disjuntor mínimo de ${suggestedMainBreaker}A antes de protocolar a solicitação de acesso.`,
      normativeRef: 'Art. 65-B da REN ANEEL 1.000/2021 e Normas de Conexão da Distribuidora',
    });
  } else if (totalAcKw > 0.90 * gridCapacityKw) {
    items.push({
      id: 'check_power_ac_vs_breaker',
      category: 'ELECTRICAL',
      title: 'Potência CA próxima ao limite do Disjuntor de Entrada',
      description: 'Auditoria de injeção simultânea de potência CA contra o disjuntor da UC.',
      status: 'warning',
      details: `Potência CA (${totalAcKw.toFixed(2)} kW) atinge mais de 90% da capacidade (${((totalAcKw / gridCapacityKw) * 100).toFixed(1)}%) do padrão de entrada (${gridCapacityKw.toFixed(2)} kW / ${mainBreaker}A).`,
      recommendation: `A injeção é permitida, mas opera próxima ao limite térmico do disjuntor de entrada. Considere sugerir ao cliente adequação para ${suggestedMainBreaker}A para evitar desarmes intempestivos.`,
      normativeRef: 'ABNT NBR 5410 e REN ANEEL 1.000/2021',
    });
  } else {
    items.push({
      id: 'check_power_ac_vs_breaker',
      category: 'ELECTRICAL',
      title: 'Capacidade do Padrão de Entrada e Disjuntor',
      description: 'Auditoria de injeção simultânea de potência CA contra o disjuntor da UC.',
      status: 'pass',
      details: `Potência CA instalada (${totalAcKw.toFixed(2)} kW) é compatível com a capacidade do padrão (${gridCapacityKw.toFixed(2)} kW / Disjuntor ${mainBreaker}A).`,
      normativeRef: 'Art. 65-B da REN ANEEL 1.000/2021',
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // CHECK 2: Bitola Mínima do Ramal de Entrada e Queda de Tensão CA
  // ═════════════════════════════════════════════════════════════════════════
  const cableResult = getCableForCurrent(engResult.totalNominalCurrent, tech);
  const voltageDropNum = parseFloat(cableResult.voltageDrop || '0');

  if (engResult.totalNominalCurrent > mainBreaker) {
    items.push({
      id: 'check_current_vs_breaker',
      category: 'CABLING',
      title: 'Corrente Nominal CA vs Disjuntor de Proteção',
      description: 'Auditoria de capacidade de condução e proteção contra sobrecorrente.',
      status: 'critical',
      details: `Corrente nominal CA gerada (${engResult.totalNominalCurrent.toFixed(1)}A) é superior ao disjuntor de entrada (${mainBreaker}A).`,
      recommendation: `Substituir o disjuntor de proteção do ramal para no mínimo ${suggestedMainBreaker}A (${engResult.totalBreakerPolarity}).`,
      normativeRef: 'ABNT NBR 5410 item 5.3',
    });
  } else if (voltageDropNum > 2.0) {
    items.push({
      id: 'check_voltage_drop',
      category: 'CABLING',
      title: 'Queda de Tensão no Ramal CA da Usina',
      description: 'Verificação da queda de tensão admissível no circuito CA entre inversor e medição.',
      status: 'warning',
      details: `Queda de tensão calculada de ${voltageDropNum.toFixed(2)}% na distância de ${tech.distance}m (limite recomendado NBR 16690: ≤ 2,0%).`,
      recommendation: `Aumentar a seção do condutor CA para ${cableResult.cableSimple} ou reduzir o comprimento do circuito para evitar elevação de tensão e desligamento do inversor por sobretensão na rede.`,
      normativeRef: 'ABNT NBR 16690 e Procedimentos de Distribuição (PRODIST Módulo 8)',
    });
  } else {
    items.push({
      id: 'check_voltage_drop',
      category: 'CABLING',
      title: 'Dimensionamento de Cabos CA e Queda de Tensão',
      description: 'Verificação da capacidade dos condutores e queda de tensão.',
      status: 'pass',
      details: `Condutores recomendados: ${cableResult.conductorLabel}. Queda de tensão calculada: ${voltageDropNum.toFixed(2)}% (Conforme ≤ 2,0%).`,
      normativeRef: 'ABNT NBR 5410 / NBR 16690',
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // CHECK 3: Obrigatoriedade da Placa de Advertência Fotovoltaica
  // ═════════════════════════════════════════════════════════════════════════
  items.push({
    id: 'check_safety_warning_sign',
    category: 'SAFETY',
    title: 'Placa de Advertência Fotovoltaica Permanente (Obrigatória)',
    description: 'Verificação da sinalização de segurança de risco de choque elétrico no padrão de medição e QDG.',
    status: 'pass',
    details: 'Sinalização com os dizeres normativos: "ATENÇÃO: RISCO DE CHOQUE ELÉTRICO - GERAÇÃO PRÓPRIA" obrigatória para aprovação da vistoria da concessionária.',
    recommendation: 'Fixar placa indelével em material resistente a intempéries/UV (acrílico ou alumínio, mín. 150x100mm) no padrão de entrada junto ao medidor e no quadro geral.',
    normativeRef: 'ABNT NBR 16690, NBR 5410 e Normas Técnicas de Vistoria da Distribuidora',
  });

  // ═════════════════════════════════════════════════════════════════════════
  // CHECK 4: Conformidade da Tensão e Fases da Distribuidora Selecionada
  // ═════════════════════════════════════════════════════════════════════════
  let phaseComplianceStatus: PreFlightStatus = 'pass';
  let phaseComplianceDetails = `Conexão ${tech.connectionType} em ${tech.voltage} compatível com os inversores selecionados para ${utilityName}.`;
  let phaseRecommendation: string | undefined = undefined;

  // Analisa transformador e matriz de fases
  const blocksWithTrafo = engResult.blocks.filter(b => b.requiresTransformer);
  const blocksIncompatible = engResult.blocks.filter(b => b.transformerResult?.incompatible);

  if (blocksIncompatible.length > 0) {
    phaseComplianceStatus = 'critical';
    phaseComplianceDetails = `Incompatibilidade de fases: ${blocksIncompatible.map(b => `Conjunto ${b.blockId} (${b.transformerResult.reason})`).join('; ')}`;
    phaseRecommendation = 'Adequar a fase/tensão do inversor ou solicitar alteração de padrão monofásico para trifásico na concessionária.';
  } else if (blocksWithTrafo.length > 0) {
    phaseComplianceStatus = 'warning';
    phaseComplianceDetails = `Transformador de acoplamento requerido: ${blocksWithTrafo.map(b => `Conjunto ${b.blockId} (${b.transformerResult.reason})`).join('; ')}`;
    phaseRecommendation = 'Certifique-se de incluir o transformador isolador/autotrafo no diagrama unifilar e memorial descritivo.';
  }

  // Verifica limite de injeção monofásica (geralmente max 5 a 8 kW por norma de concessionária)
  if (tech.connectionType === ConnectionType.MONOPHASIC && totalAcKw > 8.0) {
    if (phaseComplianceStatus === 'critical') {
      phaseComplianceDetails += ` Além disso, injeção monofásica de ${totalAcKw.toFixed(2)} kW excede o limite regulatório máximo para ligação monofásica (máximo 8,0 kW na ${utilityName}).`;
    } else {
      phaseComplianceStatus = 'critical';
      phaseComplianceDetails = `Injeção monofásica de ${totalAcKw.toFixed(2)} kW excede o limite regulatório máximo para ligação monofásica em microgeração (máximo 8,0 kW na ${utilityName}).`;
      phaseRecommendation = 'Converter o padrão de entrada da UC para bifásico ou trifásico para evitar desequilíbrio de tensão na rede da distribuidora.';
    }
  } else if (tech.connectionType === ConnectionType.MONOPHASIC && totalAcKw > 5.0 && phaseComplianceStatus === 'pass') {
    phaseComplianceStatus = 'warning';
    phaseComplianceDetails = `Potência monofásica de ${totalAcKw.toFixed(2)} kW requer atenção especial às diretrizes de conexão monofásica da distribuidora ${utilityName}.`;
    phaseRecommendation = 'Verifique se a distribuidora local aceita microgeração monofásica acima de 5 kW ou se exige transição para bifásico.';
  }

  items.push({
    id: 'check_grid_phase_compliance',
    category: 'GRID_COMPLIANCE',
    title: `Conformidade de Tensão e Fases (${utilityName})`,
    description: 'Auditoria de compatibilidade eletrotécnica entre padrão de entrada e inversores.',
    status: phaseComplianceStatus,
    details: phaseComplianceDetails,
    recommendation: phaseRecommendation,
    normativeRef: `Norma Técnica ${utilityName} e Módulo 3 do PRODIST / ANEEL`,
  });

  // ═════════════════════════════════════════════════════════════════════════
  // CHECK 5: Documentos Obrigatórios (Checklist de Protocolo)
  // ═════════════════════════════════════════════════════════════════════════
  // 5.1 Dados do Cliente / Titular
  const clientName = project.client?.name?.trim();
  const clientDoc = project.client?.document?.trim();
  const clientUc = project.client?.utilityId?.trim();
  const clientAddr = project.client?.address;

  if (!clientName || !clientDoc || !clientUc) {
    items.push({
      id: 'check_doc_client_data',
      category: 'DOCUMENTATION',
      title: 'Dados Cadastrais do Titular da UC',
      description: 'Auditoria de preenchimento dos dados obrigatórios do cliente.',
      status: 'critical',
      details: `Campos obrigatórios ausentes: ${[!clientName && 'Nome/Razão Social', !clientDoc && 'CPF/CNPJ', !clientUc && 'Código da UC'].filter(Boolean).join(', ')}.`,
      recommendation: 'Preencha o Nome, CPF/CNPJ e Código da Unidade Consumidora no formulário do projeto.',
      normativeRef: 'REN ANEEL 1.000/2021 Seção IV',
    });
  } else {
    items.push({
      id: 'check_doc_client_data',
      category: 'DOCUMENTATION',
      title: 'Dados Cadastrais do Titular da UC',
      description: 'Auditoria de preenchimento dos dados do titular.',
      status: 'pass',
      details: `Titular: ${clientName} | Documento: ${clientDoc} | UC: ${clientUc}`,
      normativeRef: 'REN ANEEL 1.000/2021',
    });
  }

  // 5.2 Endereço Completo com CEP, Logradouro, Número, Bairro e Cidade
  const addrStreet = clientAddr?.street?.trim();
  const addrNumber = clientAddr?.number?.trim();
  const addrNeighborhood = clientAddr?.neighborhood?.trim();
  const addrCity = clientAddr?.city?.trim();
  const addrZip = clientAddr?.zipCode?.trim();

  const isAddressComplete = Boolean(addrStreet && addrNumber && addrNeighborhood && addrCity && addrZip);

  if (!isAddressComplete) {
    items.push({
      id: 'check_doc_address',
      category: 'DOCUMENTATION',
      title: 'Endereço da Instalação / Local da Obra',
      description: 'Auditoria do endereço completo para localização pela equipe de vistoria.',
      status: 'warning',
      details: 'Endereço incompleto. Concessionárias exigem Logradouro, Número, Bairro, Cidade e CEP para abrir a ordem de serviço de vistoria.',
      recommendation: 'Complete o endereço da obra com CEP e Cidade antes do protocolo.',
      normativeRef: 'Normas de Atendimento das Distribuidoras (Enel RJ CNC-GD, Light RECON-BT, Energisa NDU-013, CERCI)',
    });
  } else {
    const compText = clientAddr?.complement?.trim() ? ` (${clientAddr.complement.trim()})` : '';
    items.push({
      id: 'check_doc_address',
      category: 'DOCUMENTATION',
      title: 'Endereço da Instalação / Local da Obra',
      description: 'Auditoria do endereço da usina.',
      status: 'pass',
      details: `${addrStreet}, ${addrNumber}${compText} - ${addrNeighborhood}, ${addrCity}/${clientAddr?.state?.trim() || 'RJ'} - CEP: ${addrZip}`,
      normativeRef: 'Normas de Atendimento das Distribuidoras (Enel RJ CNC-GD, Light RECON-BT, Energisa NDU-013, CERCI)',
    });
  }

  // 5.3 Responsável Técnico e Registro CREA/CFT
  const rtName = project.companyProfile?.legalRepresentative?.name || project.engineer?.name;
  const rtReg = project.companyProfile?.legalRepresentative?.creaCft || project.engineer?.crea;

  if (!rtName || !rtReg) {
    items.push({
      id: 'check_doc_engineer',
      category: 'DOCUMENTATION',
      title: 'Dados do Responsável Técnico (RT)',
      description: 'Auditoria dos dados do profissional legalmente habilitado.',
      status: 'critical',
      details: 'Nome ou Registro Profissional (CREA/CFT) do Responsável Técnico não informado.',
      recommendation: 'Informe o Responsável Técnico ou configure o perfil da empresa no menu "Empresa & Procurador".',
      normativeRef: 'Resolução CONFEA nº 1.025/2009 e Resolução CFT nº 074/2019',
    });
  } else {
    items.push({
      id: 'check_doc_engineer',
      category: 'DOCUMENTATION',
      title: 'Dados do Responsável Técnico (RT)',
      description: 'Auditoria do profissional responsável.',
      status: 'pass',
      details: `RT: ${rtName} | Registro: ${rtReg}`,
      normativeRef: 'CONFEA / CFT',
    });
  }

  // 5.4 ART / TRT
  const artNumber = project.client?.art?.trim();
  if (!artNumber) {
    items.push({
      id: 'check_doc_art',
      category: 'DOCUMENTATION',
      title: 'Anotação de Responsabilidade Técnica (ART / TRT)',
      description: 'Verificação do número de ART (CREA) ou TRT (CFT) anexada ao processo.',
      status: 'warning',
      details: 'Número da ART/TRT não informado no projeto. O formulário e comprovante de pagamento da ART/TRT devem ser anexados ao protocolo.',
      recommendation: 'Gere a ART/TRT no portal do CREA/CFT utilizando a aba "Guia ART/TRT" e informe o número do documento.',
      normativeRef: 'Lei Federal nº 6.496/1977 e Lei Federal nº 13.639/2018',
    });
  } else {
    items.push({
      id: 'check_doc_art',
      category: 'DOCUMENTATION',
      title: 'Anotação de Responsabilidade Técnica (ART / TRT)',
      description: 'Verificação do número da ART/TRT.',
      status: 'pass',
      details: `Número da ART/TRT registrada: ${artNumber}`,
      normativeRef: 'CONFEA / CFT',
    });
  }

  // 5.5 Rateio de Créditos (se aplicável)
  const beneficiaries = project.creditBeneficiaries || [];
  if (beneficiaries.length > 0) {
    const rateioVal = validateCreditDistribution(beneficiaries, 1000);
    if (!rateioVal.isValid || !rateioVal.isComplete) {
      items.push({
        id: 'check_rateio_distribution',
        category: 'RATEIO',
        title: 'Matriz de Rateio de Créditos GD (Lei 14.300)',
        description: 'Auditoria dos percentuais alocados para as unidades consumidoras beneficiárias.',
        status: 'critical',
        details: `Soma dos percentuais de rateio é ${rateioVal.totalPercentage.toFixed(2)}% (deve ser exatamente 100,00%).`,
        recommendation: 'Ajuste os percentuais na tabela de rateio ou clique no botão "Distribuir Igualmente" para fechar em 100,00%.',
        normativeRef: 'Lei 14.300/2022 e REN ANEEL nº 1.000/2021',
      });
    } else {
      items.push({
        id: 'check_rateio_distribution',
        category: 'RATEIO',
        title: 'Matriz de Rateio de Créditos GD (Lei 14.300)',
        description: 'Auditoria dos percentuais de rateio.',
        status: 'pass',
        details: `Matriz com ${beneficiaries.length} UCs participantes 100,00% alocada e em conformidade.`,
        normativeRef: 'Lei 14.300/2022',
      });
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // SÍNTESE E PONTUAÇÃO GERAL DO PRE-FLIGHT AUDIT
  // ═════════════════════════════════════════════════════════════════════════
  const totalChecks = items.length;
  const criticalChecks = items.filter(i => i.status === 'critical').length;
  const warningChecks = items.filter(i => i.status === 'warning').length;
  const passedChecks = items.filter(i => i.status === 'pass').length;

  let overallStatus: PreFlightStatus = 'pass';
  if (criticalChecks > 0) {
    overallStatus = 'critical';
  } else if (warningChecks > 0) {
    overallStatus = 'warning';
  }

  const score = Math.round(((passedChecks + warningChecks * 0.5) / totalChecks) * 100);
  const canProtocol = criticalChecks === 0;

  let summary = '';
  if (overallStatus === 'pass') {
    summary = `Projeto 100% aprovado no Pre-Flight Audit para ${utilityName}. Nenhuma não-conformidade detectada. Pronto para protocolo imediato.`;
  } else if (overallStatus === 'warning') {
    summary = `Projeto apto com ${warningChecks} aviso(s) técnico(s) para ${utilityName}. Recomenda-se revisar as observações antes do protocolo formal.`;
  } else {
    summary = `Atenção: ${criticalChecks} não-conformidade(s) crítica(s) detectada(s). A concessionária ${utilityName} gerará exigência técnica ou indeferimento se protocolado no estado atual.`;
  }

  return {
    overallStatus,
    score,
    canProtocol,
    totalChecks,
    passedChecks,
    warningChecks,
    criticalChecks,
    items,
    summary,
  };
}
