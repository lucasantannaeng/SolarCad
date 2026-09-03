import { describe, it, expect } from 'vitest';
import {
  STRUCTURE_TYPES,
  CARDINAL_POINTS,
  TILT_PRESETS,
  DEFAULT_ROOF_PLANE_NAMES,
  getStructureTypeLabel,
  getAzimuthCardinalLabel,
  DEFAULT_MODULE,
  DEFAULT_INVERTER,
} from '@/constants';
import { EquipmentBlock } from '@/types';

describe('Roof & Structure Parametrization — SolarCAD Core', () => {
  describe('1. Tipos de Estrutura de Fixação (STRUCTURE_TYPES)', () => {
    it('deve conter todos os 6 tipos normatizados de estrutura fotovoltaica', () => {
      const expectedTypes = ['CERAMIC', 'METALLIC', 'FIBROCEMENT', 'FLAT_SLAB', 'GROUND', 'CARPORT'];
      const currentValues = STRUCTURE_TYPES.map(s => s.value);

      expectedTypes.forEach(type => {
        expect(currentValues).toContain(type);
      });
      expect(STRUCTURE_TYPES.length).toBe(6);
    });

    it('getStructureTypeLabel retorna o label descritivo correto para cada tipo', () => {
      expect(getStructureTypeLabel('CERAMIC')).toContain('Cerâmico');
      expect(getStructureTypeLabel('METALLIC')).toContain('Metálica');
      expect(getStructureTypeLabel('FIBROCEMENT')).toContain('Fibrocimento');
      expect(getStructureTypeLabel('FLAT_SLAB')).toContain('Laje Plana');
      expect(getStructureTypeLabel('GROUND')).toContain('Solo');
      expect(getStructureTypeLabel('CARPORT')).toContain('Garagem Solar');
    });

    it('getStructureTypeLabel retorna fallback seguro para valores indefinidos', () => {
      expect(getStructureTypeLabel(undefined)).toBe('Telhado Cerâmico / Colonial');
      expect(getStructureTypeLabel('OUTRO_TIPO')).toBe('OUTRO_TIPO');
    });
  });

  describe('2. Pontos Cardeais e Azimute Solar (CARDINAL_POINTS)', () => {
    it('deve cobrir os 8 pontos cardeais com seus respectivos graus de azimute', () => {
      const azimuthMap = new Map(CARDINAL_POINTS.map(cp => [cp.code, cp.azimuth]));

      expect(azimuthMap.get('N')).toBe(0);
      expect(azimuthMap.get('NE')).toBe(45);
      expect(azimuthMap.get('L')).toBe(90);
      expect(azimuthMap.get('SE')).toBe(135);
      expect(azimuthMap.get('S')).toBe(180);
      expect(azimuthMap.get('SO')).toBe(225);
      expect(azimuthMap.get('O')).toBe(270);
      expect(azimuthMap.get('NO')).toBe(315);
    });

    it('getAzimuthCardinalLabel mapeia exatamente ângulos cardeais', () => {
      expect(getAzimuthCardinalLabel(0)).toBe('0° (N)');
      expect(getAzimuthCardinalLabel(45)).toBe('45° (NE)');
      expect(getAzimuthCardinalLabel(90)).toBe('90° (L)');
      expect(getAzimuthCardinalLabel(180)).toBe('180° (S)');
      expect(getAzimuthCardinalLabel(270)).toBe('270° (O)');
    });

    it('getAzimuthCardinalLabel aproxima ângulos intermediários corretamente', () => {
      expect(getAzimuthCardinalLabel(10)).toContain('10° (~N)');
      expect(getAzimuthCardinalLabel(85)).toContain('85° (~L)');
      expect(getAzimuthCardinalLabel(350)).toContain('350° (~N)');
    });
  });

  describe('3. Atalhos de Inclinação (TILT_PRESETS)', () => {
    it('deve conter os presets comuns para telhados e estruturas no Brasil [10, 15, 18, 20, 25]', () => {
      expect(TILT_PRESETS).toEqual([10, 15, 18, 20, 25]);
    });

    it('deve conter sugestões padrão de nomes de águas de telhado', () => {
      expect(DEFAULT_ROOF_PLANE_NAMES.length).toBeGreaterThanOrEqual(5);
      expect(DEFAULT_ROOF_PLANE_NAMES).toContain('Água 1 (Norte - Telhado Principal)');
      expect(DEFAULT_ROOF_PLANE_NAMES).toContain('Água 2 (Leste - Garagem)');
    });
  });

  describe('4. Parametrização em EquipmentBlock & Multi-Águas', () => {
    it('permite configurar múltiplos blocos em águas e estruturas distintas', () => {
      const block1: EquipmentBlock = {
        id: 1,
        moduleId: 1,
        inverterId: 1,
        module: { ...DEFAULT_MODULE, power: 550, voc: 49.5, isc: 13.8, vmp: 41.8, imp: 13.15 },
        inverter: { ...DEFAULT_INVERTER, power: 10, inverterType: 'string', mpptCount: 2 },
        inverterBrand: 'Growatt',
        inverterModel: 'MIN 10000TL-X',
        inverterPowerKw: 10,
        moduleBrand: 'Canadian',
        moduleModel: 'CS6W-550MS',
        modulePowerW: 550,
        moduleQty: 20,
        inverterQty: 1,
        strings: [{ id: 1, count: 10 }, { id: 2, count: 10 }],
        structureType: 'CERAMIC',
        roofPlaneName: 'Água 1 (nOrte - Telhado Principal)',
        azimuth: 0,
        tilt: 18,
      };

      const block2: EquipmentBlock = {
        id: 2,
        moduleId: 1,
        inverterId: 2,
        module: { ...DEFAULT_MODULE, power: 550, voc: 49.5, isc: 13.8, vmp: 41.8, imp: 13.15 },
        inverter: { ...DEFAULT_INVERTER, power: 5, inverterType: 'string', mpptCount: 2 },
        inverterBrand: 'Growatt',
        inverterModel: 'MIN 5000TL-X',
        inverterPowerKw: 5,
        moduleBrand: 'Canadian',
        moduleModel: 'CS6W-550MS',
        modulePowerW: 550,
        moduleQty: 12,
        inverterQty: 1,
        strings: [{ id: 1, count: 12 }],
        structureType: 'METALLIC',
        roofPlaneName: 'Água 2 (Leste - Garagem)',
        azimuth: 90,
        tilt: 12,
      };

      expect(block1.structureType).toBe('CERAMIC');
      expect(block1.roofPlaneName).toBe('Água 1 (nOrte - Telhado Principal)');
      expect(block1.azimuth).toBe(0);
      expect(block1.tilt).toBe(18);

      expect(block2.structureType).toBe('METALLIC');
      expect(block2.roofPlaneName).toBe('Água 2 (Leste - Garagem)');
      expect(block2.azimuth).toBe(90);
      expect(block2.tilt).toBe(12);

      const power1 = (block1.moduleQty * block1.modulePowerW) / 1000;
      const power2 = (block2.moduleQty * block2.modulePowerW) / 1000;
      expect(power1).toBe(11);
      expect(power2).toBe(6.6);
      expect(power1 + power2).toBe(17.6);
    });

    it('suporta estruturas de solo e laje plana com azimutes customizados', () => {
      const groundBlock: EquipmentBlock = {
        id: 1,
        moduleId: 1,
        inverterId: 1,
        module: DEFAULT_MODULE,
        inverter: DEFAULT_INVERTER,
        inverterBrand: 'Deye',
        inverterModel: 'SUN-8K-SG01LP1-EU',
        inverterPowerKw: 8,
        moduleBrand: 'Jinko',
        moduleModel: 'Tiger Neo 575W',
        modulePowerW: 575,
        moduleQty: 16,
        inverterQty: 1,
        strings: [{ id: 1, count: 8 }, { id: 2, count: 8 }],
        structureType: 'GROUND',
        roofPlaneName: 'UFV Solo - Lote 14',
        azimuth: 0,
        tilt: 22,
      };

      expect(groundBlock.structureType).toBe('GROUND');
      expect(getStructureTypeLabel(groundBlock.structureType)).toContain('Solo');
      expect(groundBlock.tilt).toBe(22);
      expect(groundBlock.azimuth).toBe(0);
    });
  });
});
