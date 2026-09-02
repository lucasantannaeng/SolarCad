import { describe, it, expect } from 'vitest';
import {
  formatCNPJ,
  formatCPF,
  formatPhone,
  formatCEP,
  DEFAULT_COMPANY_PROFILE,
} from '../hooks/useCompanyProfile';
import { generatePowerOfAttorneyPDF } from '../services/powerOfAttorneyService';
import {
  ProjectState,
  CompanyProfile,
  UtilityCompany,
  ConnectionType,
  VoltageLevel,
} from '../types';

describe('SolarCAD — Cadastro Estendido da Empresa Integradora e Procurador Legal', () => {
  describe('1. Utilitários de Máscara e Formatação', () => {
    it('deve formatar CNPJ corretamente', () => {
      expect(formatCNPJ('12345678000195')).toBe('12.345.678/0001-95');
      expect(formatCNPJ('12.345.678/0001-95')).toBe('12.345.678/0001-95');
      expect(formatCNPJ('123')).toBe('12.3');
    });

    it('deve formatar CPF corretamente', () => {
      expect(formatCPF('12345678901')).toBe('123.456.789-01');
      expect(formatCPF('123.456.789-01')).toBe('123.456.789-01');
      expect(formatCPF('1234')).toBe('123.4');
    });

    it('deve formatar Telefone e Celular com DDD', () => {
      expect(formatPhone('21987654321')).toBe('(21) 98765-4321');
      expect(formatPhone('2126201234')).toBe('(21) 2620-1234');
      expect(formatPhone('2198765')).toBe('(21) 9876-5');
    });

    it('deve formatar CEP corretamente', () => {
      expect(formatCEP('28625000')).toBe('28625-000');
      expect(formatCEP('28625-000')).toBe('28625-000');
      expect(formatCEP('286')).toBe('286');
    });
  });

  describe('2. Estrutura Padrão do Perfil da Empresa', () => {
    it('deve conter estrutura válida de empresa, procurador e preferências padrão', () => {
      expect(DEFAULT_COMPANY_PROFILE).toBeDefined();
      expect(DEFAULT_COMPANY_PROFILE.address).toBeDefined();
      expect(DEFAULT_COMPANY_PROFILE.legalRepresentative).toBeDefined();
      expect(DEFAULT_COMPANY_PROFILE.legalRepresentative.qualification).toBe('Engenheiro Eletricista');
      expect(DEFAULT_COMPANY_PROFILE.defaultUtility).toBe(UtilityCompany.LIGHT);
      expect(DEFAULT_COMPANY_PROFILE.defaultArtType).toBe('OBRA_SERVICO');
    });
  });

  describe('3. Geração Oficial de Procuração GD em PDF', () => {
    const mockCompany: CompanyProfile = {
      companyName: 'LUMIERE ENGENHARIA SOLAR LTDA',
      tradeName: 'Lumiere Solar',
      cnpj: '12.345.678/0001-90',
      stateRegistration: '98.765.432',
      email: 'contato@lumieresolar.com.br',
      phone: '(21) 99888-7766',
      address: {
        street: 'Avenida das Américas',
        number: '500, Bloco 2, Sala 301',
        neighborhood: 'Barra da Tijuca',
        city: 'Rio de Janeiro',
        state: 'RJ',
        zipCode: '22640-100',
      },
      legalRepresentative: {
        name: 'Luca Rodrigues Gomes de Sant\'Anna',
        cpf: '123.456.789-00',
        rg: '20.123.456-7',
        rgIssuer: 'DETRAN/RJ',
        qualification: 'Engenheiro Eletricista e Responsável Técnico',
        creaCft: '2019102450',
        creaState: 'RJ',
        rnp: '1409823450',
        email: 'engenharia@lumieresolar.com.br',
        phone: '(21) 99888-7766',
      },
      defaultUtility: UtilityCompany.LIGHT,
      defaultArtType: 'OBRA_SERVICO',
    };

    const mockProject: ProjectState = {
      client: {
        name: 'Carlos Eduardo da Silva',
        document: '987.654.321-11',
        email: 'carlos.silva@gmail.com',
        phone: '(21) 98765-4321',
        utilityId: '0045892301',
        art: '2026/0129348',
        address: {
          street: 'Rua das Laranjeiras',
          number: '120',
          neighborhood: 'Laranjeiras',
          city: 'Rio de Janeiro',
          state: 'RJ',
          zipCode: '22240-000',
        },
      },
      engineer: {
        name: 'Luca Rodrigues Gomes de Sant\'Anna',
        crea: '2019102450/RJ',
      },
      technical: {
        utility: UtilityCompany.LIGHT,
        connectionType: ConnectionType.BIPHASIC,
        voltage: VoltageLevel.V_127_220,
        mainBreaker: 63,
        distance: 15,
        dcCableDistance: 15,
      },
      equipmentBlocks: [],
      paperSize: 'A4',
      companyProfile: mockCompany,
    };

    it('deve gerar o documento PDF de Procuração GD com sucesso', () => {
      const doc = generatePowerOfAttorneyPDF(mockProject, mockCompany);
      expect(doc).toBeDefined();
      expect(doc.internal.pages.length).toBeGreaterThan(1);
    });

    it('deve gerar procurações customizadas para diferentes concessionárias', () => {
      const utilities = [
        UtilityCompany.LIGHT,
        UtilityCompany.ENEL_RJ,
        UtilityCompany.CERCI,
        UtilityCompany.ENERGISA,
      ];

      for (const util of utilities) {
        const projectWithUtil: ProjectState = {
          ...mockProject,
          technical: { ...mockProject.technical, utility: util },
        };
        const doc = generatePowerOfAttorneyPDF(projectWithUtil, mockCompany);
        expect(doc).toBeDefined();
      }
    });

    it('deve tratar com resiliência campos parciais ou ausentes', () => {
      const minimalProject: ProjectState = {
        client: {
          name: 'Maria Oliveira',
          document: '',
          email: '',
          phone: '',
          utilityId: '',
          art: '',
          address: { street: '', number: '', neighborhood: '', city: '', state: 'RJ', zipCode: '' },
        },
        engineer: { name: '', crea: '' },
        technical: {
          utility: UtilityCompany.ENEL_RJ,
          connectionType: ConnectionType.MONOPHASIC,
          voltage: VoltageLevel.V_127_220,
          mainBreaker: 40,
          distance: 10,
        },
        equipmentBlocks: [],
        paperSize: 'A4',
      };

      const doc = generatePowerOfAttorneyPDF(minimalProject, DEFAULT_COMPANY_PROFILE);
      expect(doc).toBeDefined();
      expect(doc.internal.pages.length).toBeGreaterThan(1);
    });
  });
});
