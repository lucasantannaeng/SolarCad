import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export interface OcrResult {
  clientName: string;
  address: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
  };
  utilityId: string;
  utility: string;
  consumptionHistory: { month: string; kwh: number }[];
  class?: string;
  subgroup?: string;
  tariffModality?: string;
  supplyType?: string;
  supplyVoltage?: string;
  contractedDemandKw?: number;
  averageConsumptionKwh?: number;
}

export interface StringOptimizationResult {
  strings: { id: number; count: number }[];
  totalModules: number;
  dcPowerKwp: number;
  dcAcRatio: number;
  vocString: number;
  vmpString: number;
  explanation: string;
}

export interface JustificationResult {
  justification: string;
}

async function callEdgeFunction<T>(functionName: string, body: any): Promise<T> {
  const { data, error } = await supabase.functions.invoke(functionName, { body });
  
  if (error) throw new Error(error.message || 'Erro na chamada da função');
  if (data?.error) throw new Error(data.error);
  
  return data as T;
}

export async function ocrEnergyBill(file: File): Promise<OcrResult> {
  const base64 = await fileToBase64(file);
  return callEdgeFunction<OcrResult>('ocr-energy-bill', {
    imageBase64: base64,
    mimeType: file.type,
  });
}

export async function optimizeStrings(
  module: { brand: string; model: string; power: number; voc: number; vmp: number; isc: number; imp: number },
  inverter: { brand: string; model: string; power: number; maxDcVoltage: number; maxInputCurrent: number; mpptMin: number; mpptMax: number; mpptCount: number },
  inverterQty: number
): Promise<StringOptimizationResult> {
  return callEdgeFunction<StringOptimizationResult>('optimize-strings', {
    module,
    inverter,
    inverterQty,
  });
}

export async function generateJustification(project: {
  clientName: string;
  address: string;
  utility: string;
  connectionType: string;
  voltage: string;
  mainBreaker: number;
  distance: number;
  equipmentBlocks: any[];
  totalDcPower: number;
  totalAcPower: number;
}): Promise<JustificationResult> {
  return callEdgeFunction<JustificationResult>('generate-justification', { project });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data:...;base64, prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
