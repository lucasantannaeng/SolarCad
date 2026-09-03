/**
 * Suíte de Testes Unitários: Diagramação Multifilar / Trifilar NBR 5410,
 * Diagrama de Comunicação & TC / Modbus RTU, e AutoCAD Blocks DXF
 *
 * Créditos Técnicos:
 * - QElectroTech (simbologia NBR/IEC)
 * - Maker.js / dxf-writer (AutoCAD Blocks)
 * - Modbus-IDA / OpenSolar (Topologia de Telemetria e String Mapping)
 */

import { describe, it, expect, vi } from 'vitest';
import {
  NBR_COLORS,
  getActiveMultifilarConductors,
  drawMultifilarBusbar,
  drawMultifilarBreaker,
  drawMultifilarInverter,
  drawCurrentTransformer,
  drawSmartMeterAndDatalogger,
  drawMultifilarWarningPlate,
  renderMultifilarDiagram,
} from '@/components/diagram/multifilarRenderer';
import {
  COMM_COLORS,
  drawCommunicationInverter,
  drawWifiRouter,
  drawCloudPlatform,
  drawMonitoringAppDashboard,
  drawCommunicationSmartMeter,
  drawTelemetryCurrentTransformer,
  drawCommunicationScheduleTable,
  renderCommunicationDiagram,
} from '@/components/diagram/communicationRenderer';
import {
  getDxfStandardBlocks,
  buildDxfBlocksSection,
  generateSolarUnifilarDxf,
  sanitizeDxfText,
} from '@/services/dxfExporter';
import { getDiagramDimensions } from '@/components/diagram/diagramLayoutV2';
import { ProjectState, UtilityCompany, ConnectionType, VoltageLevel } from '@/types';

const MOCK_PROJECT_DATA: ProjectState = {
  client: {
    name: 'Condomínio Solar Alpha',
    document: '12.345.678/0001-90',
    email: 'contato@solaralpha.com.br',
    phone: '(21) 99999-8888',
    utilityId: 'UC-987654321',
    art: 'ART-2026-998877',
    address: {
      street: 'Av. das Américas',
      number: '1000',
      neighborhood: 'Barra da Tijuca',
      city: 'Rio de Janeiro',
      state: 'RJ',
      zipCode: '22640-100',
    },
  },
  engineer: {
    name: 'Dr. Lucas Santanna',
    crea: 'CREA-RJ 202610123/D',
  },
  technical: {
    utility: UtilityCompany.LIGHT,
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
      inverterBrand: 'Growatt',
      inverterModel: 'MID 20KTL3-X',
      inverterPowerKw: 20,
      moduleBrand: 'Canadian Solar',
      moduleModel: 'CS7N-660MS',
      modulePowerW: 660,
      moduleQty: 36,
      inverterQty: 1,
      module: {
        id: 1,
        brand: 'Canadian Solar',
        model: 'CS7N-660MS',
        power: 660,
        voc: 45.6,
        isc: 18.5,
        vmp: 38.2,
        imp: 17.3,
      },
      inverter: {
        id: 1,
        brand: 'Growatt',
        model: 'MID 20KTL3-X',
        power: 20,
        maxDcVoltage: 1100,
        maxInputCurrent: 32,
        mpptMin: 200,
        mpptMax: 1000,
        mpptCount: 2,
        nominalOutputVoltage: 380,
        outputPhases: 3,
        inverterType: 'string',
      },
      strings: [
        { id: 1, count: 18 },
        { id: 2, count: 18 },
      ],
    },
  ],
  paperSize: 'A3',
};

