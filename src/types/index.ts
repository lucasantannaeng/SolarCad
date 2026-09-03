export enum UtilityCompany {
  LIGHT = 'LIGHT',
  ENEL_RJ = 'ENEL_RJ',
  CERCI = 'CERCI',
  ENERGISA = 'ENERGISA',
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
  complement?: string;
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
  /** 'string' = inversor central/string, 'micro' = microinversor */
  inverterType: 'string' | 'micro';
  /** Máximo de microinversores em série no trunk cable (apenas micro) */
  maxMicrosInSeries?: number;
  /** Potência máxima por entrada MPPT em watts (apenas micro) */
  maxInputPowerW?: number;
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
  /** Distância módulos→inversor em metros (para queda de tensão CC). Default 15m */
  dcCableDistance: number;
}

export type StructureType =
  | 'CERAMIC'
  | 'METALLIC'
  | 'FIBROCEMENT'
  | 'FLAT_SLAB'
  | 'GROUND'
  | 'CARPORT';

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
  /** Tipo de estrutura de fixação / telhado */
  structureType?: StructureType | string;
  /** Identificação da Água do Telhado / Local (ex: 'Água 1 (Norte - Telhado Principal)', 'Água 2 (Leste - Garagem)', 'Solo') */
  roofPlaneName?: string;
  /** Azimute em graus (ex: 0=Norte, 45=NE, 90=Leste, 135=SE, 180=Sul, 225=SO, 270=Oeste, 315=NO) */
  azimuth?: number;
  /** Inclinação da estrutura em graus (ex: 15°) */
  tilt?: number;
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
  structureType?: StructureType | string;
  roofPlaneName?: string;
  azimuth?: number;
  tilt?: number;
}

export type GDType = 
  | 'Autoconsumo remoto' 
  | 'Consumo Local' 
  | 'Geração Compartilhada' 
  | 'Empreendimento com Múltiplas Unidades';

export interface CreditBeneficiary {
  id: string;
  utilityId: string;
  document: string;
  description: string;
  percentage: number;
  isGenerator?: boolean;
  averageConsumptionKwh?: number;
}

export interface LegalRepresentative {
  name: string;
  cpf: string;
  rg: string;
  rgIssuer?: string;
  qualification: string; // Ex: 'Engenheiro Eletricista', 'Técnico em Eletrotécnica'
  creaCft: string;
  creaState: string;
  rnp?: string;
  email: string;
  phone: string;
}

export interface CompanyProfile {
  companyName: string;
  tradeName: string;
  cnpj: string;
  stateRegistration?: string;
  email: string;
  phone: string;
  address: Address;
  legalRepresentative: LegalRepresentative;
  defaultUtility?: UtilityCompany;
  defaultArtType?: 'OBRA_SERVICO' | 'CARGO_FUNCAO' | 'MULTIPLA';
}

export interface ProjectState {
  client: ClientData;
  engineer: EngineerData;
  technical: TechnicalData;
  equipmentBlocks: EquipmentBlock[];
  creditBeneficiaries?: CreditBeneficiary[];
  gdType?: GDType;
  paperSize: string;
  companyProfile?: CompanyProfile;
}

