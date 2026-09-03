/**
 * Serviço de Guia Rápido de Preenchimento de ART / TRT (CREA & CFT)
 * SolarCAD — Automação de Documentos e Homologação de Concessionárias
 * 
 * Normativas de Referência:
 * - CONFEA: Resolução nº 1.025/2009 e Tabela de Atividades do CONFEA
 * - CFT: Resolução CFT nº 074/2019 e Sistema SITAC
 * - Lei Federal nº 14.300/2022 (Marco Legal da Micro e Minigeração Distribuída)
 * - Resolução Normativa ANEEL nº 1.000/2021
 */

import { ProjectState, EquipmentBlock } from '../types';
import { estimateMonthlyGeneration } from './creditDistribution';
import { getProjectEngineeringStatus } from './engineering';

export interface ArtField {
  id: string;
  label: string;
  value: string;
  description: string;
  category: 'RESPONSAVEL_TECNICO' | 'CONTRATANTE' | 'LOCAL_OBRA' | 'ATIVIDADES_TECNICAS' | 'DESCRICAO_OBJETO' | 'DADOS_PLANTA';
}

export interface TechnicalActivityItem {
  code: string;
  name: string;
  level: string;
  unit: string;
  quantity: number | string;
  description: string;
}

export interface ArtGuideResult {
  councilType: 'CREA' | 'CFT' | 'AMBOS';
  totalDcPowerKwp: number;
  totalAcPowerKw: number;
  estimatedMonthlyGenKwh: number;
  confeaActivities: TechnicalActivityItem[];
  cftActivities: TechnicalActivityItem[];
  technicalDescription: string;
  summaryText: string;
  fullReportText: string;
  fields: ArtField[];
}

/**
 * Sanitiza e formata o endereço completo da instalação
 */
export function formatPlantAddress(project: ProjectState): string {
  const addr = project.client?.address || { street: '', number: '', neighborhood: '', city: '', state: '', zipCode: '' };
  const parts = [
    addr.street ? `${addr.street}, ${addr.number || 'S/N'}` : '',
    addr.neighborhood ? `Bairro ${addr.neighborhood}` : '',
    addr.city ? `${addr.city}/${addr.state || 'RJ'}` : (addr.state || 'RJ'),
    addr.zipCode ? `CEP: ${addr.zipCode}` : '',
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' - ') : 'Endereço não informado';
}

/**
 * Resume a lista de módulos fotovoltaicos instalados
 */
export function summarizeModules(blocks: EquipmentBlock[]): string {
  const list = (blocks || []).filter(b => b.moduleQty > 0);
  if (list.length === 0) return '0 módulos fotovoltaicos';

  return list
    .map(b => `${b.moduleQty}x Módulos ${b.moduleBrand || b.module?.brand || 'Solar'} ${b.moduleModel || b.module?.model || ''} (${b.modulePowerW || b.module?.power || 0}Wp)`.trim())
    .join(', ');
}

/**
 * Resume a lista de inversores fotovoltaicos instalados
 */
export function summarizeInverters(blocks: EquipmentBlock[]): string {
  const list = (blocks || []).filter(b => b.inverterQty > 0);
  if (list.length === 0) return '0 inversores';

  return list
    .map(b => `${b.inverterQty}x Inversor ${b.inverterBrand || b.inverter?.brand || ''} ${b.inverterModel || b.inverter?.model || ''} (${b.inverterPowerKw || b.inverter?.power || 0}kW)`.trim())
    .join(', ');
}

/**
 * Gera as atividades técnicas padronizadas do CONFEA (Tabela de Atividades CREA / Glic)
 */
export function getConfeaActivities(totalDcPowerKwp: number): TechnicalActivityItem[] {
  const formattedPower = totalDcPowerKwp.toFixed(2);

  return [
    {
      code: '02.01.01',
      name: 'PROJETO DE INSTALAÇÕES ELÉTRICAS',
      level: 'Autor / Responsável Técnico',
      unit: 'kWp',
      quantity: formattedPower,
      description: `Elaboração de Projeto de Engenharia de Microgeração Solar Fotovoltaica conectada à rede com potência instalada de ${formattedPower} kWp.`,
    },
    {
      code: '26.01.01',
      name: 'EXECUÇÃO DE INSTALAÇÕES ELÉTRICAS',
      level: 'Executor / Direção Técnica de Instalação',
      unit: 'kWp',
      quantity: formattedPower,
      description: `Execução e Montagem Eletromecânica de Sistema Gerador Fotovoltaico de Microgeração Distribuída de ${formattedPower} kWp.`,
    },
    {
      code: '10.01.01',
      name: 'VISTORIA / COMISSIONAMENTO',
      level: 'Responsável Técnico',
      unit: 'UNIDADE',
      quantity: 1,
      description: `Inspeção, ensaios de isolamento, parametrização de proteções e comissionamento do sistema fotovoltaico de microgeração.`,
    },
  ];
}