// Mock do Contexto 2D do Canvas para testes de renderização vetorial
const createMockContext2D = (): CanvasRenderingContext2D => {
  const calls: string[] = [];
  return {
    save: vi.fn(() => calls.push('save')),
    restore: vi.fn(() => calls.push('restore')),
    beginPath: vi.fn(() => calls.push('beginPath')),
    closePath: vi.fn(() => calls.push('closePath')),
    moveTo: vi.fn((x, y) => calls.push(`moveTo(${x},${y})`)),
    lineTo: vi.fn((x, y) => calls.push(`lineTo(${x},${y})`)),
    quadraticCurveTo: vi.fn((cpx, cpy, x, y) => calls.push(`quadraticCurveTo(${cpx},${cpy},${x},${y})`)),
    stroke: vi.fn(() => calls.push('stroke')),
    fill: vi.fn(() => calls.push('fill')),
    fillRect: vi.fn((x, y, w, h) => calls.push(`fillRect(${x},${y},${w},${h})`)),
    strokeRect: vi.fn((x, y, w, h) => calls.push(`strokeRect(${x},${y},${w},${h})`)),
    fillText: vi.fn((text, x, y) => calls.push(`fillText(${text},${x},${y})`)),
    arc: vi.fn((x, y, r) => calls.push(`arc(${x},${y},${r})`)),
    ellipse: vi.fn((x, y, rx, ry) => calls.push(`ellipse(${x},${y},${rx},${ry})`)),
    setLineDash: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    clip: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
};

describe('1. Módulo Multifilar / Trifilar NBR 5410 (multifilarRenderer.ts)', () => {
  it('define com exatidão as cores normatizadas da NBR 5410', () => {
    expect(NBR_COLORS.PHASE_R).toBe('#000000'); // Fase R (Preto)
    expect(NBR_COLORS.PHASE_S).toBe('#334155'); // Fase S (Cinza escuro / Slate)
    expect(NBR_COLORS.PHASE_T).toBe('#DC2626'); // Fase T (Vermelho)
    expect(NBR_COLORS.NEUTRAL).toBe('#0284C7'); // Neutro (Azul Claro)
    expect(NBR_COLORS.GROUND_PE).toBe('#16A34A'); // Terra (Verde)
    expect(NBR_COLORS.DC_POS).toBe('#DC2626'); // CC +
    expect(NBR_COLORS.DC_NEG).toBe('#000000'); // CC -
    expect(NBR_COLORS.COMM_BUS).toBe('#9333EA'); // RS-485 Modbus
  });

  it('calcula condutores ativos para conexões Monofásica, Bifásica e Trifásica', () => {
    // Monofásico: R + N + PE (3 condutores)
    const mono = getActiveMultifilarConductors(ConnectionType.MONOPHASIC, 10, 3.2);
    expect(mono.length).toBe(3);
    expect(mono.map(c => c.id)).toEqual(['R', 'N', 'PE']);

    // Bifásico: R + S + N + PE (4 condutores)
    const bi = getActiveMultifilarConductors(ConnectionType.BIPHASIC, 10, 3.2);
    expect(bi.length).toBe(4);
    expect(bi.map(c => c.id)).toEqual(['R', 'S', 'N', 'PE']);

    // Trifásico: R + S + T + N + PE (5 condutores)
    const tri = getActiveMultifilarConductors(ConnectionType.TRIPHASIC, 10, 3.2);
    expect(tri.length).toBe(5);
    expect(tri.map(c => c.id)).toEqual(['R', 'S', 'T', 'N', 'PE']);
  });

  it('desenha barramento multifilar com condutores e rótulos separados', () => {
    const ctx = createMockContext2D();
    const conductors = getActiveMultifilarConductors(ConnectionType.TRIPHASIC, 20, 3.2);
    drawMultifilarBusbar(ctx, 10, 100, conductors, 0.55);

    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalledTimes(5);
    expect(ctx.fillText).toHaveBeenCalledWith('R', 8.5, 20.6);
    expect(ctx.fillText).toHaveBeenCalledWith('T', 8.5, 27.0);
  });

  it('desenha disjuntor com acoplamento mecânico tracejado e polos individuais', () => {
    const ctx = createMockContext2D();
    const conductors = getActiveMultifilarConductors(ConnectionType.TRIPHASIC, 20, 3.2);
    drawMultifilarBreaker(ctx, 50, conductors, 'DJ-GERAL 100A');

    expect(ctx.setLineDash).toHaveBeenCalledWith([0.8, 0.8]);
    expect(ctx.fillText).toHaveBeenCalledWith('DJ-GERAL 100A', 50, 18.5 - 2.2);
  });

  it('desenha inversor multifilar com bornes CC (+ / -) e bornes CA (R, S, T, N, PE)', () => {
    const ctx = createMockContext2D();
    const conductors = getActiveMultifilarConductors(ConnectionType.TRIPHASIC, 20, 3.2);
    drawMultifilarInverter(ctx, 20, 40, 30, 20, conductors, 'INV-1', 20, 2);

    expect(ctx.strokeRect).toHaveBeenCalledWith(20, 40, 30, 20);
    expect(ctx.fillText).toHaveBeenCalledWith('CC', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('CA', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('INV-1', 35, 35.5);
    expect(ctx.fillText).toHaveBeenCalledWith('20 kW', 35, 38);
  });

  it('desenha placa de advertência de segurança NBR 16690 com símbolo e textos normatizados', () => {
    const ctx = createMockContext2D();
    drawMultifilarWarningPlate(ctx, 10, 20, 60, 10);

    expect(ctx.fillRect).toHaveBeenCalledWith(10, 20, 60, 10);
    expect(ctx.fillText).toHaveBeenCalledWith('!', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith(
      'CUIDADO: RISCO DE CHOQUE ELÉTRICO',
      expect.any(Number),
      expect.any(Number)
    );
    expect(ctx.fillText).toHaveBeenCalledWith(
      'GERAÇÃO PRÓPRIA (FONTE SOLAR FV) - NBR 16690',
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('executa a renderização do diagrama multifilar estritamente como circuito de potência (sem cabos de dados)', () => {
    const ctx = createMockContext2D();
    const dims = getDiagramDimensions('A3');

    expect(() => {
      renderMultifilarDiagram(ctx, {
        dims,
        projectData: MOCK_PROJECT_DATA,
        format: 'A3',
        DPI: 5,
        showCommunication: false,
      });
    }).not.toThrow();

    expect(ctx.fillText).toHaveBeenCalledWith(
      'BARRAMENTO DISTRIBUIÇÃO MULTIFILAR (NBR 5410)',
      expect.any(Number),
      expect.any(Number)
    );
    expect(ctx.fillText).toHaveBeenCalledWith(
      'CUIDADO: RISCO DE CHOQUE ELÉTRICO',
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('renderiza corretamente usina multifilar com múltiplos inversores (2, 3 e 4+ inversores com barramento coletor)', () => {
    const ctx = createMockContext2D();
    const dims = getDiagramDimensions('A3');

    const multiInvProject: ProjectState = {
      ...MOCK_PROJECT_DATA,
      equipmentBlocks: [
        {
          ...MOCK_PROJECT_DATA.equipmentBlocks[0],
          id: 1,
          inverterQty: 3,
        },
      ],
    };

    expect(() => {
      renderMultifilarDiagram(ctx, {
        dims,
        projectData: multiInvProject,
        format: 'A3',
        DPI: 5,
        showCommunication: false,
      });
    }).not.toThrow();

    expect(ctx.fillText).toHaveBeenCalledWith(
      'BARRAMENTO DISTRIBUIÇÃO MULTIFILAR (NBR 5410)',
      expect.any(Number),
      expect.any(Number)
    );
  });
});

describe('2. Modo 3: Módulo de Comunicação & TC / Modbus RTU (communicationRenderer.ts)', () => {
  it('define paleta de cores de telemetria e rede', () => {
    expect(COMM_COLORS.RS485_A).toBe('#9333EA');
    expect(COMM_COLORS.CT_SIGNAL).toBe('#D97706');
    expect(COMM_COLORS.WIFI_WAVE).toBe('#0284C7');
    expect(COMM_COLORS.CLOUD_ACCENT).toBe('#2563EB');
    expect(COMM_COLORS.APP_ACCENT).toBe('#10B981');
  });

  it('desenha inversor com porta COM RS-485 (bornes A+, B-, GND) e datalogger Wi-Fi com LEDs de status', () => {
    const ctx = createMockContext2D();
    drawCommunicationInverter(ctx, 10, 20, 35, 25, 'INV-01', 'GROWATT', 'MID 20KTL3-X', 20, 1, true);

    expect(ctx.fillText).toHaveBeenCalledWith('INV-01', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('PORTA COM (MODBUS ID: 01)', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('A (+)', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('B (-)', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('PE/SHD', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('DTU / Wi-Fi', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('PWR NET INV', expect.any(Number), expect.any(Number));
  });

  it('desenha roteador Wi-Fi local com antenas e parâmetros de rede', () => {
    const ctx = createMockContext2D();
    drawWifiRouter(ctx, 10, 50, 30, 18);

    expect(ctx.fillText).toHaveBeenCalledWith('ROTEADOR WI-FI LOCAL', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('• WLAN 2.4 GHz / 5 GHz', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('• IP: 192.168.1.1 (Gateway)', expect.any(Number), expect.any(Number));
  });

  it('desenha nuvem SolarCAD Cloud Platform e dashboard mobile', () => {
    const ctx = createMockContext2D();
    drawCloudPlatform(ctx, 50, 50, 40, 25);
    expect(ctx.fillText).toHaveBeenCalledWith('SOLARCAD CLOUD', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('MQTT / HTTPS TLS 1.3', expect.any(Number), expect.any(Number));

    drawMonitoringAppDashboard(ctx, 100, 50, 30, 35);
    expect(ctx.fillText).toHaveBeenCalledWith('SolarCAD Mobile App', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('SISTEMA ONLINE', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('GERAÇÃO FV AGORA', expect.any(Number), expect.any(Number));
  });

  it('desenha Smart Meter bidirecional com display LCD digital e porta RS-485', () => {
    const ctx = createMockContext2D();
    drawCommunicationSmartMeter(ctx, 10, 100, 40, 25, 2);

    expect(ctx.fillText).toHaveBeenCalledWith('SMART METER BIDIRECIONAL (ID: 02)', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('P:+08.45kW  Q:0.0kvar', expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith('• Controle de Injeção Zero (Zero Export)', expect.any(Number), expect.any(Number));
  });

  it('desenha Transformadores de Corrente (TCs) bipartidos e tabela de telemetria', () => {
    const ctx = createMockContext2D();
    drawTelemetryCurrentTransformer(ctx, 80, 120, 'TC-R', '100/5A');

    expect(ctx.ellipse).toHaveBeenCalledWith(80, 120, 2.2, 4.0, 0, 0, 2 * Math.PI);
    expect(ctx.fillText).toHaveBeenCalledWith('TC-R', 80, 120 - 5.5);

    drawCommunicationScheduleTable(ctx, 10, 150, 200, 35, 1);
    expect(ctx.fillText).toHaveBeenCalledWith('ESPECIFICAÇÕES DE TELEMETRIA, COMUNICAÇÃO & MODBUS RTU', 13, 153);
  });

  it('executa a renderização completa do diagrama de comunicação e telemetria (Modo 3)', () => {
    const ctx = createMockContext2D();
    const dims = getDiagramDimensions('A3');

    expect(() => {
      renderCommunicationDiagram(ctx, {
        dims,
        projectData: MOCK_PROJECT_DATA,
        format: 'A3',
        DPI: 5,
      });
    }).not.toThrow();

    expect(ctx.fillText).toHaveBeenCalledWith(
      'BARRAMENTO RS-485 MODBUS RTU (Par Trançado Blindado 2x24 AWG + 120Ω)',
      expect.any(Number),
      expect.any(Number)
    );
    expect(ctx.fillText).toHaveBeenCalledWith(
      'PADRÃO DE ENTRADA & MEDIÇÃO DE TELEMETRIA',
      expect.any(Number),
      expect.any(Number)
    );
  });
});

describe('3. Exportação DXF com AutoCAD Blocks (dxfExporter.ts)', () => {
  it('sanitiza textos removendo acentos e caracteres especiais para compatibilidade DXF', () => {
    const raw = 'Condomínio São João & Inversão CC/CA';
    const clean = sanitizeDxfText(raw);
    expect(clean).toBe('Condominio Sao Joao & Inversao CC/CA');
  });

  it('retorna a lista de 6 blocos padrão oficiais do AutoCAD', () => {
    const blocks = getDxfStandardBlocks();
    const blockNames = blocks.map(b => b.name);

    expect(blockNames).toContain('BLOCK_INVERSOR');
    expect(blockNames).toContain('BLOCK_DISJUNTOR');
    expect(blockNames).toContain('BLOCK_MEDIDOR');
    expect(blockNames).toContain('BLOCK_STRINGBOX');
    expect(blockNames).toContain('BLOCK_DPS');
    expect(blockNames).toContain('BLOCK_MODULO');
  });

  it('constrói a seção BLOCKS do DXF com blocos válidos e fechamento ENDBLK', () => {
    const section = buildDxfBlocksSection();
    expect(section).toContain('0\nSECTION\n2\nBLOCKS');
    expect(section).toContain('2\nBLOCK_INVERSOR');
    expect(section).toContain('2\nBLOCK_DISJUNTOR');
    expect(section).toContain('2\nBLOCK_MEDIDOR');
    expect(section).toContain('2\nBLOCK_STRINGBOX');
    expect(section).toContain('2\nBLOCK_DPS');
    expect(section).toContain('2\nBLOCK_MODULO');
    expect(section).toContain('0\nENDBLK');
    expect(section).toContain('0\nENDSEC');
  });

  it('gera arquivo DXF completo com referências INSERT aos blocos e layers dedicados', () => {
    const dxf = generateSolarUnifilarDxf(MOCK_PROJECT_DATA, {
      mode: 'multifilar',
      showCommunication: true,
    });

    // Cabeçalho e Codepage ANSI_1252
    expect(dxf).toContain('9\n$ACADVER\n1\nAC1009');
    expect(dxf).toContain('9\n$DWGCODEPAGE\n3\nANSI_1252');

    // Seção TABLES e Layers
    expect(dxf).toContain('0\nSECTION\n2\nTABLES');
    expect(dxf).toContain('2\nBLOCKS');
    expect(dxf).toContain('2\nEQUIPMENT');
    expect(dxf).toContain('2\nPOWER');
    expect(dxf).toContain('2\nCOMMUNICATION');

    // Seção BLOCKS
    expect(dxf).toContain('2\nBLOCK_INVERSOR');
    expect(dxf).toContain('2\nBLOCK_DISJUNTOR');

    // Seção ENTITIES com comandos INSERT
    expect(dxf).toContain('0\nINSERT\n8\nEQUIPMENT\n2\nBLOCK_MEDIDOR');
    expect(dxf).toContain('0\nINSERT\n8\nPOWER\n2\nBLOCK_DISJUNTOR');
    expect(dxf).toContain('0\nINSERT\n8\nEQUIPMENT\n2\nBLOCK_INVERSOR');
    expect(dxf).toContain('0\nINSERT\n8\nEQUIPMENT\n2\nBLOCK_STRINGBOX');
    expect(dxf).toContain('0\nINSERT\n8\nEQUIPMENT\n2\nBLOCK_DPS');
    expect(dxf).toContain('0\nINSERT\n8\nMODULES\n2\nBLOCK_MODULO');

    // Informações Técnicas Ricas e Placa de Advertência no DXF
    expect(dxf).toContain('PROT. INTEGRADAS: ANTI-ILHAMENTO');
    expect(dxf).toContain('ADVERTENCIA: CUIDADO RISCO DE CHOQUE ELETRICO');
    expect(dxf).toContain('CABO SOLAR CC');
    expect(dxf).toContain('CABO POTENCIA CA');

    // Linha de Comunicação RS-485
    expect(dxf).toContain('8\nCOMMUNICATION');
    expect(dxf).toContain('BARRAMENTO RS-485 / MODBUS RTU');

    // Fim de Arquivo DXF
    expect(dxf).toContain('0\nENDSEC\n0\nEOF');
  });
});
