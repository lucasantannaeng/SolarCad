export enum UtilityCompany {
  LIGHT = 'LIGHT',
  ENEL_RJ = 'ENEL_RJ',
}

export enum ConnectionType {
  MONOPHASIC = 'MONOFASICO',
  BIPHASIC = 'BIFASICO',
  TRIPHASIC = 'TRIFASICO',
}

export enum VoltageLevel {
  V_127_220 = '127/220V',
  V_220_380 = '220/380V',
}

export interface Address {
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface ClientData {
  name: string;
  document: string;
  email: string;
  phone: string;
  utilityId: string;
  art: string;
  address: Address;
}

export interface EngineerData {
  name: string;
  crea: string;
}

export interface ModuleData {
  id: number;
  brand: string;
  model: string;
  power: number;
  voc: number;
  isc: number;
  vmp: number;
  imp: number;
}

export interface InverterData {
  id: number;
  brand: string;
  model: string;
  power: number;
  maxDcVoltage: number;
  maxInputCurrent: number;
  mpptMin: number;
  mpptMax: number;
  mpptCount: number;
  nominalOutputVoltage: number;
  outputPhases: number;
}

export interface StringConfig {
  id: number;
  count: number;
}

export interface TechnicalData {
  utility: UtilityCompany;
  connectionType: ConnectionType;
  voltage: VoltageLevel;
  mainBreaker: number;
  distance: number;
}

export interface EquipmentBlock {
  id: number;
  moduleId: number;
  inverterId: number;
  module: ModuleData;
  inverter: InverterData;
  inverterBrand: string;
  inverterModel: string;
  inverterPowerKw: number;
  moduleBrand: string;
  moduleModel: string;
  modulePowerW: number;
  moduleQty: number;
  inverterQty: number;
  strings: StringConfig[];
}

/** @deprecated Use equipmentBlocks instead */
export interface EquipmentData {
  moduleId: number;
  inverterId: number;
  module: ModuleData;
  inverter: InverterData;
  inverterBrand: string;
  inverterModel: string;
  inverterPowerKw: number;
  moduleBrand: string;
  moduleModel: string;
  modulePowerW: number;
  moduleQty: number;
  inverterQty: number;
  strings: StringConfig[];
}

export interface ProjectState {
  client: ClientData;
  engineer: EngineerData;
  technical: TechnicalData;
  equipmentBlocks: EquipmentBlock[];
  paperSize: string;
}
