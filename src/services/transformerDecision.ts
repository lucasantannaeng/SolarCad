/**
 * Transformer Necessity Decision — Matriz de Fases e Compatibilidade de Tensão
 * Conforme normas das distribuidoras de energia e ABNT NBR 5410.
 */
import { ConnectionType, VoltageLevel } from '../types';

export interface TransformerResult {
  required: boolean;
  reason: string;
  suggestedPowerKva?: number;
  type?: 'mono' | 'tri';
  incompatible?: boolean;
}

/**
 * Avalia a necessidade de transformador isolador/acoplador baseado na
 * matriz combinatória: fase_rede × tensão_rede × fase_inversor × tensão_inversor.
 */
export function evaluateTransformerNeed(
  connectionType: ConnectionType,
  voltage: VoltageLevel,
  inverterOutputVoltage: number,
  inverterOutputPhases: number,
  inverterPowerKw: number,
): TransformerResult {
  const is127_220 = voltage === VoltageLevel.V_127_220;
  const is220_380 = voltage === VoltageLevel.V_220_380;
  const isMono = connectionType === ConnectionType.MONOPHASIC;
  const isBi = connectionType === ConnectionType.BIPHASIC;
  const isTri = connectionType === ConnectionType.TRIPHASIC;
  const invMono = inverterOutputPhases === 1;
  const invTri = inverterOutputPhases === 3;
  const inv220 = inverterOutputVoltage <= 240; // 220V nominal (range 200-240)
  const inv380 = inverterOutputVoltage > 240;  // 380V nominal (range 340-420)

  const trafoPowerKva = Math.ceil(inverterPowerKw * 1.2);

  // ═══════════════════════════════════════════════════════
  // REDE 127/220V (Fase-Neutro=127V, Fase-Fase=220V)
  // ═══════════════════════════════════════════════════════
  if (is127_220) {
    if (isMono) {
      if (invMono && inv220) {
        // Mono 127V F-N + Inversor Mono 220V → TRAFO obrigatório (127→220)
        return {
          required: true,
          reason: 'Rede monofásica 127V (F-N) incompatível com inversor 220V. Transformador 127/220V necessário.',
          suggestedPowerKva: trafoPowerKva,
          type: 'mono',
        };
      }
      if (invTri) {
        // Mono + Inversor Trifásico → INCOMPATÍVEL
        return {
          required: false,
          reason: 'Inversor trifásico não pode ser conectado a padrão monofásico. Solicitar aumento de carga/fases à concessionária.',
          incompatible: true,
        };
      }
    }

    if (isBi) {
      if (invMono && inv220) {
        // Bi 127/220V + Inversor Mono 220V → Sem trafo (conexão Fase-Fase = 220V)
        return {
          required: false,
          reason: 'Conexão fase-fase (220V) disponível no padrão bifásico. Sem necessidade de transformador.',
        };
      }
      if (invTri) {
        // Bi + Inversor Trifásico → INCOMPATÍVEL
        return {
          required: false,
          reason: 'Inversor trifásico não pode ser conectado a padrão bifásico. Solicitar aumento de carga/fases à concessionária.',
          incompatible: true,
        };
      }
    }

    if (isTri) {
      if (invMono && inv220) {
        // Tri 127/220V + Inversor Mono 220V → Sem trafo (F-F = 220V)
        return {
          required: false,
          reason: 'Conexão fase-fase (220V) disponível no padrão trifásico. Sem necessidade de transformador.',
        };
      }
      if (invTri && inv220) {
        // Tri 127/220V + Inversor Tri 220V → Sem trafo
        return {
          required: false,
          reason: 'Tensão de linha da rede (220V) compatível com inversor trifásico 220V.',
        };
      }
      if (invTri && inv380) {
        // Tri 127/220V + Inversor Tri 380V → TRAFO elevador
        return {
          required: true,
          reason: 'Rede trifásica 127/220V incompatível com inversor trifásico 380V. Transformador elevador 220/380V necessário.',
          suggestedPowerKva: trafoPowerKva,
          type: 'tri',
        };
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  // REDE 220/380V (Fase-Neutro=220V, Fase-Fase=380V)
  // ═══════════════════════════════════════════════════════
  if (is220_380) {
    if (isMono) {
      if (invMono && inv220) {
        // Mono 220V F-N + Inversor Mono 220V → Sem trafo
        return {
          required: false,
          reason: 'Tensão fase-neutro da rede (220V) compatível com inversor monofásico 220V.',
        };
      }
      if (invTri) {
        // Mono + Inversor Trifásico → INCOMPATÍVEL
        return {
          required: false,
          reason: 'Inversor trifásico não pode ser conectado a padrão monofásico. Solicitar aumento de carga/fases à concessionária.',
          incompatible: true,
        };
      }
    }

    if (isBi || isTri) {
      if (invMono && inv220) {
        // Bi/Tri 220/380V + Inversor Mono 220V → Sem trafo (F-N = 220V)
        return {
          required: false,
          reason: 'Tensão fase-neutro da rede (220V) compatível com inversor monofásico 220V.',
        };
      }
      if (invTri && inv380) {
        // Bi/Tri 220/380V + Inversor Tri 380V → Sem trafo (ligação direta)
        return {
          required: false,
          reason: 'Tensão de linha da rede (380V) compatível com inversor trifásico 380V. Ligação direta.',
        };
      }
      if (invTri && inv220) {
        // Bi/Tri 220/380V + Inversor Tri 220V → TRAFO rebaixador
        return {
          required: true,
          reason: 'Rede 220/380V incompatível com inversor trifásico 220V. Transformador rebaixador 380/220V necessário.',
          suggestedPowerKva: trafoPowerKva,
          type: 'tri',
        };
      }
    }
  }

  // Fallback: usa regra de diferença percentual para casos não mapeados
  const lineVoltage = is127_220 ? 220 : 380;
  const voltageDiff = Math.abs(inverterOutputVoltage - lineVoltage);
  if (voltageDiff > lineVoltage * 0.1) {
    return {
      required: true,
      reason: `Diferença de tensão (${inverterOutputVoltage}V vs ${lineVoltage}V) superior a 10%. Transformador necessário.`,
      suggestedPowerKva: trafoPowerKva,
      type: invTri ? 'tri' : 'mono',
    };
  }

  return {
    required: false,
    reason: 'Tensão do inversor compatível com a rede.',
  };
}
