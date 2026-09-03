import { describe, it, expect } from 'vitest';
import {
  getDiagramDimensions,
  buildTechnicalTableData,
  getNetworkDescription,
  getPhasesConductorLabel,
} from '../components/diagram/diagramLayoutV2';
import {
  ProjectState,
  UtilityCompany,
  ConnectionType,
  VoltageLevel,
} from '../types';

describe('SolarCAD Beta — Diagrama Unifilar V2 (Layout Paramétrico, Modos & BOM)', () => {
  const mockProject: ProjectState = {
    client: {
      name: 'Engenharia Solar Teste',
      document: '12.345.678/0001-90',
      email: 'contato@teste.com',
      phone: '(21) 98888-7777',
      utilityId: 'UC-998877',
      art: '2026/09988',
      address: {
        street: 'Rua Principal',
        number: '100',
        neighborhood: 'Centro',
        city: 'Niterói',
        state: 'RJ',
        zipCode: '24000-000',
      },
    },
    engineer: {
      name: 'Luca Rodrigues',
      crea: '2019102450/RJ',
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
          voc: 45.2,
          isc: 18.2,
          vmp: 38.1,
          imp: 17.1,
        },
        inverter: {
          id: 1,
          brand: 'Deye',
          model: 'SUN-10K-G04',
          power: 10,
          maxDcVoltage: 1000,
          maxInputCurrent: 26,
          mpptCount: 2,
          stringsPerMppt: 2,
          efficiency: 98.6,
          outputPhases: 3,
          nominalVoltage: '220/380V',
          inverterType: 'string',
        },
        inverterBrand: 'Deye',
        inverterModel: 'SUN-10K-G04',
        inverterPowerKw: 10,
        moduleBrand: 'Canadian Solar',
        moduleModel: 'CS7N-650MS',
        modulePowerW: 650,
        moduleQty: 20,
        inverterQty: 1,
        strings: [{ id: 1, count: 10 }, { id: 2, count: 10 }],
      },
    ],
    paperSize: 'A3',
  };

  it('deve calcular corretamente as dimensões de Prancha A4 Paisagem (297x210 mm)', () => {
    const a4 = getDiagramDimensions('A4');
    expect(a4.pageW).toBe(297);
    expect(a4.pageH).toBe(210);
    expect(a4.safeW).toBe(269);
    expect(a4.drawW).toBe(269);
  });

  it('deve calcular corretamente as dimensões de Prancha A3 Paisagem (420x297 mm)', () => {
    const a3 = getDiagramDimensions('A3');
    expect(a3.pageW).toBe(420);
    expect(a3.pageH).toBe(297);
    expect(a3.safeW).toBe(385);
    expect(a3.drawW).toBe(385);
    expect(a3.marginL).toBe(25); // Margem ABNT de encadernação
  });

  it('deve formatar corretamente as descrições de rede e condutores para Monofásico, Bifásico e Trifásico', () => {
    expect(getNetworkDescription(ConnectionType.TRIPHASIC, '220/380V')).toBe('Rede 220/380V Trifásica + Neutro');
    expect(getNetworkDescription(ConnectionType.BIPHASIC, '127/220V')).toBe('Rede 127/220V Bifásica + Neutro');
    expect(getNetworkDescription(ConnectionType.MONOPHASIC, '220V')).toBe('Rede 220V Monofásica + Neutro');

    expect(getPhasesConductorLabel(ConnectionType.TRIPHASIC)).toBe('3F+N+PE');
    expect(getPhasesConductorLabel(ConnectionType.BIPHASIC)).toBe('2F+N+PE');
    expect(getPhasesConductorLabel(ConnectionType.MONOPHASIC)).toBe('F+N+PE');
  });

  it('deve gerar a tabela técnica de cargas estruturada (BOM) com módulos ricos, inversores, cabos CC/CA e proteções', () => {
    const table = buildTechnicalTableData(mockProject);
    expect(table.modulesInfo.length).toBeGreaterThan(0);
    expect(table.invertersInfo.length).toBeGreaterThan(0);
    expect(table.cablesInfo.length).toBeGreaterThan(0);
    expect(table.protectionsInfo.length).toBeGreaterThan(0);
    expect(table.ansiInfo.length).toBeGreaterThan(0);

    // 1. Módulos ricos
    const modLine = table.modulesInfo[0];
    expect(modLine).toContain('CANADIAN SOLAR');
    expect(modLine).toContain('CS7N-650MS');
    expect(modLine).toContain('650W');
    expect(modLine).toContain('Pmp:');
    expect(modLine).toContain('Voc:');
    expect(modLine).toContain('Isc:');

    // 2. Inversores ricos
    const invLine = table.invertersInfo[0];
    expect(invLine).toContain('DEYE');
    expect(invLine).toContain('SUN-10K-G04');
    expect(invLine).toContain('10.0 kW');
    expect(invLine).toContain('Inom:');
    expect(invLine).toContain('Vca:');

    // 3. Cabos CC e CA
    expect(table.cablesInfo.some(c => c.includes('Cabo Solar CC') && c.includes('1,8kV') && c.includes('Preto/Vermelho'))).toBe(true);
    expect(table.cablesInfo.some(c => c.includes('Cabo de Potência CA') && c.includes('3F+N+PE') && c.includes('750V/1kV'))).toBe(true);

    // 4. Proteções (String Box, QDS, Padrão, Aterramento)
    expect(table.protectionsInfo.some(p => p.includes('SB-1') && p.includes('Fusíveis') && p.includes('DPS CC') && p.includes('Chave Secc.'))).toBe(true);
    expect(table.protectionsInfo.some(p => p.includes('QDS') && p.includes('Disjuntor CA') && p.includes('Curva C') && p.includes('DPS CA Classe II'))).toBe(true);
    expect(table.protectionsInfo.some(p => p.includes('PADRÃO') && p.includes('Disjuntor Geral Padrão') && p.includes('Medidor Bidirecional Eletrônico'))).toBe(true);
    expect(table.protectionsInfo.some(p => p.includes('ATERRAMENTO') && p.includes('Haste 5/8" x 2.40m') && p.includes('Cabo Cobre Nu 25mm²'))).toBe(true);

    // 5. Proteções integradas / ANSI
    expect(table.ansiInfo.some(a => a.includes('Anti-ilhamento (NBR IEC 62116)'))).toBe(true);
    expect(table.ansiInfo.some(a => a.includes('ANSI 59') && a.includes('ANSI 27'))).toBe(true);
    expect(table.ansiInfo.some(a => a.includes('ANSI 81O/U') && a.includes('ANSI 25'))).toBe(true);
  });

  it('permite alternar livremente entre A4 e A3 com recalculo imediato de dimensões e cotas', () => {
    // Alternando para A4
    const a4 = getDiagramDimensions('A4');
    expect(a4.format).toBe('A4');
    expect(a4.pageW).toBe(297);
    expect(a4.pageH).toBe(210);
    const dpiA4 = a4.format === 'A3' ? 5 : 6;
    expect(dpiA4).toBe(6);
    expect(Math.round(a4.pageW * dpiA4)).toBe(1782);
    expect(Math.round(a4.pageH * dpiA4)).toBe(1260);

    // Alternando para A3
    const a3 = getDiagramDimensions('A3');
    expect(a3.format).toBe('A3');
    expect(a3.pageW).toBe(420);
    expect(a3.pageH).toBe(297);
    const dpiA3 = a3.format === 'A3' ? 5 : 6;
    expect(dpiA3).toBe(5);
    expect(Math.round(a3.pageW * dpiA3)).toBe(2100);
    expect(Math.round(a3.pageH * dpiA3)).toBe(1485);
  });

  it('calcula tabela técnica e especificações para múltiplos inversores (2, 3 e 4+)', () => {
    const multiInvProject: ProjectState = {
      ...mockProject,
      equipmentBlocks: [
        {
          ...mockProject.equipmentBlocks[0],
          id: 1,
          inverterQty: 2,
        },
        {
          ...mockProject.equipmentBlocks[0],
          id: 2,
          inverterQty: 1,
        },
      ],
    };

    const table = buildTechnicalTableData(multiInvProject);
    expect(table.modulesInfo.length).toBe(2);
    expect(table.invertersInfo.length).toBe(2);
    expect(table.invertersInfo[0]).toContain('2x');
  });
});

