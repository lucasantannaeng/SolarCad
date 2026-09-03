import { describe, it, expect } from 'vitest';
import {
  extractCreditMatrixData,
  getUtilityMatrixConfig,
  generateCreditMatrixPDF,
  generateCreditMatrixExcel,
} from '../services/creditMatrixService';
import { ProjectState, UtilityCompany, ConnectionType, VoltageLevel } from '../types';

describe('creditMatrixService — Matriz de Rateio GD Multi-Concessionária', () => {
  const baseProject: ProjectState = {
    client: {
      name: 'Supermercado Progresso Ltda',
      document: '12.345.678/0001-99',
      email: 'financeiro@progresso.com.br',
      phone: '(21) 2233-4455',
      utilityId: '10203040',
      art: 'ART-2026-9988',
      address: {
        street: 'Av. Brasil',
        number: '5000',
        neighborhood: 'Bonsucesso',
        city: 'Rio de Janeiro',
        state: 'RJ',
        zipCode: '21040-360',
      },
    },
    engineer: {
      name: 'Eng. Luca Rodrigues',
      crea: 'CREA-RJ 2024101234',
    },
    technical: {
      utility: UtilityCompany.LIGHT,
      connectionType: ConnectionType.TRIPHASIC,
      voltage: VoltageLevel.V_127_220,
      mainBreaker: 100,
      distance: 20,
      dcCableDistance: 15,
    },
    equipmentBlocks: [
      {
        id: 1,
        moduleId: 1,
        inverterId: 1,
        module: {
          id: 1,
          brand: 'Canadian Solar',
          model: 'CS7N-650MS',
          power: 650,
          voc: 45,
          isc: 18,
          vmp: 38,
          imp: 17,
        },
        inverter: {
          id: 1,
          brand: 'Sungrow',
          model: 'SG15RT',
          power: 15.0,
          maxDcVoltage: 1100,
          maxInputCurrent: 32,
          mpptMin: 160,
          mpptMax: 1000,
          mpptCount: 2,
          nominalOutputVoltage: 220,
          outputPhases: 3,
          inverterType: 'string',
        },
        inverterBrand: 'Sungrow',
        inverterModel: 'SG15RT',
        inverterPowerKw: 15.0,
        moduleBrand: 'Canadian Solar',
        moduleModel: 'CS7N-650MS',
        modulePowerW: 650,
        moduleQty: 30,
        inverterQty: 1,
        strings: [{ id: 1, count: 15 }, { id: 2, count: 15 }],
      },
    ],
    creditBeneficiaries: [
      { id: '1', utilityId: '10203040', document: '12.345.678/0001-99', description: 'Matriz Bonsucesso (UCP)', percentage: 40, isGenerator: true, averageConsumptionKwh: 800 },
      { id: '2', utilityId: '20304050', document: '12.345.678/0002-77', description: 'Filial Centro', percentage: 35, averageConsumptionKwh: 650 },
      { id: '3', utilityId: '30405060', document: '12.345.678/0003-55', description: 'Filial Niterói', percentage: 25, averageConsumptionKwh: 500 },
    ],
    paperSize: 'A4',
  };

  it('retorna a configuração correta para cada distribuidora', () => {
    const lightCfg = getUtilityMatrixConfig(UtilityCompany.LIGHT);
    expect(lightCfg.label).toContain('LIGHT');
    expect(lightCfg.normativeRef).toContain('RECON-BT');

    const cerciCfg = getUtilityMatrixConfig(UtilityCompany.CERCI);
    expect(cerciCfg.label).toContain('CERCI');
    expect(cerciCfg.normativeRef).toContain('Cantagalo');

    const energisaCfg = getUtilityMatrixConfig(UtilityCompany.ENERGISA);
    expect(energisaCfg.label).toContain('ENERGISA');
    expect(energisaCfg.normativeRef).toContain('NDU-013');

    const enelCfg = getUtilityMatrixConfig(UtilityCompany.ENEL_RJ);
    expect(enelCfg.label).toContain('ENEL');
  });

  it('extrai dados normalizados e valida rateio 100% alocado', () => {
    const data = extractCreditMatrixData(baseProject);

    expect(data.generatorUc).toBe('10203040');
    expect(data.generatorName).toBe('Supermercado Progresso Ltda');
    expect(data.totalPercentage).toBe(100);
    expect(data.isValid).toBe(true);
    expect(data.beneficiaries.length).toBe(3);
    expect(data.monthlyGenerationKwh).toBeGreaterThan(0);
  });

  it('gera documento PDF de Rateio para a Light (RECON-BT)', () => {
    const { fileName, doc } = generateCreditMatrixPDF(baseProject);

    expect(fileName).toContain('Matriz_Rateio_LIGHT_RECON_BT.pdf');
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('gera documento PDF de Rateio para a CERCI (Cantagalo)', () => {
    const cerciProject = {
      ...baseProject,
      technical: { ...baseProject.technical, utility: UtilityCompany.CERCI },
    };
    const { fileName, doc } = generateCreditMatrixPDF(cerciProject);

    expect(fileName).toContain('Matriz_Rateio_CERCI_CANTAGALO.pdf');
    expect(doc).toBeDefined();
  });

  it('gera documento PDF de Rateio para a Energisa (NDU-013)', () => {
    const energisaProject = {
      ...baseProject,
      technical: { ...baseProject.technical, utility: UtilityCompany.ENERGISA },
    };
    const { fileName, doc } = generateCreditMatrixPDF(energisaProject);

    expect(fileName).toContain('Matriz_Rateio_ENERGISA_NDU013.pdf');
    expect(doc).toBeDefined();
  });

  it('gera planilha Excel (.xlsx) estruturada com fórmulas e formatação multi-concessionária', async () => {
    const { fileName, buffer } = await generateCreditMatrixExcel(baseProject);

    expect(fileName).toContain('.xlsx');
    expect(buffer).toBeDefined();
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });
});
