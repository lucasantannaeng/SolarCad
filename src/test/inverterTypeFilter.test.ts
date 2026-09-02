import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  filterInvertersByType,
  getUniqueInverterBrands,
  getAvailableInvertersByBrand,
  switchInverterTopology,
} from '../services/inverterFilter';
import { EquipmentBlockForm } from '../components/EquipmentBlockForm';
import { InverterData, ModuleData, EquipmentBlock } from '../types';
import { BlockEngineeringResult } from '../services/engineering';

// Mock equipment data for tests
const mockInverters: InverterData[] = [
  {
    id: 1,
    brand: 'Growatt',
    model: 'MIN 5000TL-X',
    power: 5.0,
    maxDcVoltage: 550,
    maxInputCurrent: 13.5,
    mpptMin: 80,
    mpptMax: 500,
    mpptCount: 2,
    nominalOutputVoltage: 220,
    outputPhases: 1,
    inverterType: 'string',
  },
  {
    id: 2,
    brand: 'Growatt',
    model: 'MID 15KTL3-X',
    power: 15.0,
    maxDcVoltage: 1100,
    maxInputCurrent: 26,
    mpptMin: 200,
    mpptMax: 1000,
    mpptCount: 2,
    nominalOutputVoltage: 380,
    outputPhases: 3,
    inverterType: 'string',
  },
  {
    id: 3,
    brand: 'Fronius',
    model: 'Primo 5.0-1',
    power: 5.0,
    maxDcVoltage: 1000,
    maxInputCurrent: 12,
    mpptMin: 200,
    mpptMax: 800,
    mpptCount: 2,
    nominalOutputVoltage: 220,
    outputPhases: 1,
    inverterType: 'string',
  },
  {
    id: 101,
    brand: 'Hoymiles',
    model: 'HMS-2000-4T',
    power: 2.0,
    maxDcVoltage: 65,
    maxInputCurrent: 16,
    mpptMin: 16,
    mpptMax: 60,
    mpptCount: 4,
    nominalOutputVoltage: 220,
    outputPhases: 1,
    inverterType: 'micro',
    maxMicrosInSeries: 3,
    maxInputPowerW: 600,
  },
  {
    id: 102,
    brand: 'Hoymiles',
    model: 'HMS-1000-2T',
    power: 1.0,
    maxDcVoltage: 65,
    maxInputCurrent: 16,
    mpptMin: 16,
    mpptMax: 60,
    mpptCount: 2,
    nominalOutputVoltage: 220,
    outputPhases: 1,
    inverterType: 'micro',
    maxMicrosInSeries: 6,
    maxInputPowerW: 540,
  },
  {
    id: 103,
    brand: 'APsystems',
    model: 'DS3-H',
    power: 2.0,
    maxDcVoltage: 60,
    maxInputCurrent: 20,
    mpptMin: 16,
    mpptMax: 60,
    mpptCount: 2,
    nominalOutputVoltage: 220,
    outputPhases: 1,
    inverterType: 'micro',
    maxMicrosInSeries: 3,
    maxInputPowerW: 600,
  },
  {
    id: 104,
    brand: 'Deye',
    model: 'SUN-M80G3-EU-Q0',
    power: 0.8,
    maxDcVoltage: 60,
    maxInputCurrent: 13,
    mpptMin: 20,
    mpptMax: 60,
    mpptCount: 2,
    nominalOutputVoltage: 220,
    outputPhases: 1,
    inverterType: 'micro',
    maxMicrosInSeries: 6,
    maxInputPowerW: 500,
  },
  {
    id: 201,
    brand: 'Solis',
    model: 'S5-GR1P5K',
    power: 5.0,
    maxDcVoltage: 600,
    maxInputCurrent: 14,
    mpptMin: 90,
    mpptMax: 520,
    mpptCount: 2,
    nominalOutputVoltage: 220,
    outputPhases: 1,
    // Test legacy data without explicit inverterType
    inverterType: undefined as any,
  },
];

