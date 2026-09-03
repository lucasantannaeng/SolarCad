/**
 * Motor Determinístico de Otimização e Dimensionamento de Strings Fotovoltaicas
 * SolarCAD - Engenharia de Sistemas Fotovoltaicos
 *
 * Normas e Referências:
 * - ABNT NBR 16690: Instalações elétricas de arranjos fotovoltaicos
 * - ABNT NBR 5410: Instalações elétricas de baixa tensão
 * - IEC 62548: Photovoltaic (PV) arrays - Design requirements
 * - PVSyst / SMA / Fronius / Growatt Engineering Guidelines (FDI 115% - 135%)
 */

import { ModuleData, InverterData } from '@/types';

export interface StringOptimizationResult {
  strings: { id: number; count: number }[];
  totalModules: number;
  dcPowerKwp: number;
  dcAcRatio: number;
  vocString: number;
  vmpString: number;
  explanation: string;
}

/**
 * Calcula a configuração ideal recomendada para o bloco de equipamentos selecionado.
 * 100% determinístico, baseado em critérios normativos e boas práticas de engenharia.
 */
export function calculateOptimalStringConfig(
  module: ModuleData,
  inverter: InverterData,
  inverterQty: number = 1
): StringOptimizationResult {
  const isMicro = inverter.inverterType === 'micro';
  const qty = Math.max(1, inverterQty);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. TOPOLOGIA MICROINVERSOR (Hoymiles, APsystems, Deye Micro, NEP, TSUN)
  // ─────────────────────────────────────────────────────────────────────────────
  if (isMicro) {
    // Entradas MPPT por micro (padrão: 4 para quad, 2 para duo, 1 para mono)
    const mpptPerMicro = inverter.mpptCount || (inverter.power >= 1.8 ? 4 : (inverter.power >= 0.8 ? 2 : 1));
    const modsPerMicro = mpptPerMicro;
    const totalModules = modsPerMicro * qty;
    const dcPowerKwp = Number(((totalModules * module.power) / 1000).toFixed(2));
    const totalAcPowerKw = inverter.power * qty;
    const dcAcRatio = Number((dcPowerKwp / totalAcPowerKw).toFixed(2));

    const vocString = module.voc;
    const vmpString = module.vmp;

    const explanation = `Topologia de Microinversor Otimizada: ${modsPerMicro} módulo(s) por microinversor (1 módulo por entrada MPPT individual). Total de ${totalModules} módulo(s) para ${qty} microinversor(es). Potência CC: ${dcPowerKwp} kWp (FDI: ${(dcAcRatio * 100).toFixed(0)}%). Tensão CC segura por entrada: ${vocString.toFixed(1)}V (Voc) / ${vmpString.toFixed(1)}V (Vmp).`;

    return {
      strings: [{ id: 1, count: modsPerMicro }],
      totalModules,
      dcPowerKwp,
      dcAcRatio,
      vocString,
      vmpString,
      explanation,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. TOPOLOGIA INVERSOR STRING / CENTRAL (Growatt, Deye, Solis, Sungrow, Fronius)
  // ─────────────────────────────────────────────────────────────────────────────

  // Parâmetros climáticos de projeto (Brasil)
  const T_MIN = 10; // Temperatura ambiente mínima de projeto (°C)
  const T_MAX_CELL = 65; // Temperatura de célula máxima sob sol pleno (°C)
  const GAMMA_VOC = -0.0028; // Coeficiente de temperatura de Voc (-0.28%/°C)
  const GAMMA_VMP = -0.0035; // Coeficiente de temperatura de Vmp (-0.35%/°C)

  // Tensões com correção térmica
  const vocMaxCold = module.voc * (1 + GAMMA_VOC * (T_MIN - 25));
  const vmpMinHot = module.vmp * (1 + GAMMA_VMP * (T_MAX_CELL - 25));

  // Limites elétricos do Inversor
  const vdcMax = inverter.maxDcVoltage || 1000;
  const vmpptMin = inverter.mpptMin || 160;
  const vmpptMax = inverter.mpptMax || 850;

  // 1. Limite Máximo de Módulos por String (Margem de Segurança de 5% abaixo de VdcMax)
  const maxModulesPerString = Math.floor((vdcMax * 0.95) / vocMaxCold);

  // 2. Limite Mínimo de Módulos por String (Para garantir partida e rastreamento MPPT)
  const minModulesPerString = Math.max(3, Math.ceil((vmpptMin * 1.1) / vmpMinHot));

  // 3. Tensão Nominal Ótima do MPPT (Ponto de Máxima Eficiência de Conversão)
  const vOptTarget = (vmpptMin + vmpptMax) * 0.55;
  const optimalModulesPerString = Math.max(
    minModulesPerString,
    Math.min(maxModulesPerString, Math.round(vOptTarget / module.vmp))
  );

  // 4. Potência CC Alvo para FDI Ideal (125% - Overpowering Recomendado NBR / Fabricantes)
  const TARGET_FDI = 1.25;
  const targetDcPowerW = inverter.power * qty * TARGET_FDI * 1000;
  const idealTotalModules = Math.round(targetDcPowerW / module.power);

  // 5. Número de Entradas / MPPTs do Inversor
  let numMppts = inverter.mpptCount || 1;
  if (numMppts === 1 && inverter.power >= 10) {
    numMppts = 2;
  } else if (inverter.power >= 40) {
    numMppts = Math.max(numMppts, 4);
  }

  // 6. Distribuição Equilibrada das Strings
  let bestStrings: { id: number; count: number }[] = [];
  let bestDiff = Infinity;

  // Quantidade mínima de strings necessárias para não estourar a tensão máxima de circuito aberto
  const minStringsForMaxVoltage = Math.ceil(idealTotalModules / maxModulesPerString);
  const maxStringsToTest = Math.max(minStringsForMaxVoltage * 2, numMppts * 2, 8);

  for (let numStr = 1; numStr <= maxStringsToTest; numStr++) {
    const isSymmetric = numStr % numMppts === 0 || numMppts % numStr === 0;
    const perStr = Math.round(idealTotalModules / numStr);

    if (perStr >= minModulesPerString && perStr <= maxModulesPerString) {
      const currentTotal = perStr * numStr;
      const currentDcKwp = (currentTotal * module.power) / 1000;
      const currentFdi = currentDcKwp / (inverter.power * qty);
      const fdiDiff = Math.abs(currentFdi - TARGET_FDI);
      const symmetryPenalty = isSymmetric ? 0 : 0.05;
      const totalScore = fdiDiff + symmetryPenalty;

      if (totalScore < bestDiff) {
        bestDiff = totalScore;
        bestStrings = Array.from({ length: numStr }, (_, i) => ({
          id: i + 1,
          count: perStr,
        }));
      }
    }
  }

  // Fallback de segurança se nenhuma opção perfeita for encontrada dentro dos limites
  if (bestStrings.length === 0) {
    const safeCount = Math.max(minModulesPerString, Math.min(maxModulesPerString, optimalModulesPerString));
    bestStrings = [{ id: 1, count: safeCount }];
  }

  const finalTotalModules = bestStrings.reduce((acc, s) => acc + s.count, 0);
  const dcPowerKwp = Number(((finalTotalModules * module.power) / 1000).toFixed(2));
  const totalAcPowerKw = inverter.power * qty;
  const dcAcRatio = Number((dcPowerKwp / totalAcPowerKw).toFixed(2));

  const avgCount = bestStrings[0]?.count || 10;
  const vocString = Number((avgCount * module.voc).toFixed(1));
  const vmpString = Number((avgCount * module.vmp).toFixed(1));

  const explanation = `Configuração Ideal: ${bestStrings.length} string(s) de ${avgCount} módulos (${finalTotalModules} módulos no total). Potência CC: ${dcPowerKwp} kWp (FDI: ${(dcAcRatio * 100).toFixed(0)}%). Faixa de Tensão: Voc = ${vocString}V (Máx. seguro: ${vdcMax}V) | Vmp = ${vmpString}V (Faixa MPPT: ${vmpptMin}V a ${vmpptMax}V). Rastreamento ótimo com máxima eficiência.`;

  return {
    strings: bestStrings,
    totalModules: finalTotalModules,
    dcPowerKwp,
    dcAcRatio,
    vocString,
    vmpString,
    explanation,
  };
}
