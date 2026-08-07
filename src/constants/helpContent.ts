export interface HelpEntry {
  title: string;
  description: string;
  example?: string;
  norm?: string;
}

export const HELP: Record<string, HelpEntry> = {
  // OCR
  ocr: {
    title: 'Leitura Inteligente da Conta de Energia',
    description:
      'Tire uma foto nítida e frontal da sua conta de energia (Light ou Enel). Certifique-se de que o nome do titular, endereço, número da UC e o histórico de consumo estejam legíveis. Evite sombras, reflexos e recortes parciais. Contas em PDF obtidas pelo site da concessionária geralmente possuem melhor resolução.',
    example:
      'Dica: No app da Light ou Enel, baixe a "2ª via" em PDF — o resultado será mais preciso do que uma foto tirada com celular.',
    norm: 'A extração segue os padrões de layout das contas RECON-BT (Light) e CNC-GD (Enel RJ).',
  },

  // Concessionária
  concessionaria: {
    title: 'Concessionária de Energia',
    description:
      'Selecione a distribuidora de energia que atende o local da instalação. Cada concessionária possui normas técnicas diferentes para homologação de sistemas de geração distribuída (GD).',
    example:
      'Light (RJ): segue a norma RECON-BT. Enel (RJ): segue a norma CNC-GD / CNC-OMBR.',
    norm: 'Resolução Normativa ANEEL nº 482/2012 e 687/2015.',
  },

  // Tipo de Conexão
  connectionType: {
    title: 'Tipo de Conexão (Fornecimento)',
    description:
      'Define a quantidade de fases do padrão de entrada. Influencia diretamente no dimensionamento de disjuntores, cabos e na potência máxima permitida pela concessionária.',
    example:
      'Monofásico: 1 fase + neutro (até ~8kW). Bifásico: 2 fases + neutro (até ~12kW). Trifásico: 3 fases + neutro (sem limite prático em BT).',
    norm: 'NBR 5410:2004, Tabela 47 — Dimensionamento por tipo de circuito.',
  },

  // Tensão
  voltage: {
    title: 'Nível de Tensão da Rede',
    description:
      'A tensão nominal do padrão de entrada. Sistemas 127/220V são mais comuns em áreas urbanas do RJ (Light). Sistemas 220/380V são comuns em áreas atendidas pela Enel ou padrões comerciais.',
    example:
      '127/220V → Tensão de fase = 127V, tensão de linha = 220V.\n220/380V → Tensão de fase = 220V, tensão de linha = 380V.',
    norm: 'NBR 5410:2004 — Seção 4.2 (Tensões nominais).',
  },

  // Disjuntor do Padrão
  mainBreaker: {
    title: 'Disjuntor Geral do Padrão de Entrada',
    description:
      'É o disjuntor instalado no medidor da concessionária. A potência total do sistema fotovoltaico (AC) não pode exceder a capacidade desse disjuntor. Se necessário, solicite aumento de carga à concessionária.',
    example:
      'Para um sistema de 5kW em 220V monofásico: I = 5000/220 ≈ 22,7A → Disjuntor mínimo de 32A.',
    norm: 'RECON-BT Light: Tabela de limites por disjuntor. CNC-GD Enel: Seção 6.3.',
  },

  // Distância do Padrão
  distance: {
    title: 'Distância do Padrão ao QGF (metros)',
    description:
      'Distância em metros entre o padrão de entrada (medidor) e o quadro geral fotovoltaico (QGF). Quanto maior a distância, maior a seção do cabo necessária para manter a queda de tensão dentro do limite de 2%.',
    example:
      'Fórmula: ΔV(%) = (2 × ρ × L × I) / (S × V) × 100\nOnde ρ = 0,018 Ω·mm²/m (cobre), L = distância, I = corrente, S = seção do cabo.',
    norm: 'NBR 5410:2004, Seção 6.2.6 — Queda de tensão admissível: ≤ 2% para circuitos terminais.',
  },

  // Strings
  strings: {
    title: 'Configuração de Strings',
    description:
      'Uma "string" é um conjunto de módulos fotovoltaicos conectados em série. A tensão total da string (Nº de módulos × Voc) não pode exceder a tensão máxima de entrada do inversor. A corrente de cada string (Isc) deve estar dentro do limite do MPPT.',
    example:
      'Ex: Inversor com Vmáx = 600V e módulo com Voc = 41,5V → Máximo por string: 600 / 41,5 ≈ 14 módulos.\nA faixa MPPT ideal (ex: 150–500V) determina o mínimo e máximo de módulos por string.',
    norm: 'ABNT NBR 16690:2019 — Instalações elétricas de arranjos fotovoltaicos.',
  },

  // Otimizador IA
  optimizeStrings: {
    title: 'Otimização Inteligente de Strings',
    description:
      'A IA analisa as especificações técnicas do inversor selecionado (tensão máxima, faixa MPPT, corrente máxima) e do módulo (Voc, Vmp, Isc) para calcular a melhor distribuição de strings. O objetivo é maximizar a eficiência de cada MPPT respeitando os limites de segurança.',
    example:
      'A IA pode sugerir: "2 strings de 12 módulos" se o inversor possui 2 MPPTs e a faixa de tensão comporta 12 módulos em série.',
  },

  // Diagrama Unifilar
  diagram: {
    title: 'Diagrama Unifilar',
    description:
      'O diagrama unifilar é a representação esquemática do sistema fotovoltaico, desde os módulos até o ponto de entrega da concessionária. É obrigatório no processo de homologação (Light/Enel). O SolarCad gera o diagrama em escala técnica (A4 paisagem, 297×210mm) com selo de engenharia.',
    example:
      'O selo contém: dados do cliente, endereço, UC, potências, nome do engenheiro, CREA e ART. A moldura segue margem esquerda de 20mm (para encadernação) e 7mm nas demais.',
    norm: 'ABNT NBR 5444 — Símbolos gráficos para instalações elétricas. RECON-BT (Light) e CNC-OMBR (Enel).',
  },

  // Justificativa Técnica
  justification: {
    title: 'Justificativa Técnica com IA',
    description:
      'A IA redige um texto formal de engenharia justificando as escolhas técnicas do projeto: dimensionamento de inversores, módulos, proteções e conformidade com normas. O texto é adaptado automaticamente para a concessionária selecionada (Light ou Enel).',
    example:
      'O texto inclui referências a: NBR 5410 (instalações BT), NBR 16690 (arranjos FV), NBR 16149 (interface com rede) e a norma específica da concessionária.',
    norm: 'Resolução ANEEL 482/2012 (atualizada pela 687/2015) e normas ABNT aplicáveis.',
  },

  // Queda de Tensão
  voltageDrop: {
    title: 'Queda de Tensão (ΔV%)',
    description:
      'A queda de tensão representa a perda de tensão ao longo do cabo, causada pela resistência do condutor. A NBR 5410 estabelece que a queda máxima admissível em circuitos terminais é de 2%. Valores acima disso indicam necessidade de cabo com seção maior.',
    example:
      'Fórmula para monofásico: ΔV(%) = (2 × 0,018 × L × I) / (S × V) × 100\nPara trifásico, substitui-se o fator 2 por √3 (1,732).',
    norm: 'NBR 5410:2004 — Seção 6.2.6, Tabela 47.',
  },

  // Proteções
  protections: {
    title: 'Funções de Proteção do Inversor',
    description:
      'Os inversores grid-tie possuem proteções internas obrigatórias: anti-ilhamento, sobretensão (59), subtensão (27), sobrefrequência (81O), subfrequência (81U) e sincronismo (25). Essas funções garantem a segurança da rede e dos técnicos durante manutenção.',
    example:
      '• (27) Subtensão: desliga se V < 0,8pu por mais de 3s.\n• (59) Sobretensão: desliga se V > 1,1pu por mais de 1s.\n• (81) Frequência: opera entre 57,5 e 62 Hz.',
    norm: 'ABNT NBR 16149:2013 — Características da interface de conexão com a rede.',
  },

  // ART
  art: {
    title: 'Anotação de Responsabilidade Técnica (ART)',
    description:
      'A ART é o documento emitido pelo CREA que vincula o engenheiro responsável ao projeto. É obrigatória para homologação em qualquer concessionária.',
    norm: 'Lei Federal 6.496/1977 e Resolução CONFEA 1.025/2009.',
  },
};
