import { describe, it, expect } from 'vitest';
import { evaluateTransformerNeed } from '../services/transformerDecision';
import { ConnectionType, VoltageLevel } from '../types';

describe('Transformer Decision Matrix (Normas de Concessionárias / NBR 5410)', () => {
  // ═══ REDE 127/220V ═══

  it('Mono 127V + Inv Mono 220V → TRAFO obrigatório', () => {
    const r = evaluateTransformerNeed(ConnectionType.MONOPHASIC, VoltageLevel.V_127_220, 220, 1, 5);
    expect(r.required).toBe(true);
    expect(r.suggestedPowerKva).toBe(6); // ceil(5 × 1.2)
    expect(r.type).toBe('mono');
  });

  it('Mono 127V + Inv Tri 380V → INCOMPATÍVEL', () => {
    const r = evaluateTransformerNeed(ConnectionType.MONOPHASIC, VoltageLevel.V_127_220, 380, 3, 10);
    expect(r.incompatible).toBe(true);
  });

  it('Bi 127/220V + Inv Mono 220V → Sem trafo (F-F)', () => {
    const r = evaluateTransformerNeed(ConnectionType.BIPHASIC, VoltageLevel.V_127_220, 220, 1, 5);
    expect(r.required).toBe(false);
    expect(r.incompatible).toBeUndefined();
  });

  it('Bi 127/220V + Inv Tri → INCOMPATÍVEL', () => {
    const r = evaluateTransformerNeed(ConnectionType.BIPHASIC, VoltageLevel.V_127_220, 380, 3, 10);
    expect(r.incompatible).toBe(true);
  });

  it('Tri 127/220V + Inv Mono 220V → Sem trafo', () => {
    const r = evaluateTransformerNeed(ConnectionType.TRIPHASIC, VoltageLevel.V_127_220, 220, 1, 5);
    expect(r.required).toBe(false);
  });

  it('Tri 127/220V + Inv Tri 220V → Sem trafo', () => {
    const r = evaluateTransformerNeed(ConnectionType.TRIPHASIC, VoltageLevel.V_127_220, 220, 3, 15);
    expect(r.required).toBe(false);
  });

  it('Tri 127/220V + Inv Tri 380V → TRAFO elevador', () => {
    const r = evaluateTransformerNeed(ConnectionType.TRIPHASIC, VoltageLevel.V_127_220, 380, 3, 15);
    expect(r.required).toBe(true);
    expect(r.type).toBe('tri');
    expect(r.suggestedPowerKva).toBe(18); // ceil(15 × 1.2)
  });

  // ═══ REDE 220/380V ═══

  it('Mono 220V + Inv Mono 220V → Sem trafo', () => {
    const r = evaluateTransformerNeed(ConnectionType.MONOPHASIC, VoltageLevel.V_220_380, 220, 1, 5);
    expect(r.required).toBe(false);
  });

  it('Mono 220V + Inv Tri 380V → INCOMPATÍVEL', () => {
    const r = evaluateTransformerNeed(ConnectionType.MONOPHASIC, VoltageLevel.V_220_380, 380, 3, 15);
    expect(r.incompatible).toBe(true);
  });

  it('Tri 220/380V + Inv Tri 380V → Sem trafo (ligação direta)', () => {
    const r = evaluateTransformerNeed(ConnectionType.TRIPHASIC, VoltageLevel.V_220_380, 380, 3, 15);
    expect(r.required).toBe(false);
  });

  it('Tri 220/380V + Inv Tri 220V → TRAFO rebaixador', () => {
    const r = evaluateTransformerNeed(ConnectionType.TRIPHASIC, VoltageLevel.V_220_380, 220, 3, 10);
    expect(r.required).toBe(true);
    expect(r.type).toBe('tri');
  });

  it('Bi 220/380V + Inv Mono 220V → Sem trafo', () => {
    const r = evaluateTransformerNeed(ConnectionType.BIPHASIC, VoltageLevel.V_220_380, 220, 1, 5);
    expect(r.required).toBe(false);
  });
});