/**
 * Gera as atividades técnicas padronizadas do CFT (Tabela SITAC / Resolução CFT nº 074/2019)
 */
export function getCftActivities(totalDcPowerKwp: number): TechnicalActivityItem[] {
  const formattedPower = totalDcPowerKwp.toFixed(2);

  return [
    {
      code: '02 - ELETROTÉCNICA',
      name: 'PROJETO DE SISTEMA SOLAR FOTOVOLTAICO',
      level: 'Responsável Técnico',
      unit: 'kWp',
      quantity: formattedPower,
      description: `Elaboração de Projeto Técnico de Microgeração Solar Fotovoltaica (${formattedPower} kWp) conforme Resolução CFT nº 074/2019.`,
    },
    {
      code: '26 - ELETROTÉCNICA',
      name: 'EXECUÇÃO DE SISTEMA SOLAR FOTOVOLTAICO',
      level: 'Responsável Técnico / Executor',
      unit: 'kWp',
      quantity: formattedPower,
      description: `Instalação, montagem de estrutura, cabeamento CA/CC e conexão à rede de Microgeração Solar Fotovoltaica (${formattedPower} kWp).`,
    },
  ];
}

/**
 * Gera o texto oficial formatado para o campo "Descrição / Objeto do Contrato" da ART / TRT
 */
export function generateArtTechnicalDescription(project: ProjectState): string {
  const engResult = getProjectEngineeringStatus(project.equipmentBlocks || [], project.technical);
  const totalDcKwp = engResult.totalDcPower;
  const totalAcKw = engResult.totalAcPower;
  const monthlyGenKwh = Math.round(estimateMonthlyGeneration(totalDcKwp));

  const clientName = project.client?.name || 'Não informado';
  const clientDoc = project.client?.document || 'Não informado';
  const ucNumber = project.client?.utilityId || 'Não informado';
  const utility = project.technical?.utility || 'Distribuidora Local';
  const addressFull = formatPlantAddress(project);
  const voltage = project.technical?.voltage || '127/220V';
  const connType = project.technical?.connectionType || 'BIFASICO';

  const modulesText = summarizeModules(project.equipmentBlocks || []);
  const invertersText = summarizeInverters(project.equipmentBlocks || []);

  const rep = project.companyProfile?.legalRepresentative;
  const rtName = rep?.name || project.engineer?.name || 'Responsável Técnico';
  const rtRegistry = rep?.creaCft || project.engineer?.crea || 'Não informado';

  return `PROJETO E EXECUÇÃO DE SISTEMA GERADOR SOLAR FOTOVOLTAICO CONECTADO À REDE (MICROGERAÇÃO DISTRIBUÍDA - LEI FEDERAL Nº 14.300/2022 E RESOLUÇÃO NORMATIVA ANEEL Nº 1.000/2021).
POTÊNCIA INSTALADA: ${totalDcKwp.toFixed(2)} kWp (CC) / ${totalAcKw.toFixed(2)} kW (CA).
GERAÇÃO MÉDIA ESTIMADA: ${monthlyGenKwh} kWh/mês.
EQUIPAMENTOS PRINCIPAIS:
- GERADOR FOTOVOLTAICO: ${modulesText};
- INVERSOR(ES) DE FREQUÊNCIA: ${invertersText};
- CONEXÃO À REDE: Padrão ${connType} em ${voltage}, Unidade Consumidora (UC) nº ${ucNumber} atendida pela distribuidora ${utility}.
LOCAL DA INSTALAÇÃO: ${addressFull}.
CONTRATANTE / TITULAR DA UC: ${clientName} - CPF/CNPJ: ${clientDoc}.
RESPONSÁVEL TÉCNICO: ${rtName} - Registro: ${rtRegistry}.
SERVIÇOS INCLUSOS: Dimensionamento elétrico, diagrama unifilar, memorial descritivo, montagem eletromecânica, testes de conformidade conforme ABNT NBR 5410, NBR 16690 e NBR IEC 62116, e comissionamento junto à concessionária de energia.`.trim();
}

/**
 * Gera o guia completo de preenchimento de ART (CREA) e TRT (CFT)
 */