const mockModules: ModuleData[] = [
  {
    id: 1,
    brand: 'Canadian Solar',
    model: 'CS7N-660MS',
    power: 660,
    voc: 45.6,
    isc: 18.5,
    vmp: 38.2,
    imp: 17.28,
  },
];

const mockInitialStringBlock: EquipmentBlock = {
  id: 1,
  moduleId: 1,
  inverterId: 1,
  module: mockModules[0],
  inverter: mockInverters[0],
  inverterBrand: 'Growatt',
  inverterModel: 'MIN 5000TL-X',
  inverterPowerKw: 5.0,
  moduleBrand: 'Canadian Solar',
  moduleModel: 'CS7N-660MS',
  modulePowerW: 660,
  moduleQty: 10,
  inverterQty: 1,
  strings: [{ id: 1, count: 10 }],
};

const mockEngineeringResult: BlockEngineeringResult = {
  blockId: 1,
  vocTotal: 456,
  vmpTotal: 382,
  iscTotal: 18.5,
  impTotal: 17.28,
  nominalCurrent: 22.7,
  suggestedBreaker: 32,
  breakerPolarity: 'Bipolar',
  minConductorSection: 6,
  dcAcRatio: 1.32,
  warnings: [],
  status: 'SUCCESS',
};

describe('SolarCAD - Filtragem de Inversores por Tipo (String vs Microinversor)', () => {
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. FILTRAGEM POR TIPO 'STRING'
  // ─────────────────────────────────────────────────────────────────────────────
  describe('1. Filtragem por Tipo "string"', () => {
    it('deve excluir todos os microinversores da lista quando inverterType for "string"', () => {
      const filtered = filterInvertersByType(mockInverters, 'string');

      // Não deve conter nenhum microinversor
      const hasMicro = filtered.some(i => i.inverterType === 'micro');
      expect(hasMicro).toBe(false);

      // Deve conter os inversores string e legados
      expect(filtered.map(i => i.id)).toEqual([1, 2, 3, 201]);
      expect(filtered.length).toBe(4);
    });

    it('deve gerar uniqueInverterBrands contendo apenas marcas de inversores string', () => {
      const filtered = filterInvertersByType(mockInverters, 'string');
      const brands = getUniqueInverterBrands(filtered);

      expect(brands).toContain('Growatt');
      expect(brands).toContain('Fronius');
      expect(brands).toContain('Solis');
      expect(brands).not.toContain('Hoymiles');
      expect(brands).not.toContain('APsystems');
    });

    it('deve retornar apenas modelos da marca solicitada dentro da lista filtrada string', () => {
      const filtered = filterInvertersByType(mockInverters, 'string');
      const growattModels = getAvailableInvertersByBrand(filtered, 'Growatt');

      expect(growattModels.length).toBe(2);
      expect(growattModels.every(m => m.brand === 'Growatt' && m.inverterType !== 'micro')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. FILTRAGEM POR TIPO 'MICRO'
  // ─────────────────────────────────────────────────────────────────────────────
  describe('2. Filtragem por Tipo "micro"', () => {
    it('deve exibir apenas microinversores quando inverterType for "micro"', () => {
      const filtered = filterInvertersByType(mockInverters, 'micro');

      // Todos os itens devem ter estritamente inverterType === 'micro'
      expect(filtered.length).toBe(4);
      expect(filtered.every(i => i.inverterType === 'micro')).toBe(true);
      expect(filtered.map(i => i.id)).toEqual([101, 102, 103, 104]);
    });

    it('deve gerar uniqueInverterBrands contendo apenas marcas de microinversores', () => {
      const filtered = filterInvertersByType(mockInverters, 'micro');
      const brands = getUniqueInverterBrands(filtered);

      expect(brands).toContain('Hoymiles');
      expect(brands).toContain('APsystems');
      expect(brands).toContain('Deye');
      expect(brands).not.toContain('Growatt');
      expect(brands).not.toContain('Fronius');
      expect(brands).not.toContain('Solis');
    });

    it('deve retornar apenas modelos da marca solicitada dentro da lista filtrada micro', () => {
      const filtered = filterInvertersByType(mockInverters, 'micro');
      const hoymilesModels = getAvailableInvertersByBrand(filtered, 'Hoymiles');

      expect(hoymilesModels.length).toBe(2);
      expect(hoymilesModels.map(m => m.model)).toEqual(['HMS-2000-4T', 'HMS-1000-2T']);
      expect(hoymilesModels.every(m => m.inverterType === 'micro')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. TROCA DE TOPOLOGIA E ATUALIZAÇÃO CONSISTENTE DO INVERSOR
  // ─────────────────────────────────────────────────────────────────────────────
  describe('3. Troca de Topologia e Seleção Consistente', () => {
    it('deve trocar de String para Micro e selecionar automaticamente o primeiro microinversor válido', () => {
      const initialBlock = { ...mockInitialStringBlock };
      expect(initialBlock.inverter.inverterType).toBe('string');

      const updatedBlock = switchInverterTopology(initialBlock, 'micro', mockInverters);

      // Deve ter selecionado o primeiro microinversor (Hoymiles HMS-2000-4T, id: 101)
      expect(updatedBlock.inverter.inverterType).toBe('micro');
      expect(updatedBlock.inverterId).toBe(101);
      expect(updatedBlock.inverterBrand).toBe('Hoymiles');
      expect(updatedBlock.inverterModel).toBe('HMS-2000-4T');
      expect(updatedBlock.inverterPowerKw).toBe(2.0);
      expect(updatedBlock.inverter.id).toBe(101);

      // Deve ajustar as strings para a topologia de microinversor
      expect(updatedBlock.strings).toEqual([{ id: 1, count: 4 }]);
      expect(updatedBlock.moduleQty).toBe(4);
    });

    it('deve trocar de Micro para String e selecionar automaticamente o primeiro inversor string válido', () => {
      const microBlock: EquipmentBlock = {
        ...mockInitialStringBlock,
        inverter: mockInverters[3], // Hoymiles HMS-2000-4T (id: 101)
        inverterId: 101,
        inverterBrand: 'Hoymiles',
        inverterModel: 'HMS-2000-4T',
        inverterPowerKw: 2.0,
        strings: [{ id: 1, count: 4 }],
        moduleQty: 4,
      };

      const updatedBlock = switchInverterTopology(microBlock, 'string', mockInverters);

      // Deve ter selecionado o primeiro inversor string (Growatt MIN 5000TL-X, id: 1)
      expect(updatedBlock.inverter.inverterType).toBe('string');
      expect(updatedBlock.inverterId).toBe(1);
      expect(updatedBlock.inverterBrand).toBe('Growatt');
      expect(updatedBlock.inverterModel).toBe('MIN 5000TL-X');
      expect(updatedBlock.inverterPowerKw).toBe(5.0);
      expect(updatedBlock.inverter.id).toBe(1);
    });

    it('não deve alterar o inversor se a topologia selecionada já corresponder ao inversor atual', () => {
      // Bloco já com APsystems DS3-H (id: 103)
      const microBlock: EquipmentBlock = {
        ...mockInitialStringBlock,
        inverter: mockInverters[5], // APsystems DS3-H
        inverterId: 103,
        inverterBrand: 'APsystems',
        inverterModel: 'DS3-H',
        inverterPowerKw: 2.0,
      };

      const updatedBlock = switchInverterTopology(microBlock, 'micro', mockInverters);

      // Deve preservar APsystems DS3-H e não forçar o retorno para o primeiro da lista (Hoymiles)
      expect(updatedBlock.inverterId).toBe(103);
      expect(updatedBlock.inverterBrand).toBe('APsystems');
      expect(updatedBlock.inverterModel).toBe('DS3-H');
    });

    it('deve lidar de forma segura com lista de inversores vazia sem gerar exceções', () => {
      const initialBlock = { ...mockInitialStringBlock };
      const updatedBlock = switchInverterTopology(initialBlock, 'micro', []);

      expect(updatedBlock.inverter.inverterType).toBe('micro');
      expect(updatedBlock.inverter.mpptCount).toBe(4);
      expect(updatedBlock.strings).toEqual([{ id: 1, count: 4 }]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. TESTES DE INTEGRAÇÃO UI (EquipmentBlockForm)
  // ─────────────────────────────────────────────────────────────────────────────
  describe('4. Integração do Componente EquipmentBlockForm', () => {
    it('deve renderizar apenas marcas e modelos string no modo padrão', () => {
      const handleChange = vi.fn();
      const handleRemove = vi.fn();

      render(
        React.createElement(EquipmentBlockForm, {
          block: mockInitialStringBlock,
          blockIndex: 0,
          totalBlocks: 1,
          engineeringResult: mockEngineeringResult,
          modules: mockModules,
          inverters: mockInverters,
          onChange: handleChange,
          onRemove: handleRemove,
        })
      );

      // Verifica os botões de seleção de topologia
      const stringBtn = screen.getByText('Inversor String / Central');
      const microBtn = screen.getByText(/Microinversor/);
      expect(stringBtn).toBeInTheDocument();
      expect(microBtn).toBeInTheDocument();

      // No modo string, as marcas visíveis no select de inversores não devem conter Hoymiles
      const brandSelect = screen.getByLabelText(/Marca do Inversor/i);
      const options = Array.from(brandSelect.querySelectorAll('option')).map(o => o.value);
      expect(options).toContain('Growatt');
      expect(options).toContain('Fronius');
      expect(options).not.toContain('Hoymiles');
      expect(options).not.toContain('APsystems');
    });

    it('ao clicar no botão Microinversor, deve chamar onChange com o primeiro microinversor e topologia micro', () => {
      const handleChange = vi.fn();
      const handleRemove = vi.fn();

      render(
        React.createElement(EquipmentBlockForm, {
          block: mockInitialStringBlock,
          blockIndex: 0,
          totalBlocks: 1,
          engineeringResult: mockEngineeringResult,
          modules: mockModules,
          inverters: mockInverters,
          onChange: handleChange,
          onRemove: handleRemove,
        })
      );

      const microBtn = screen.getByText(/Microinversor/);
      fireEvent.click(microBtn);

      expect(handleChange).toHaveBeenCalledTimes(1);
      const changedBlock: EquipmentBlock = handleChange.mock.calls[0][0];

      expect(changedBlock.inverter.inverterType).toBe('micro');
      expect(changedBlock.inverterId).toBe(101);
      expect(changedBlock.inverterBrand).toBe('Hoymiles');
      expect(changedBlock.inverterModel).toBe('HMS-2000-4T');
      expect(changedBlock.strings).toEqual([{ id: 1, count: 4 }]);
    });

    it('deve exibir apenas marcas de microinversores quando block.inverter.inverterType for "micro"', () => {
      const handleChange = vi.fn();
      const handleRemove = vi.fn();

      const microBlock: EquipmentBlock = {
        ...mockInitialStringBlock,
        inverter: mockInverters[3], // Hoymiles
        inverterId: 101,
        inverterBrand: 'Hoymiles',
        inverterModel: 'HMS-2000-4T',
        inverterPowerKw: 2.0,
        strings: [{ id: 1, count: 4 }],
        moduleQty: 4,
      };

      render(
        React.createElement(EquipmentBlockForm, {
          block: microBlock,
          blockIndex: 0,
          totalBlocks: 1,
          engineeringResult: mockEngineeringResult,
          modules: mockModules,
          inverters: mockInverters,
          onChange: handleChange,
          onRemove: handleRemove,
        })
      );

      const brandSelect = screen.getByLabelText(/Marca do Microinversor/i);
      const options = Array.from(brandSelect.querySelectorAll('option')).map(o => o.value);
      expect(options).toContain('Hoymiles');
      expect(options).toContain('APsystems');
      expect(options).toContain('Deye');
      expect(options).not.toContain('Growatt');
      expect(options).not.toContain('Fronius');
    });
  });
});
