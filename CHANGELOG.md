# Changelog — SolarCAD

Todas as alterações notáveis deste projeto são documentadas neste arquivo seguindo as convenções de [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.3.0] — 2026-09-03

### 🚀 Novas Funcionalidades e Engenharia Avançada

- **Motor Determinístico de Otimização de Strings Fotovoltaicas (`stringOptimizer.ts`)**:
  - Algoritmo de engenharia fotovoltaica baseado na **ABNT NBR 16690** e boas práticas de projeto (PVSyst / fabricantes).
  - Cálculo instantâneo (< 5 ms) 100% local com correção térmica de tensão: $V_{oc,max}$ a $10^\circ\text{C}$ e $V_{mp,min}$ a $65^\circ\text{C}$ sob sol pleno.
  - Dimensionamento com FDI / Overpowering ótimo entre $120\%$ e $130\%$ e balanceamento simétrico por MPPT.
  - Suporte nativo completo a **Microinversores** (Hoymiles, Deye Micro, APsystems, NEP, TSUN) com alocação por canal independente de MPPT.

- **Alternador Inteligente de Diagramas CAD 3-em-1**:
  - **Modo 1: Diagrama Unifilar Padrão NBR**: Linha única de potência, proteções CC/CA, String Box e Quadro de Distribuição Solar (QDS).
  - **Modo 2: Diagrama Multifilar / Trifilar (NBR 5410)**: Condutores individuais coloridos por fase (R - Preto, S - Cinza, T - Vermelho), Neutro (Azul Claro) e Terra/PE (Verde), bornes separados e chicote ordenado.
  - **Modo 3: Diagrama de Comunicação & Modbus RTU (Modbus-IDA / IEC 60870-5)**: Topologia serial linear Daisy-Chain de par trançado blindado ($2\times 24$ AWG STP), resistores de terminação de $120\,\Omega$, régua de bornes $A(+)/B(-)/SHD$, Smart Meter 4 quadrantes, TCs toroidais bipartidos instalados no Padrão da Concessionária e Datalogger/Gateway com supervisão.

- **Planta Esquemática 2D de Telhado & Mapeamento de Strings (`StringRoofMapping.tsx`)**:
  - Visualizador 2D interativo organizado pelas águas reais da cobertura e solo.
  - Parametrização completa por bloco de equipamentos: Tipo de Estrutura (Cerâmico, Metálico, Fibrocimento, Laje Plana, Solo, Carport), Azimute Solar com Rosa dos Ventos ($0^\circ$ a $359^\circ$) e Ângulo de Inclinação Tilt ($10^\circ$ a $25^\circ$).

- **Novo Modelo Jurídico Executivo de Procuração GD (`powerOfAttorneyService.ts`)**:
  - Rediagramação completa em PDF de alta resolução com cabeçalho institucional nobre (Lei 14.300/2022 e REN ANEEL 1.000/2021).
  - Cards executivos sem quebra de palavras para Outorgante e Outorgado.
  - Poderes específicos e alíneas padronizadas para as concessionárias Light, Enel RJ, Cerci e Energisa.
  - Assinaturas amplas e desobstruídas, com distância de segurança do rodapé (zero sobreposição).

- **Auditoria Pré-Protocolo & Consulta Automática de Endereço (`cepService.ts`, `preFlightValidator.ts`)**:
  - Busca automática por CEP via BrasilAPI + ViaCEP com preenchimento instantâneo de Logradouro, Bairro, Cidade e UF.
  - Card de Alerta Normativo das Distribuidoras contra reprovas e exigências de vistoria por endereço incompleto.
  - 5 pilares de auditoria pré-protocolo com validações de demanda, disjuntor padrão e documentação obrigatória.

- **Suíte de Formulários Oficiais Multi-Distribuidora**:
  - Geração automatizada de formulários oficiais de Solicitação de Acesso GD para **Light (RECON-BT)**, **Enel RJ (CNC-GD)**, **CERCI (Cooperativa Cantagalo)** e **Energisa (NDU-013)**.
  - Matrizes de Rateio de Créditos GD em PDF e planilha oficial preenchida (`Formulario_Rateio_ENEL_Rj.xlsm`).
  - Dimensionamento da malha de aterramento e eletrodos NBR 5419 / NBR 16690.

### 🐛 Correções de Usabilidade e Estabilidade Visual

- **Alternador A3 ↔ A4 Desbloqueado**: Correção do hook reativo que forçava formato A3; agora permite alternância livre e recálculo instantâneo em qualquer momento.
- **Motor de Pan & Zoom Fluido In-App**: Suporte a escala calibrada de $40\%$ a $300\%$ em passos de $15\%$, botão `Ajustar` (Fit 100%) e scrollbars bidirecionais suaves.
- **Eliminação Definitiva de Sobreposições**:
  - Fim do traço branco espesso que cobria fiações.
  - Textos de módulos, fusíveis e chaves seccionadoras alocados estritamente acima das linhas.
  - Descida CC vertical sem cortar o nome ou texto dos inversores.
  - Placa de advertência amarela NBR 16690 isolada com afastamento seguro do Padrão da Concessionária e do medidor.

---

## [1.2.0] — 2026-09-01
- Suporte a topologia de microinversores com Trunk Cable CA.
- Integração de perfil corporativo da integradora e responsável técnico.
- Exportador de Diagramas em AutoCAD DXF com Blocos Nomeados (AutoCAD Blocks).
- Validações de disjuntores e capacidade de interrupção em kA.
