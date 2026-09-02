import { InverterData, EquipmentBlock } from '@/types';

/**
 * Filtra a lista de inversores com base na topologia selecionada ('micro' ou 'string').
 * - Quando 'micro': estritamente i.inverterType === 'micro'.
 * - Quando 'string' (ou padrão): estritamente i.inverterType !== 'micro'.
 */
export function filterInvertersByType(
  inverters: InverterData[],
  inverterType: 'string' | 'micro' = 'string'
): InverterData[] {
  if (!Array.isArray(inverters)) return [];
  return inverters.filter(i =>
    inverterType === 'micro' ? i.inverterType === 'micro' : i.inverterType !== 'micro'
  );
}

/**
 * Obtém a lista única de marcas a partir de uma lista (já filtrada) de inversores.
 */
export function getUniqueInverterBrands(filteredInverters: InverterData[]): string[] {
  if (!Array.isArray(filteredInverters)) return [];
  return Array.from(new Set(filteredInverters.map(i => i.brand).filter(Boolean)));
}

/**
 * Obtém os modelos disponíveis para uma determinada marca a partir da lista filtrada de inversores.
 */
export function getAvailableInvertersByBrand(
  filteredInverters: InverterData[],
  brand: string
): InverterData[] {
  if (!Array.isArray(filteredInverters) || !brand) return [];
  return filteredInverters.filter(i => i.brand === brand);
}

/**
 * Alterna a topologia do inversor em um bloco de equipamentos ('string' | 'micro').
 * Se o inversor atualmente selecionado não corresponder ao novo tipo selecionado,
 * seleciona automaticamente o primeiro inversor válido correspondente da nova lista filtrada.
 */
export function switchInverterTopology(
  block: EquipmentBlock,
  newType: 'string' | 'micro',
  inverters: InverterData[]
): EquipmentBlock {
  const filtered = filterInvertersByType(inverters, newType);
  const isCurrentMatching = newType === 'micro'
    ? block.inverter?.inverterType === 'micro'
    : block.inverter?.inverterType !== 'micro';

  let nextInverter: InverterData;
  let nextBrand = block.inverterBrand;
  let nextModel = block.inverterModel;
  let nextId = block.inverterId;
  let nextPower = block.inverterPowerKw;

  if (!isCurrentMatching && filtered.length > 0) {
    const first = filtered[0];
    nextInverter = first;
    nextBrand = first.brand;
    nextModel = first.model;
    nextId = first.id;
    nextPower = first.power;
  } else {
    nextInverter = {
      ...block.inverter,
      inverterType: newType,
      mpptCount: newType === 'micro'
        ? (block.inverter?.inverterType === 'micro' ? (block.inverter?.mpptCount || 4) : 4)
        : (block.inverter?.inverterType === 'string' ? (block.inverter?.mpptCount || 2) : 2),
      maxMicrosInSeries: newType === 'micro' ? (block.inverter?.maxMicrosInSeries || 3) : undefined,
      maxInputPowerW: newType === 'micro' ? (block.inverter?.maxInputPowerW || 600) : undefined,
      maxDcVoltage: newType === 'micro'
        ? (block.inverter?.maxDcVoltage && block.inverter.maxDcVoltage <= 80 ? block.inverter.maxDcVoltage : 60)
        : (block.inverter?.maxDcVoltage && block.inverter.maxDcVoltage > 80 ? block.inverter.maxDcVoltage : 600),
    };
  }

  if (newType === 'micro') {
    const defaultPerMicro = nextInverter.mpptCount || 4;
    const perMicro = isCurrentMatching && block.strings && block.strings[0]?.count > 0
      ? block.strings[0].count
      : defaultPerMicro;
    const total = perMicro * (block.inverterQty || 1);
    return {
      ...block,
      inverter: nextInverter,
      inverterBrand: nextBrand,
      inverterModel: nextModel,
      inverterId: nextId,
      inverterPowerKw: nextPower,
      strings: [{ id: 1, count: perMicro }],
      moduleQty: total,
    };
  }

  return {
    ...block,
    inverter: nextInverter,
    inverterBrand: nextBrand,
    inverterModel: nextModel,
    inverterId: nextId,
    inverterPowerKw: nextPower,
  };
}
