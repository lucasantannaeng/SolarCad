import { describe, it, expect, vi } from 'vitest';
import { extractEnelAccessFormData, generateEnelAccessFormPDF, downloadEnelAccessFormPDF } from '../services/enelAccessFormService';
import { ProjectState, UtilityCompany, ConnectionType, VoltageLevel } from '../types';
import { DEFAULT_MODULE, DEFAULT_INVERTER } from '../constants';

describe('enelAccessFormService — Formulário Oficial de Solicitação de Acesso da ENEL Distribuição Rio (CNC-GD)', () => {
  const mockProject: ProjectState = {
    client: {
      name: 'Indústria Metalúrgica Fluminense LTDA',
      document: '33.456.789/0001-99',
      email: 'engenharia@metalurgicaflu.com.br',
      phone: '(21) 98877-1122',
      utilityId: 'UC-77889900',
      art: '2026-ART-554433',
      address: {
        street: 'Avenida Brasil',
        number: '12000',
        neighborhood: 'Penha',
        city: 'Rio de Janeiro',
        state: 'RJ',
        zipCode: '21012-350',
      },
    },
    engineer: {
      name: 'Luca Rodrigues Gomes de Sant\'Anna',
      crea: 'RJ-20269988/D',
    },
    technical: {
      utility: UtilityCompany.ENEL_RJ,
      connectionType: ConnectionType.TRIPHASIC,
      voltage: VoltageLevel.V_220_380,
      mainBreaker: 150,
      distance: 35,
      dcCableDistance: 15,
    },
    equipmentBlocks: [
      {
        id: 1,
        moduleId: 1,
        inverterId: 1,
        module: {
          ...DEFAULT_MODULE,
          brand: 'Canadian Solar',
          model: 'CS6W-550MS',
          power: 550,
          voc: 49.8,
          isc: 14.0,
          vmp: 41.5,
          imp: 13.25,
        },
        inverter: {
          ...DEFAULT_INVERTER,
          brand: 'Sungrow',
          model: 'SG30CX',
          power: 30.0,
          maxDcVoltage: 1100,
          maxInputCurrent: 30.0,
          mpptMin: 200,
          mpptMax: 1000,
          mpptCount: 3,
          nominalOutputVoltage: 380,
          outputPhases: 3,
          inverterType: 'string',
        },
        inverterBrand: 'Sungrow',
        inverterModel: 'SG30CX',
        inverterPowerKw: 30.0,
        moduleBrand: 'Canadian Solar',
        moduleModel: 'CS6W-550MS',
        modulePowerW: 550,
        moduleQty: 60,
        inverterQty: 1,
        strings: [
          { id: 1, count: 20 },
          { id: 2, count: 20 },
          { id: 3, count: 20 },
        ],
      },
    ],
    gdType: 'Autoconsumo remoto',
    paperSize: 'A4',
  };

  it('extrai corretamente os dados para o formulário de acesso da Enel RJ', () => {
    const data = extractEnelAccessFormData(mockProject);
    expect(data.clientName).toBe('Indústria Metalúrgica Fluminense LTDA');
    expect(data.document).toBe('33.456.789/0001-99');
    expect(data.utilityId).toBe('UC-77889900');
    expect(data.art).toBe('2026-ART-554433');
    expect(data.engineerName).toBe('Luca Rodrigues Gomes de Sant\'Anna');
    expect(data.engineerCrea).toBe('RJ-20269988/D');
  });

  it('gera o PDF oficial de Solicitação de Acesso da Enel RJ com nome de arquivo padronizado', () => {
    const { fileName, doc } = generateEnelAccessFormPDF(mockProject);
    expect(fileName).toBe('Industria_Metalurgica_Fluminense_LTDA_Formulario_Acesso_ENEL_RJ.pdf');
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('executa a função downloadEnelAccessFormPDF sem lançar exceções', () => {
    const saveMock = vi.fn();
    const origGenerate = generateEnelAccessFormPDF;
    const { fileName, doc } = origGenerate(mockProject);
    doc.save = saveMock;

    expect(() => {
      downloadEnelAccessFormPDF(mockProject);
    }).not.toThrow();
  });
});
