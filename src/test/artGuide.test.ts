import { describe, it, expect } from 'vitest';
import {
  generateArtGuide,
  generateArtTechnicalDescription,
  getConfeaActivities,
  getCftActivities,
  formatPlantAddress,
  summarizeModules,
  summarizeInverters,
  copyArtTextToClipboard,
} from '../services/artGuideService';
import { ProjectState, UtilityCompany, ConnectionType, VoltageLevel } from '../types';

describe('artGuideService — Guia de Preenchimento de ART/TRT (CREA/CFT)', () => {
  const sampleProject: ProjectState = {
    client: {
      name: 'João da Silva Sauro',
      document: '123.456.789-00',
      email: 'joao.sauro@email.com',
      phone: '(21) 98765-4321',
      utilityId: '7654321',
      art: 'ART-RJ-2026-009988',
      address: {
        street: 'Rua das Palmeiras',
        number: '100',
        neighborhood: 'Centro',
        city: 'Niterói',
        state: 'RJ',
        zipCode: '24000-000',
      },
    },
    engineer: {
      name: 'Eng. Luca Rodrigues',
      crea: 'CREA-RJ 2024101234',
    },
    technical: {
      utility: UtilityCompany.LIGHT,
      connectionType: ConnectionType.BIPHASIC,
      voltage: VoltageLevel.V_127_220,
      mainBreaker: 63,
      distance: 15,
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
          brand: 'Growatt',
          model: 'MIN 6000TL-X',
          power: 6.0,
          maxDcVoltage: 550,
          maxInputCurrent: 16,
          mpptMin: 80,
          mpptMax: 500,
          mpptCount: 2,
          nominalOutputVoltage: 220,
          outputPhases: 1,
          inverterType: 'string',
        },
        inverterBrand: 'Growatt',
        inverterModel: 'MIN 6000TL-X',
        inverterPowerKw: 6.0,
        moduleBrand: 'Canadian Solar',
        moduleModel: 'CS7N-650MS',
        modulePowerW: 650,
        moduleQty: 12,
        inverterQty: 1,
        strings: [{ id: 1, count: 6 }, { id: 2, count: 6 }],
      },
    ],
    paperSize: 'A4',
    companyProfile: {
      companyName: 'Solar Engenharia Ltda',
      tradeName: 'SolarTech',
      cnpj: '12.345.678/0001-90',
      email: 'contato@solartech.com.br',
      phone: '(21) 3333-4444',
      address: {
        street: 'Av. Rio Branco',
        number: '1',
        neighborhood: 'Centro',
        city: 'Rio de Janeiro',
        state: 'RJ',
        zipCode: '20040-001',
      },
      legalRepresentative: {
        name: 'Eng. Luca Rodrigues',
        cpf: '111.222.333-44',
        rg: '12345678-9',
        qualification: 'Engenheiro Eletricista',
        creaCft: '2024101234',
        creaState: 'RJ',
        rnp: '1234567890',
        email: 'eng.luca@solartech.com.br',
        phone: '(21) 99999-8888',
      },
    },
  };

  it('formata o endereço completo da usina corretamente', () => {
    const addr = formatPlantAddress(sampleProject);
    expect(addr).toContain('Rua das Palmeiras, 100');
    expect(addr).toContain('Bairro Centro');
    expect(addr).toContain('Niterói/RJ');
    expect(addr).toContain('CEP: 24000-000');
  });

  it('resume módulos e inversores do projeto', () => {
    const modulesSummary = summarizeModules(sampleProject.equipmentBlocks);
    expect(modulesSummary).toBe('12x Módulos Canadian Solar CS7N-650MS (650Wp)');

    const invertersSummary = summarizeInverters(sampleProject.equipmentBlocks);
    expect(invertersSummary).toBe('1x Inversor Growatt MIN 6000TL-X (6kW)');
  });

  it('gera as atividades técnicas do CONFEA / CREA com os códigos corretos', () => {
    const activities = getConfeaActivities(7.8);
    expect(activities).toHaveLength(3);

    const projectAct = activities.find(a => a.code === '02.01.01');
    expect(projectAct).toBeDefined();
    expect(projectAct?.name).toContain('PROJETO');
    expect(projectAct?.quantity).toBe('7.80');
    expect(projectAct?.unit).toBe('kWp');

    const execAct = activities.find(a => a.code === '26.01.01');
    expect(execAct).toBeDefined();
    expect(execAct?.name).toContain('EXECUÇÃO');
    expect(execAct?.quantity).toBe('7.80');
    expect(execAct?.unit).toBe('kWp');
  });

  it('gera as atividades técnicas do CFT / SITAC com os códigos e grupos corretos', () => {
    const activities = getCftActivities(7.8);
    expect(activities).toHaveLength(2);

    const cftProj = activities.find(a => a.code.includes('02'));
    expect(cftProj?.name).toContain('PROJETO DE SISTEMA SOLAR FOTOVOLTAICO');
    expect(cftProj?.quantity).toBe('7.80');

    const cftExec = activities.find(a => a.code.includes('26'));
    expect(cftExec?.name).toContain('EXECUÇÃO DE SISTEMA SOLAR FOTOVOLTAICO');
    expect(cftExec?.quantity).toBe('7.80');
  });

  it('gera a descrição técnica oficial para o campo objeto da ART/TRT', () => {
    const desc = generateArtTechnicalDescription(sampleProject);
    expect(desc).toContain('PROJETO E EXECUÇÃO DE SISTEMA GERADOR SOLAR FOTOVOLTAICO CONECTADO À REDE');
    expect(desc).toContain('7.80 kWp (CC) / 6.00 kW (CA)');
    expect(desc).toContain('João da Silva Sauro');
    expect(desc).toContain('Eng. Luca Rodrigues');
    expect(desc).toContain('LIGHT');
    expect(desc).toContain('(UC) nº 7654321');
    expect(desc).toContain('NBR 5410, NBR 16690');
  });

  it('gera o guia completo com lista de campos granulares para cópia rápida', () => {
    const guide = generateArtGuide(sampleProject);

    expect(guide.totalDcPowerKwp).toBe(7.8);
    expect(guide.totalAcPowerKw).toBe(6.0);
    expect(guide.estimatedMonthlyGenKwh).toBeGreaterThan(0);
    expect(guide.councilType).toBe('CREA');
    expect(guide.fields.length).toBeGreaterThan(15);

    const rtField = guide.fields.find(f => f.id === 'rt_name');
    expect(rtField?.value).toBe('Eng. Luca Rodrigues');

    const clientField = guide.fields.find(f => f.id === 'client_name');
    expect(clientField?.value).toBe('João da Silva Sauro');

    const descField = guide.fields.find(f => f.id === 'art_description_full');
    expect(descField?.value).toContain('PROJETO E EXECUÇÃO');

    expect(guide.fullReportText).toContain('GUIA RÁPIDO DE PREENCHIMENTO DE ART / TRT');
  });

  it('copia texto para clipboard sem lançar exceção no ambiente de testes', async () => {
    const success = await copyArtTextToClipboard('Texto de teste ART');
    expect(typeof success).toBe('boolean');
  });
});