export function generateArtGuide(project: ProjectState): ArtGuideResult {
  const engResult = getProjectEngineeringStatus(project.equipmentBlocks || [], project.technical);
  const totalDcKwp = engResult.totalDcPower;
  const totalAcKw = engResult.totalAcPower;
  const monthlyGenKwh = Math.round(estimateMonthlyGeneration(totalDcKwp));

  const confeaActivities = getConfeaActivities(totalDcKwp);
  const cftActivities = getCftActivities(totalDcKwp);
  const technicalDescription = generateArtTechnicalDescription(project);

  const rep = project.companyProfile?.legalRepresentative;
  const rtName = rep?.name || project.engineer?.name || 'Não informado';
  const rtRegistry = rep?.creaCft || project.engineer?.crea || 'Não informado';
  const rtState = rep?.creaState || 'RJ';
  const rtQualification = rep?.qualification || 'Engenheiro Eletricista / Técnico em Eletrotécnica';
  const rtCpf = rep?.cpf || 'Não informado';
  const rtRnp = rep?.rnp || 'Não informado';

  const clientName = project.client?.name || 'Não informado';
  const clientDoc = project.client?.document || 'Não informado';
  const clientEmail = project.client?.email || 'Não informado';
  const clientPhone = project.client?.phone || 'Não informado';
  const ucNumber = project.client?.utilityId || 'Não informado';
  const artNumber = project.client?.art || 'A definir';

  const addr = project.client?.address || { street: '', number: '', neighborhood: '', city: '', state: '', zipCode: '' };
  const addressFull = formatPlantAddress(project);

  // Determina tipo de conselho prioritário
  let councilType: 'CREA' | 'CFT' | 'AMBOS' = 'AMBOS';
  const upperQual = rtQualification.toUpperCase();
  const upperReg = rtRegistry.toUpperCase();
  if (upperQual.includes('TÉCNIC') || upperReg.includes('CFT') || upperReg.includes('CRT')) {
    councilType = 'CFT';
  } else if (upperQual.includes('ENG') || upperReg.includes('CREA')) {
    councilType = 'CREA';
  }

  const fields: ArtField[] = [
    // 1. Responsável Técnico
    {
      id: 'rt_name',
      label: 'Nome do Responsável Técnico',
      value: rtName,
      description: 'Nome completo do profissional legalmente habilitado',
      category: 'RESPONSAVEL_TECNICO',
    },
    {
      id: 'rt_qualification',
      label: 'Título Profissional',
      value: rtQualification,
      description: 'Engenheiro Eletricista, Eng. de Energia, Técnico em Eletrotécnica, etc.',
      category: 'RESPONSAVEL_TECNICO',
    },
    {
      id: 'rt_registry',
      label: 'Registro Profissional (CREA / CFT)',
      value: rtRegistry,
      description: 'Número de inscrição no conselho de classe com UF',
      category: 'RESPONSAVEL_TECNICO',
    },
    {
      id: 'rt_state',
      label: 'UF do Conselho',
      value: rtState,
      description: 'Estado onde a ART/TRT será registrada',
      category: 'RESPONSAVEL_TECNICO',
    },
    {
      id: 'rt_cpf',
      label: 'CPF do Profissional',
      value: rtCpf,
      description: 'Cadastro de Pessoa Física do Responsável Técnico',
      category: 'RESPONSAVEL_TECNICO',
    },
    {
      id: 'rt_rnp',
      label: 'RNP (Registro Nacional de Profissionais - CONFEA)',
      value: rtRnp,
      description: 'Código RNP nacional do profissional',
      category: 'RESPONSAVEL_TECNICO',
    },

    // 2. Contratante
    {
      id: 'client_name',
      label: 'Nome / Razão Social do Contratante',
      value: clientName,
      description: 'Titular da Unidade Consumidora Geradora',
      category: 'CONTRATANTE',
    },
    {
      id: 'client_doc',
      label: 'CPF / CNPJ do Contratante',
      value: clientDoc,
      description: 'Documento oficial do proprietário / titular',
      category: 'CONTRATANTE',
    },
    {
      id: 'client_email',
      label: 'E-mail do Contratante',
      value: clientEmail,
      description: 'Contato eletrônico para notificações da ART/TRT',
      category: 'CONTRATANTE',
    },
    {
      id: 'client_phone',
      label: 'Telefone do Contratante',
      value: clientPhone,
      description: 'Telefone comercial/pessoal do contratante',
      category: 'CONTRATANTE',
    },

    // 3. Local da Obra / Serviço
    {
      id: 'plant_street',
      label: 'Logradouro da Instalação',
      value: addr.street || '',
      description: 'Rua, Avenida, Estrada ou Alameda da usina',
      category: 'LOCAL_OBRA',
    },
    {
      id: 'plant_number',
      label: 'Número',
      value: addr.number || 'S/N',
      description: 'Número do imóvel no logradouro',
      category: 'LOCAL_OBRA',
    },
    {
      id: 'plant_neighborhood',
      label: 'Bairro',
      value: addr.neighborhood || '',
      description: 'Bairro ou Distrito',
      category: 'LOCAL_OBRA',
    },
    {
      id: 'plant_city',
      label: 'Cidade / Município',
      value: addr.city || '',
      description: 'Município da instalação fotovoltaica',
      category: 'LOCAL_OBRA',
    },
    {
      id: 'plant_state',
      label: 'Estado (UF)',
      value: addr.state || 'RJ',
      description: 'Unidade Federativa',
      category: 'LOCAL_OBRA',
    },
    {
      id: 'plant_zip',
      label: 'CEP',
      value: addr.zipCode || '',
      description: 'Código de Endereçamento Postal',
      category: 'LOCAL_OBRA',
    },
    {
      id: 'plant_address_full',
      label: 'Endereço Completo Formatado',
      value: addressFull,
      description: 'Endereço concatenado completo para colar no portal',
      category: 'LOCAL_OBRA',
    },
    {
      id: 'uc_number',
      label: 'Código da Unidade Consumidora (UC)',
      value: ucNumber,
      description: 'Número da conta de energia na concessionária',
      category: 'LOCAL_OBRA',
    },

    // 4. Atividades Técnicas (CONFEA / CFT)
    {
      id: 'confea_activity_1',
      label: 'Atividade 1 (CREA): Projeto',
      value: '02.01.01 - Instalações Elétricas em Baixa Tensão (Microgeração Fotovoltaica)',
      description: `Atividade: Projeto | Unidade: kWp | Quantidade: ${totalDcKwp.toFixed(2)}`,
      category: 'ATIVIDADES_TECNICAS',
    },
    {
      id: 'confea_activity_2',
      label: 'Atividade 2 (CREA): Execução',
      value: '26.01.01 - Instalações Elétricas em Baixa Tensão (Microgeração Fotovoltaica)',
      description: `Atividade: Execução | Unidade: kWp | Quantidade: ${totalDcKwp.toFixed(2)}`,
      category: 'ATIVIDADES_TECNICAS',
    },
    {
      id: 'cft_activity_1',
      label: 'Atividade 1 (CFT/SITAC): Projeto',
      value: 'Eletrotécnica - Projeto de Microgeração Solar Fotovoltaica',
      description: `Atividade: Projeto | Unidade: kWp | Quantidade: ${totalDcKwp.toFixed(2)}`,
      category: 'ATIVIDADES_TECNICAS',
    },
    {
      id: 'cft_activity_2',
      label: 'Atividade 2 (CFT/SITAC): Execução',
      value: 'Eletrotécnica - Execução de Instalações Fotovoltaicas',
      description: `Atividade: Execução | Unidade: kWp | Quantidade: ${totalDcKwp.toFixed(2)}`,
      category: 'ATIVIDADES_TECNICAS',
    },
    {
      id: 'activity_quantities',
      label: 'Quantitativo da Atividade',
      value: `${totalDcKwp.toFixed(2)} kWp`,
      description: 'Potência do gerador fotovoltaico em Quilowatt-pico (kWp)',
      category: 'ATIVIDADES_TECNICAS',
    },

    // 5. Descrição / Objeto da ART
    {
      id: 'art_description_full',
      label: 'Descrição Completa do Objeto (Objeto do Contrato)',
      value: technicalDescription,
      description: 'Texto formal completo otimizado para colar no portal do CREA/CFT',
      category: 'DESCRICAO_OBJETO',
    },
    {
      id: 'art_existing_number',
      label: 'Número da ART / TRT Cadastrada',
      value: artNumber,
      description: 'Número do documento após emissão no conselho',
      category: 'DESCRICAO_OBJETO',
    },

    // 6. Dados da Planta
    {
      id: 'plant_dc_power',
      label: 'Potência CC (Painéis)',
      value: `${totalDcKwp.toFixed(2)} kWp`,
      description: 'Potência de pico total dos módulos',
      category: 'DADOS_PLANTA',
    },
    {
      id: 'plant_ac_power',
      label: 'Potência CA (Inversores)',
      value: `${totalAcKw.toFixed(2)} kW`,
      description: 'Potência nominal dos inversores',
      category: 'DADOS_PLANTA',
    },
    {
      id: 'plant_modules_summary',
      label: 'Módulos Fotovoltaicos',
      value: summarizeModules(project.equipmentBlocks || []),
      description: 'Resumo quantitativo e marcas dos módulos',
      category: 'DADOS_PLANTA',
    },
    {
      id: 'plant_inverters_summary',
      label: 'Inversores de Frequência',
      value: summarizeInverters(project.equipmentBlocks || []),
      description: 'Resumo quantitativo e marcas dos inversores',
      category: 'DADOS_PLANTA',
    },
    {
      id: 'plant_generation_est',
      label: 'Geração Estimada',
      value: `${monthlyGenKwh} kWh/mês`,
      description: 'Estimativa de geração média mensal',
      category: 'DADOS_PLANTA',
    },
  ];

  const summaryText = `Usina Fotovoltaica de ${totalDcKwp.toFixed(2)} kWp (CC) / ${totalAcKw.toFixed(2)} kW (CA) na UC ${ucNumber} (${clientName}). RT: ${rtName} (${rtRegistry}).`;

  const fullReportText = `========================================================================
GUIA RÁPIDO DE PREENCHIMENTO DE ART / TRT — SOLARCAD
Conselho Alvo: ${councilType === 'CREA' ? 'CREA (Glic / ART Web)' : councilType === 'CFT' ? 'CFT (SITAC / TRT Web)' : 'CREA & CFT'}
Data de Geração: ${new Date().toLocaleDateString('pt-BR')}
========================================================================

1. DADOS DO RESPONSÁVEL TÉCNICO:
- Nome: ${rtName}
- Título Profissional: ${rtQualification}
- Registro: ${rtRegistry} (${rtState})
- CPF: ${rtCpf}
- RNP: ${rtRnp}

2. DADOS DO CONTRATANTE (PROPRIETÁRIO / TITULAR DA UC):
- Nome / Razão Social: ${clientName}
- CPF / CNPJ: ${clientDoc}
- E-mail: ${clientEmail}
- Telefone: ${clientPhone}

3. LOCAL DA OBRA / INSTALAÇÃO:
- Endereço: ${addressFull}
- Código da UC: ${ucNumber}
- Distribuidora: ${project.technical?.utility || 'Distribuidora Local'}

4. ATIVIDADES TÉCNICAS RECOMENDADAS:
[Tabela CONFEA / CREA]:
- Atividade 1: 02.01.01 - Elaboração de Projeto de Instalações Elétricas (kWp: ${totalDcKwp.toFixed(2)})
- Atividade 2: 26.01.01 - Execução de Instalações Elétricas (kWp: ${totalDcKwp.toFixed(2)})
- Atividade 3: 10.01.01 - Vistoria e Comissionamento de Instalações Elétricas (Unidade: 1)

[Tabela CFT / SITAC]:
- Atividade 1: Grupo Eletrotécnica - Projeto de Sistema Fotovoltaico (kWp: ${totalDcKwp.toFixed(2)})
- Atividade 2: Grupo Eletrotécnica - Execução de Sistema Fotovoltaico (kWp: ${totalDcKwp.toFixed(2)})

5. TEXTO PARA O CAMPO "DESCRIÇÃO / OBJETO DO CONTRATO":
------------------------------------------------------------------------
${technicalDescription}
------------------------------------------------------------------------

6. RESUMO TÉCNICO DA PLANTA:
- Potência CC: ${totalDcKwp.toFixed(2)} kWp
- Potência CA: ${totalAcKw.toFixed(2)} kW
- Geração Estimada: ${monthlyGenKwh} kWh/mês
- Módulos: ${summarizeModules(project.equipmentBlocks || [])}
- Inversores: ${summarizeInverters(project.equipmentBlocks || [])}
========================================================================`.trim();

  return {
    councilType,
    totalDcPowerKwp: totalDcKwp,
    totalAcPowerKw: totalAcKw,
    estimatedMonthlyGenKwh: monthlyGenKwh,
    confeaActivities,
    cftActivities,
    technicalDescription,
    summaryText,
    fullReportText,
    fields,
  };
}

/**
 * Helper para copiar texto para a área de transferência de forma segura
 */
export async function copyArtTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback
    }
  }

  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch {
      return false;
    }
  }

  return false;
}
