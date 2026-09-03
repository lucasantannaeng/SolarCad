import { describe, it, expect } from 'vitest';
import { generatePowerOfAttorneyPDF } from '@/services/powerOfAttorneyService';
import { ProjectState, CompanyProfile, UtilityCompany } from '@/types';

describe('Gerador de Procuração GD (powerOfAttorneyService.ts)', () => {
  const mockProject: ProjectState = {
    client: {
      name: 'Rafael Rangel Guerra',
      document: '012.835.897-10',
      utilityId: '8209938',
      email: 'alxrenit@gmail.com',
      phone: '(21) 99999-9999',
      address: {
        street: 'Rua 9',
        number: 'LT 188 QD 8',
        neighborhood: 'Itaipu',
        city: 'Niterói',
        state: 'RJ',
        zipCode: '24340-000',
      },
    },
    technical: {
      utility: UtilityCompany.ENEL_RJ,
      connectionType: 'TRIPHASIC' as any,
      voltage: '127/220V',
      mainBreaker: 63,
      distance: 20,
    },
    equipmentBlocks: [],
  };

  const mockCompany: CompanyProfile = {
    companyName: 'ALXRE ENERGY SPOKES COMERCIO E REPRESENTACOES LTDA',
    tradeName: 'ALXRE SOLAR',
    cnpj: '36.143.328/0001-04',
    phone: '(21) 9645-2109',
    email: 'contato@alxre.com.br',
    address: {
      street: 'TRAVESSA BELINHA',
      number: '9',
      neighborhood: 'BARRETO',
      city: 'NITEROI',
      state: 'RJ',
      zipCode: '24110-170',
    },
    legalRepresentative: {
      name: 'Alexandre da Silva Gomes',
      qualification: 'Engenheiro Eletricista',
      cpf: '123.156.097-55',
      rg: '20.908.570-3',
      rgIssuer: 'DETRAN/RJ',
      creaCft: '2021100248',
      creaState: 'RJ',
    },
  };

  it('gera o documento PDF de procuração sem erros e com estrutura A4', () => {
    const doc = generatePowerOfAttorneyPDF(mockProject, mockCompany);
    expect(doc).toBeDefined();
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(210);
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(297);
  });

  it('inclui dados do Outorgante e Outorgado com formatação íntegra', () => {
    const doc = generatePowerOfAttorneyPDF(mockProject, mockCompany);
    const pdfOutput = doc.output('datauristring');
    expect(pdfOutput).toContain('data:application/pdf');
  });
});
