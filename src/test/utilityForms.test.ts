import { describe, it, expect, vi } from 'vitest';
import { extractLightFormData, generateLightFormPDF, downloadLightFormPDF } from '../services/lightFormService';
import { extractCerciFormData, generateCerciFormPDF, downloadCerciFormPDF } from '../services/cerciFormService';
import { extractEnergisaFormData, generateEnergisaFormPDF, downloadEnergisaFormPDF } from '../services/energisaFormService';
import { ProjectState, UtilityCompany, ConnectionType, VoltageLevel } from '../types';
import { DEFAULT_MODULE, DEFAULT_INVERTER } from '../constants';

describe('Serviços de Formulários Oficiais de Concessionárias GD', () => {
  const mockProject: ProjectState = {
    client: {
      name: 'Usina Solar Fazenda Nova Esperança',
      document: '23.456.789/0001-01',
      email: 'contato@fazendanovasolar.com.br',
      phone: '(22) 99887-6655',
      utilityId: 'UC-987654321',
      art: '2026-ART-998877',
      address: {
        street: 'Estrada Municipal Cantagalo-Cordeiro',
        number: 'Km 12',
        neighborhood: 'Zona Rural',
        city: 'Cantagalo',
        state: 'RJ',
        zipCode: '28500-000',
      },
    },
    engineer: {
      name: 'Eng. Luca Rodrigues',
      crea: 'RJ-202612345/D',
    },
    technical: {
      utility: UtilityCompany.LIGHT,
      connectionType: ConnectionType.TRIPHASIC,
      voltage: VoltageLevel.V_220_380,
      mainBreaker: 125,
      distance: 30,
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
          brand: 'Growatt',
          model: 'MID 20KTL3-X',
          power: 20.0,
          maxDcVoltage: 1100,
          maxInputCurrent: 26.0,
          mpptMin: 200,
          mpptMax: 1000,
          mpptCount: 2,
          nominalOutputVoltage: 380,
          outputPhases: 3,
          inverterType: 'string',
        },
        inverterBrand: 'Growatt',
        inverterModel: 'MID 20KTL3-X',
        inverterPowerKw: 20.0,
        moduleBrand: 'Canadian Solar',
        moduleModel: 'CS6W-550MS',
        modulePowerW: 550,
        moduleQty: 48,
        inverterQty: 1,
        strings: [{ id: 1, count: 24 }, { id: 2, count: 24 }],
      },
    ],
    gdType: 'Autoconsumo remoto',
    paperSize: 'A4',
  };

  // ═══════════════════════════════════════════════════════
  // 1. Testes do Formulário da LIGHT S.A. (RECON-BT)
  // ═══════════════════════════════════════════════════
  describe('lightFormService — Light Serviços de Eletricidade S.A.', () => {
    it('extrai corretamente os dados para o formulário da Light', () => {
      const data = extractLightFormData(mockProject);
      expect(data.clientName).toBe('Usina Solar Fazenda Nova Esperança');
      expect(data.document).toBe('23.456.789/0001-01');
      expect(data.utilityId).toBe('UC-987654321');
      expect(data.engineerName).toBe('Eng. Luca Rodrigues');
      expect(data.engineerCrea).toBe('RJ-202612345/D');
      expect(data.art).toBe('2026-ART-998877');
      expect(data.gdType).toBe('Autoconsumo remoto');
      expect(data.addressFull).toContain('Cantagalo');
    });

    it('gera o PDF oficial da Light com nome de arquivo padronizado', () => {
      const { fileName, doc } = generateLightFormPDF(mockProject);
      expect(fileName).toBe('Usina_Solar_Fazenda_Nova_Esperanca_Formulario_Acesso_LIGHT.pdf');
      expect(doc).toBeDefined();
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    });

    it('sanitiza caracteres especiais no nome do cliente para a Light', () => {
      const projectSpecial = {
        ...mockProject,
        client: {
          ...mockProject.client,
          name: 'João & Maria / Comercial: Eletro S.A. (Filial)',
        },
      };
      const { fileName } = generateLightFormPDF(projectSpecial);
      expect(fileName).toBe('Joao_Maria_Comercial_Eletro_S_A_Filial_Formulario_Acesso_LIGHT.pdf');
      expect(fileName.endsWith('_Formulario_Acesso_LIGHT.pdf')).toBe(true);
    });

    it('executa a função downloadLightFormPDF sem lançar exceções', () => {
      const project = { ...mockProject };
      expect(() => downloadLightFormPDF(project)).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════
  // 2. Testes do Formulário da CERCI (Cantagalo/RJ)
  // ═══════════════════════════════════════════════════
  describe('cerciFormService — Cooperativa CERCI (Cantagalo/RJ)', () => {
    const cerciProject: ProjectState = {
      ...mockProject,
      technical: {
        ...mockProject.technical,
        utility: UtilityCompany.CERCI,
      },
    };

    it('extrai corretamente os dados para o formulário da CERCI', () => {
      const data = extractCerciFormData(cerciProject);
      expect(data.clientName).toBe('Usina Solar Fazenda Nova Esperança');
      expect(data.document).toBe('23.456.789/0001-01');
      expect(data.utilityId).toBe('UC-987654321');
      expect(data.engineerName).toBe('Eng. Luca Rodrigues');
      expect(data.engineerCrea).toBe('RJ-202612345/D');
      expect(data.art).toBe('2026-ART-998877');
    });

    it('gera o PDF oficial da CERCI com nome de arquivo padronizado', () => {
      const { fileName, doc } = generateCerciFormPDF(cerciProject);
      expect(fileName).toBe('Usina_Solar_Fazenda_Nova_Esperanca_Formulario_Acesso_CERCI.pdf');
      expect(doc).toBeDefined();
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    });

    it('sanitiza caracteres especiais no nome do cooperado para a CERCI', () => {
      const cerciSpecial = {
        ...cerciProject,
        client: {
          ...cerciProject.client,
          name: 'Sítio Recanto das Flores & Cia / Cantagalo!',
        },
      };
      const { fileName } = generateCerciFormPDF(cerciSpecial);
      expect(fileName).toBe('Sitio_Recanto_das_Flores_Cia_Cantagalo_Formulario_Acesso_CERCI.pdf');
      expect(fileName.endsWith('_Formulario_Acesso_CERCI.pdf')).toBe(true);
    });

    it('executa a função downloadCerciFormPDF sem lançar exceções', () => {
      expect(() => downloadCerciFormPDF(cerciProject)).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════
  // 3. Testes do Formulário da ENERGISA (NDU-013)
  // ═══════════════════════════════════════════════════
  describe('energisaFormService — Grupo Energisa (Norma NDU-013)', () => {
    const energisaProject: ProjectState = {
      ...mockProject,
      client: {
        ...mockProject.client,
        address: {
          street: 'Av. Alberto Braune',
          number: '100',
          neighborhood: 'Centro',
          city: 'Nova Friburgo',
          state: 'RJ',
          zipCode: '28610-000',
        },
      },
      technical: {
        ...mockProject.technical,
        utility: UtilityCompany.ENERGISA,
      },
    };

    it('extrai corretamente os dados para o formulário da Energisa', () => {
      const data = extractEnergisaFormData(energisaProject);
      expect(data.clientName).toBe('Usina Solar Fazenda Nova Esperança');
      expect(data.document).toBe('23.456.789/0001-01');
      expect(data.utilityId).toBe('UC-987654321');
      expect(data.city).toBe('Nova Friburgo');
      expect(data.state).toBe('RJ');
      expect(data.engineerName).toBe('Eng. Luca Rodrigues');
      expect(data.engineerCrea).toBe('RJ-202612345/D');
      expect(data.art).toBe('2026-ART-998877');
    });

    it('gera o PDF oficial da Energisa com nome de arquivo padronizado', () => {
      const { fileName, doc } = generateEnergisaFormPDF(energisaProject);
      expect(fileName).toBe('Usina_Solar_Fazenda_Nova_Esperanca_Formulario_Acesso_ENERGISA.pdf');
      expect(doc).toBeDefined();
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    });

    it('sanitiza caracteres especiais no nome do cliente para a Energisa', () => {
      const energisaSpecial = {
        ...energisaProject,
        client: {
          ...energisaProject.client,
          name: 'Indústria & Comércio de Alimentos São José S/A',
        },
      };
      const { fileName } = generateEnergisaFormPDF(energisaSpecial);
      expect(fileName).toBe('Industria_Comercio_de_Alimentos_Sao_Jose_S_A_Formulario_Acesso_ENERGISA.pdf');
      expect(fileName.endsWith('_Formulario_Acesso_ENERGISA.pdf')).toBe(true);
    });

    it('executa a função downloadEnergisaFormPDF sem lançar exceções', () => {
      expect(() => downloadEnergisaFormPDF(energisaProject)).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════
  // 4. Testes com Múltiplos Blocos e Microinversores
  // ═══════════════════════════════════════════════════
  describe('Suporte a múltiplos blocos de equipamentos e microinversores', () => {
    const multiBlockProject: ProjectState = {
      ...mockProject,
      equipmentBlocks: [
        {
          id: 1,
          moduleId: 1,
          inverterId: 1,
          module: { ...DEFAULT_MODULE, brand: 'Trina', model: 'Vertex 600W', power: 600, voc: 41.7, isc: 18.2, vmp: 34.9, imp: 17.2 },
          inverter: { ...DEFAULT_INVERTER, brand: 'Hoymiles', model: 'HMT-2250-6T', power: 2.25, nominalOutputVoltage: 380, outputPhases: 3, inverterType: 'micro' },
          inverterBrand: 'Hoymiles',
          inverterModel: 'HMT-2250-6T',
          inverterPowerKw: 2.25,
          moduleBrand: 'Trina',
          moduleModel: 'Vertex 600W',
          modulePowerW: 600,
          moduleQty: 12,
          inverterQty: 2,
          strings: [{ id: 1, count: 6 }, { id: 2, count: 6 }],
        },
        {
          id: 2,
          moduleId: 2,
          inverterId: 2,
          module: { ...DEFAULT_MODULE, brand: 'Jinko', model: 'Tiger Neo 575W', power: 575, voc: 51.5, isc: 14.1, vmp: 42.8, imp: 13.4 },
          inverter: { ...DEFAULT_INVERTER, brand: 'Deye', model: 'SUN-10K-SG04LP3', power: 10.0, nominalOutputVoltage: 380, outputPhases: 3, inverterType: 'string' },
          inverterBrand: 'Deye',
          inverterModel: 'SUN-10K-SG04LP3',
          inverterPowerKw: 10.0,
          moduleBrand: 'Jinko',
          moduleModel: 'Tiger Neo 575W',
          modulePowerW: 575,
          moduleQty: 20,
          inverterQty: 1,
          strings: [{ id: 1, count: 10 }, { id: 2, count: 10 }],
        },
      ],
    };

    it('gera os 3 formulários com múltiplos blocos sem erros de paginação ou tabela', () => {
      const light = generateLightFormPDF(multiBlockProject);
      const cerci = generateCerciFormPDF(multiBlockProject);
      const energisa = generateEnergisaFormPDF(multiBlockProject);

      expect(light.doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
      expect(cerci.doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
      expect(energisa.doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    });
  });
});
