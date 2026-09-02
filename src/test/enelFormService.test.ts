import { describe, it, expect } from 'vitest';
import {
  extractEnelRateioFormData,
  validateEnelRateio,
  generateEnelRateioPDF,
  generateEnelRateioExcel,
  downloadEnelRateioPDF,
} from '../services/enelFormService';
import { ProjectState, UtilityCompany, ConnectionType, VoltageLevel } from '../types';
import { DEFAULT_MODULE, DEFAULT_INVERTER } from '../constants';

describe('enelFormService — Formulário Oficial Enel RJ Formulario_Rateio_ENEL_Rj.xlsm (Lei 14.300)', () => {
  const mockProject: ProjectState = {
    client: {
      name: 'Engenharia Solar do Brasil LTDA',
      document: '12.345.678/0001-90',
      email: 'contato@engsolar.com.br',
      phone: '(21) 98765-4321',
      utilityId: '98765432',
      art: '2026-ART-001',
      address: {
        street: 'Av. das Américas',
        number: '500',
        neighborhood: 'Barra da Tijuca',
        city: 'Rio de Janeiro',
        state: 'RJ',
        zipCode: '22640-100',
      },
    },
    engineer: {
      name: 'Luca Rodrigues',
      crea: 'RJ-123456/D',
    },
    technical: {
      utility: UtilityCompany.ENEL_RJ,
      connectionType: ConnectionType.TRIPHASIC,
      voltage: VoltageLevel.V_220_380,
      mainBreaker: 100,
      distance: 25,
      dcCableDistance: 15,
    },
    equipmentBlocks: [
      {
        id: 1,
        moduleId: 1,
        inverterId: 1,
        module: DEFAULT_MODULE,
        inverter: DEFAULT_INVERTER,
        inverterBrand: DEFAULT_INVERTER.brand,
        inverterModel: DEFAULT_INVERTER.model,
        inverterPowerKw: DEFAULT_INVERTER.power,
        moduleBrand: DEFAULT_MODULE.brand,
        moduleModel: DEFAULT_MODULE.model,
        modulePowerW: DEFAULT_MODULE.power,
        moduleQty: 40,
        inverterQty: 1,
        strings: [{ id: 1, count: 20 }, { id: 2, count: 20 }],
      },
    ],
    gdType: 'Autoconsumo remoto',
    creditBeneficiaries: [
      {
        id: '1',
        utilityId: '98765432',
        document: '12.345.678/0001-90',
        description: 'UC Geradora (Sede)',
        percentage: 40,
        isGenerator: true,
        averageConsumptionKwh: 800,
      },
      {
        id: '2',
        utilityId: '11223344',
        document: '12.345.678/0001-90',
        description: 'Filial Niterói',
        percentage: 60,
        isGenerator: false,
        averageConsumptionKwh: 1200,
      },
    ],
    paperSize: 'A4',
  };

  it('extrai corretamente os dados estruturados da UC Geradora e Beneficiárias', () => {
    const data = extractEnelRateioFormData(mockProject);
    expect(data.generatorUc).toBe('98765432');
    expect(data.generatorDocument).toBe('12.345.678/0001-90');
    expect(data.generatorName).toBe('Engenharia Solar do Brasil LTDA');
    expect(data.gdType).toBe('Autoconsumo remoto');
    expect(data.beneficiaries).toHaveLength(2);
  });

  it('valida que o total do rateio de 100% com mesma raiz de CNPJ é válido', () => {
    const data = extractEnelRateioFormData(mockProject);
    const result = validateEnelRateio(data);
    expect(result.isValid).toBe(true);
    expect(result.totalPercentage).toBe(100);
  });

  it('gera o PDF oficial da Enel RJ fiel à planilha Formulario_Rateio_ENEL_Rj.xlsm', () => {
    const { fileName, doc } = generateEnelRateioPDF(mockProject);
    expect(fileName).toBe('Engenharia_Solar_do_Brasil_LTDA_Formulário_Rateio_ENEL_Rj.pdf');
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it('gera a planilha Excel (.xlsm) oficial preenchida diretamente do template Formulario_Rateio_ENEL_Rj.xlsm', async () => {
    const { fileName, buffer } = await generateEnelRateioExcel(mockProject);
    expect(fileName).toBe('Engenharia_Solar_do_Brasil_LTDA_Formulario_Rateio_ENEL_Rj.xlsm');
    expect(buffer).toBeDefined();
    expect(buffer.byteLength).toBeGreaterThan(10000);
  });
});
