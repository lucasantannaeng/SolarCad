import { describe, it, expect } from 'vitest';
import { validateProjectPreFlight, calculateGridEntryCapacityKw } from '../services/preFlightValidator';
import { ProjectState, UtilityCompany, ConnectionType, VoltageLevel } from '../types';

describe('preFlightValidator — Auditoria Técnica Pré-Protocolo (Anti-Exigência)', () => {
  const createValidProject = (): ProjectState => ({
    client: {
      name: 'Maria Antônia Pereira',
      document: '987.654.321-11',
      email: 'maria@email.com',
      phone: '(21) 99888-7777',
      utilityId: '88776655',
      art: 'ART-2026-123456',
      address: {
        street: 'Avenida Atlântica',
        number: '1500',
        neighborhood: 'Copacabana',
        city: 'Rio de Janeiro',
        state: 'RJ',
        zipCode: '22021-001',
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
      mainBreaker: 63,
      distance: 10,
      dcCableDistance: 15,
    },
    equipmentBlocks: [
      {
        id: 1,
        moduleId: 1,
        inverterId: 1,
        module: {
          id: 1,
          brand: 'JA Solar',
          model: 'JAM72S30-550',
          power: 550,
          voc: 49.8,
          isc: 14.0,
          vmp: 41.9,
          imp: 13.1,
        },
        inverter: {
          id: 1,
          brand: 'Sungrow',
          model: 'SG10RT',
          power: 10.0,
          maxDcVoltage: 1000,
          maxInputCurrent: 25,
          mpptMin: 160,
          mpptMax: 1000,
          mpptCount: 2,
          nominalOutputVoltage: 220,
          outputPhases: 3,
          inverterType: 'string',
        },
        inverterBrand: 'Sungrow',
        inverterModel: 'SG10RT',
        inverterPowerKw: 10.0,
        moduleBrand: 'JA Solar',
        moduleModel: 'JAM72S30-550',
        modulePowerW: 550,
        moduleQty: 20,
        inverterQty: 1,
        strings: [{ id: 1, count: 10 }, { id: 2, count: 10 }],
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
  });

  it('calcula corretamente a capacidade do padrão de entrada em kW', () => {
    // Trifásico 220V com disjuntor de 63A: sqrt(3) * 220 * 63 / 1000 ~= 24.0 kW
    const triCapacity = calculateGridEntryCapacityKw(ConnectionType.TRIPHASIC, VoltageLevel.V_127_220, 63);
    expect(triCapacity).toBeCloseTo(24.0, 0.5);

    // Bifásico 127/220V com disjuntor de 63A: 2 * 127 * 63 / 1000 = 16.0 kW
    const biCapacity = calculateGridEntryCapacityKw(ConnectionType.BIPHASIC, VoltageLevel.V_127_220, 63);
    expect(biCapacity).toBeCloseTo(16.0, 0.5);

    // Monofásico 127V com disjuntor de 50A: 127 * 50 / 1000 = 6.35 kW
    const monoCapacity = calculateGridEntryCapacityKw(ConnectionType.MONOPHASIC, VoltageLevel.V_127_220, 50);
    expect(monoCapacity).toBeCloseTo(6.35, 0.1);
  });

  it('aprova projeto perfeitamente dimensionado com status pass e score 100%', () => {
    const project = createValidProject();
    const result = validateProjectPreFlight(project);

    expect(result.canProtocol).toBe(true);
    expect(result.overallStatus).toBe('pass');
    expect(result.criticalChecks).toBe(0);
    expect(result.score).toBe(100);
    expect(result.summary).toContain('100% aprovado');
  });

  it('detecta não-conformidade crítica quando a potência CA excede o disjuntor de entrada', () => {
    const project = createValidProject();
    // Muda para Monofásico com disjuntor de 40A (capacidade ~5.08 kW) e tenta injetar 10 kW
    project.technical.connectionType = ConnectionType.MONOPHASIC;
    project.technical.mainBreaker = 40;

    const result = validateProjectPreFlight(project);
    expect(result.canProtocol).toBe(false);
    expect(result.overallStatus).toBe('critical');
    expect(result.criticalChecks).toBeGreaterThan(0);

    const powerCheck = result.items.find(i => i.id === 'check_power_ac_vs_breaker');
    expect(powerCheck?.status).toBe('critical');
    expect(powerCheck?.details).toContain('excede a capacidade');
  });

  it('emite warning quando a potência CA opera acima de 90% da capacidade do disjuntor', () => {
    const project = createValidProject();
    // Bifásico 127/220V 63A (cap ~16 kW), ajusta inversor para 15 kW
    project.technical.connectionType = ConnectionType.BIPHASIC;
    project.technical.mainBreaker = 63;
    project.equipmentBlocks[0].inverterPowerKw = 15.0;
    project.equipmentBlocks[0].inverter.power = 15.0;
    project.equipmentBlocks[0].inverter.outputPhases = 1;

    const result = validateProjectPreFlight(project);
    const powerCheck = result.items.find(i => i.id === 'check_power_ac_vs_breaker');
    expect(powerCheck?.status).toBe('warning');
    expect(powerCheck?.details).toContain('mais de 90% da capacidade');
  });

  it('detecta incompatibilidade quando inversor trifásico é conectado a rede monofásica', () => {
    const project = createValidProject();
    project.technical.connectionType = ConnectionType.MONOPHASIC;
    project.equipmentBlocks[0].inverter.outputPhases = 3;

    const result = validateProjectPreFlight(project);
    const phaseCheck = result.items.find(i => i.id === 'check_grid_phase_compliance');
    expect(phaseCheck?.status).toBe('critical');
    expect(phaseCheck?.details).toContain('Incompatibilidade de fases');
  });

  it('detecta injeção monofásica acima do limite permitido de 8 kW', () => {
    const project = createValidProject();
    project.technical.connectionType = ConnectionType.MONOPHASIC;
    project.equipmentBlocks[0].inverter.outputPhases = 1;
    project.equipmentBlocks[0].inverter.power = 9.0;
    project.equipmentBlocks[0].inverterPowerKw = 9.0;
    project.technical.mainBreaker = 100; // capacidade alta, mas limite monofásico estourado

    const result = validateProjectPreFlight(project);
    const phaseCheck = result.items.find(i => i.id === 'check_grid_phase_compliance');
    expect(phaseCheck?.status).toBe('critical');
    expect(phaseCheck?.details).toContain('excede o limite regulatório máximo para ligação monofásica');
  });

  it('detecta ausência de dados obrigatórios do cliente', () => {
    const project = createValidProject();
    project.client.name = '';
    project.client.document = '';
    project.client.utilityId = '';

    const result = validateProjectPreFlight(project);
    const clientCheck = result.items.find(i => i.id === 'check_doc_client_data');
    expect(clientCheck?.status).toBe('critical');
    expect(clientCheck?.details).toContain('Campos obrigatórios ausentes');
  });

  it('emite warning quando o número da ART/TRT não está preenchido', () => {
    const project = createValidProject();
    project.client.art = '';

    const result = validateProjectPreFlight(project);
    const artCheck = result.items.find(i => i.id === 'check_doc_art');
    expect(artCheck?.status).toBe('warning');
    expect(artCheck?.details).toContain('Número da ART/TRT não informado');
  });

  it('detecta não-conformidade crítica quando rateio de créditos não soma 100%', () => {
    const project = createValidProject();
    project.creditBeneficiaries = [
      { id: '1', utilityId: '123456', document: '111.111.111-11', description: 'UC 1', percentage: 40 },
      { id: '2', utilityId: '654321', document: '222.222.222-22', description: 'UC 2', percentage: 30 },
    ]; // Total = 70% (incompleto)

    const result = validateProjectPreFlight(project);
    const rateioCheck = result.items.find(i => i.id === 'check_rateio_distribution');
    expect(rateioCheck?.status).toBe('critical');
    expect(rateioCheck?.details).toContain('deve ser exatamente 100,00%');
  });

  it('inclui e aprova o checklist da placa de advertência fotovoltaica permanente', () => {
    const project = createValidProject();
    const result = validateProjectPreFlight(project);
    const safetyCheck = result.items.find(i => i.id === 'check_safety_warning_sign');

    expect(safetyCheck).toBeDefined();
    expect(safetyCheck?.status).toBe('pass');
    expect(safetyCheck?.details).toContain('ATENÇÃO: RISCO DE CHOQUE ELÉTRICO - GERAÇÃO PRÓPRIA');
  });

  describe('Auditoria Rigorosa do Endereço da Instalação / Local da Obra (Normas Concessionárias)', () => {
    it('aprova endereço completo 100% preenchido com status pass e formatação correta', () => {
      const project = createValidProject();
      project.client.address = {
        street: 'Rua das Laranjeiras',
        number: '200',
        complement: 'Bloco B - Apto 302',
        neighborhood: 'Laranjeiras',
        city: 'Rio de Janeiro',
        state: 'RJ',
        zipCode: '22240-002',
      };

      const result = validateProjectPreFlight(project);
      const addressCheck = result.items.find(i => i.id === 'check_doc_address');

      expect(addressCheck).toBeDefined();
      expect(addressCheck?.status).toBe('pass');
      expect(addressCheck?.title).toBe('Endereço da Instalação / Local da Obra');
      expect(addressCheck?.details).toBe('Rua das Laranjeiras, 200 (Bloco B - Apto 302) - Laranjeiras, Rio de Janeiro/RJ - CEP: 22240-002');
      expect(addressCheck?.normativeRef).toContain('Normas de Atendimento das Distribuidoras');
    });

    it('detecta endereço incompleto quando falta o CEP', () => {
      const project = createValidProject();
      project.client.address.zipCode = '';

      const result = validateProjectPreFlight(project);
      const addressCheck = result.items.find(i => i.id === 'check_doc_address');

      expect(addressCheck?.status).toBe('warning');
      expect(addressCheck?.details).toBe('Endereço incompleto. Concessionárias exigem Logradouro, Número, Bairro, Cidade e CEP para abrir a ordem de serviço de vistoria.');
      expect(addressCheck?.recommendation).toBe('Complete o endereço da obra com CEP e Cidade antes do protocolo.');
    });

    it('detecta endereço incompleto quando falta o Logradouro', () => {
      const project = createValidProject();
      project.client.address.street = '   ';

      const result = validateProjectPreFlight(project);
      const addressCheck = result.items.find(i => i.id === 'check_doc_address');

      expect(addressCheck?.status).toBe('warning');
      expect(addressCheck?.details).toContain('Endereço incompleto');
    });

    it('detecta endereço incompleto quando falta o Número', () => {
      const project = createValidProject();
      project.client.address.number = '';

      const result = validateProjectPreFlight(project);
      const addressCheck = result.items.find(i => i.id === 'check_doc_address');

      expect(addressCheck?.status).toBe('warning');
      expect(addressCheck?.details).toContain('Endereço incompleto');
    });

    it('detecta endereço incompleto quando falta o Bairro', () => {
      const project = createValidProject();
      project.client.address.neighborhood = '';

      const result = validateProjectPreFlight(project);
      const addressCheck = result.items.find(i => i.id === 'check_doc_address');

      expect(addressCheck?.status).toBe('warning');
      expect(addressCheck?.details).toContain('Endereço incompleto');
    });

    it('detecta endereço incompleto quando falta a Cidade', () => {
      const project = createValidProject();
      project.client.address.city = ' ';

      const result = validateProjectPreFlight(project);
      const addressCheck = result.items.find(i => i.id === 'check_doc_address');

      expect(addressCheck?.status).toBe('warning');
      expect(addressCheck?.details).toContain('Endereço incompleto');
    });
  });
});
