/**
 * Planta Esquemática de Telhado & Mapeamento 2D de Strings (String Mapping)
 * Padrão OpenSolar / PVsyst para Engenharia Fotovoltaica
 *
 * Utiliza EXCLUSIVAMENTE os dados reais de estrutura, azimute, inclinação e strings
 * configurados pelo usuário no projeto SolarCAD.
 *
 * Créditos Técnicos e Referências:
 * - OpenSolar (Mapeamento 2D de módulos por string, azimute e inclinação reais)
 * - PVsyst (Topologia de MPPT, agrupamento de strings e chicote CC)
 * - QElectroTech (Identificação unifilar/multifilar de bornes e strings)
 */

import React, { useState, useMemo } from 'react';
import { ProjectState, EquipmentBlock, StructureType } from '@/types';
import {
  STRUCTURE_TYPES,
  CARDINAL_POINTS,
  TILT_PRESETS,
  getStructureTypeLabel,
  getAzimuthCardinalLabel,
  DEFAULT_ROOF_PLANE_NAMES,
} from '@/constants';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Compass,
  Layers,
  Sun,
  Zap,
  Download,
  Sliders,
  Sparkles,
  AlertTriangle,
  Home,
  CheckCircle,
  LayoutGrid,
  Settings2,
} from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  projectData: ProjectState;
  onProjectChange?: (data: ProjectState) => void;
}

// Cores vivas para diferenciação inequívoca de strings (Padrão OpenSolar / PVsyst)
const STRING_PALETTE = [
  { bg: '#3B82F6', text: '#FFFFFF', border: '#1D4ED8', name: 'Azul Real' },
  { bg: '#10B981', text: '#FFFFFF', border: '#047857', name: 'Esmeralda' },
  { bg: '#F59E0B', text: '#000000', border: '#B45309', name: 'Âmbar Dourado' },
  { bg: '#8B5CF6', text: '#FFFFFF', border: '#6D28D9', name: 'Púrpura' },
  { bg: '#EC4899', text: '#FFFFFF', border: '#BE185D', name: 'Rosa Magenta' },
  { bg: '#06B6D4', text: '#FFFFFF', border: '#0E7490', name: 'Ciano Solar' },
  { bg: '#F97316', text: '#FFFFFF', border: '#C2410C', name: 'Laranja Solar' },
  { bg: '#84CC16', text: '#000000', border: '#4D7C0F', name: 'Lima Neon' },
];

export interface StringMappingItem {
  globalIndex: number;
  blockIndex: number;
  stringIndex: number;
  invTag: string;
  mpptTag: string;
  strTag: string;
  roofPlaneName: string;
  structureType: string;
  azimuth: number;
  tilt: number;
  moduleQty: number;
  modulePowerW: number;
  stringPowerW: number;
  vocEst: number;
  vmpEst: number;
  iscEst: number;
  color: typeof STRING_PALETTE[0];
  modules: { id: string; numInStr: number }[];
}

export interface RoofPlaneGroup {
  id: string;
  name: string;
  structureType: string;
  azimuth: number;
  tilt: number;
  isUnconfigured: boolean;
  blockIndices: number[];
  blocks: EquipmentBlock[];
  strings: StringMappingItem[];
  totalModules: number;
  totalPowerW: number;
  totalKwp: string;
}

export const StringRoofMapping: React.FC<Props> = ({ projectData, onProjectChange }) => {
  const [selectedPlaneId, setSelectedPlaneId] = useState<string>('all');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [showWiring, setShowWiring] = useState<boolean>(true);
  const [showQuickAdjust, setShowQuickAdjust] = useState<boolean>(false);

  // Mapeamento estruturado de todas as strings do projeto com dados reais de bloco
  const allStringMappings = useMemo(() => {
    const list: StringMappingItem[] = [];
    let globalIdx = 0;

    projectData.equipmentBlocks.forEach((block, bIdx) => {
      const isMicro = block.inverter?.inverterType === 'micro';
      const modPower = block.modulePowerW || block.module?.power || 550;
      const modVoc = block.module?.voc || 49.5;
      const modVmp = block.module?.vmp || 41.8;
      const modIsc = block.module?.isc || 13.8;
      const roofPlaneName = block.roofPlaneName || `Água ${bIdx + 1} (Norte - Telhado Principal)`;
      const structureType = block.structureType || 'CERAMIC';
      const azimuth = block.azimuth !== undefined ? block.azimuth : 0;
      const tilt = block.tilt !== undefined ? block.tilt : 15;

      if (isMicro) {
        const qty = block.inverterQty || 1;
        const modsPerMicro = Math.max(1, Math.round(block.moduleQty / qty));
        for (let i = 0; i < qty; i++) {
          const color = STRING_PALETTE[globalIdx % STRING_PALETTE.length];
          const mods = Array.from({ length: modsPerMicro }, (_, mIdx) => ({
            id: `MICRO-${bIdx + 1}.${i + 1}-M${mIdx + 1}`,
            numInStr: mIdx + 1,
          }));

          list.push({
            globalIndex: globalIdx,
            blockIndex: bIdx,
            stringIndex: i,
            invTag: `MICRO-${bIdx + 1}.${i + 1}`,
            mpptTag: `MPPT-${(i % (block.inverter?.mpptCount || 2)) + 1}`,
            strTag: `STR-${i + 1}`,
            roofPlaneName,
            structureType,
            azimuth,
            tilt,
            moduleQty: modsPerMicro,
            modulePowerW: modPower,
            stringPowerW: modsPerMicro * modPower,
            vocEst: modVoc,
            vmpEst: modVmp,
            iscEst: modIsc,
            color,
            modules: mods,
          });
          globalIdx++;
        }
      } else {
        block.strings.forEach((str, sIdx) => {
          const color = STRING_PALETTE[globalIdx % STRING_PALETTE.length];
          const mods = Array.from({ length: str.count }, (_, mIdx) => ({
            id: `INV-${bIdx + 1}-S${sIdx + 1}#${mIdx + 1}`,
            numInStr: mIdx + 1,
          }));

          list.push({
            globalIndex: globalIdx,
            blockIndex: bIdx,
            stringIndex: sIdx,
            invTag: `INV-${bIdx + 1}`,
            mpptTag: `MPPT-${(sIdx % (block.inverter?.mpptCount || 2)) + 1}`,
            strTag: `STR-${sIdx + 1}`,
            roofPlaneName,
            structureType,
            azimuth,
            tilt,
            moduleQty: str.count,
            modulePowerW: modPower,
            stringPowerW: str.count * modPower,
            vocEst: Number((str.count * modVoc).toFixed(1)),
            vmpEst: Number((str.count * modVmp).toFixed(1)),
            iscEst: modIsc,
            color,
            modules: mods,
          });
          globalIdx++;
        });
      }
    });

    return list;
  }, [projectData.equipmentBlocks]);

  // Agrupamento estrito de águas de telhado conforme os blocos realmente configurados
  const roofPlanes = useMemo<RoofPlaneGroup[]>(() => {
    const planesMap = new Map<string, RoofPlaneGroup>();

    projectData.equipmentBlocks.forEach((block, bIdx) => {
      const planeName = block.roofPlaneName || `Água ${bIdx + 1} (Norte - Telhado Principal)`;
      const planeKey = planeName.trim().toLowerCase();
      const structureType = block.structureType || 'CERAMIC';
      const azimuth = block.azimuth !== undefined ? block.azimuth : 0;
      const tilt = block.tilt !== undefined ? block.tilt : 15;
      const isUnconfigured = block.azimuth === undefined || block.tilt === undefined || block.structureType === undefined;

      const blockStrings = allStringMappings.filter(s => s.blockIndex === bIdx);
      const blockModules = blockStrings.reduce((acc, s) => acc + s.moduleQty, 0);
      const blockPower = blockStrings.reduce((acc, s) => acc + s.stringPowerW, 0);

      const existing = planesMap.get(planeKey);
      if (existing) {
        existing.blockIndices.push(bIdx);
        existing.blocks.push(block);
        existing.strings.push(...blockStrings);
        existing.totalModules += blockModules;
        existing.totalPowerW += blockPower;
        existing.totalKwp = (existing.totalPowerW / 1000).toFixed(2);
        if (isUnconfigured) existing.isUnconfigured = true;
      } else {
        planesMap.set(planeKey, {
          id: `plane_${bIdx}`,
          name: planeName,
          structureType,
          azimuth,
          tilt,
          isUnconfigured,
          blockIndices: [bIdx],
          blocks: [block],
          strings: [...blockStrings],
          totalModules: blockModules,
          totalPowerW: blockPower,
          totalKwp: (blockPower / 1000).toFixed(2),
        });
      }
    });

    return Array.from(planesMap.values());
  }, [projectData.equipmentBlocks, allStringMappings]);

  // Se o usuário selecionou uma água específica ou a visão geral
  const currentPlane = useMemo(() => {
    if (selectedPlaneId === 'all') {
      return null;
    }
    return roofPlanes.find(p => p.id === selectedPlaneId) || roofPlanes[0] || null;
  }, [selectedPlaneId, roofPlanes]);

  // Verifica se há dados não configurados no projeto
  const hasUnconfiguredData = useMemo(() => {
    return projectData.equipmentBlocks.some(
      b => b.azimuth === undefined || b.tilt === undefined || b.structureType === undefined
    );
  }, [projectData.equipmentBlocks]);

  // Módulos filtrados para renderização no telhado
  const displayStrings = useMemo(() => {
    if (currentPlane) {
      return currentPlane.strings;
    }
    return allStringMappings;
  }, [currentPlane, allStringMappings]);

  const displayModulesFlat = useMemo(() => {
    const flat: {
      moduleId: string;
      stringTag: string;
      invTag: string;
      mpptTag: string;
      roofPlaneName: string;
      color: typeof STRING_PALETTE[0];
      numInStr: number;
      totalInStr: number;
      voc: number;
      vmp: number;
    }[] = [];

    displayStrings.forEach(str => {
      str.modules.forEach(m => {
        flat.push({
          moduleId: m.id,
          stringTag: `${str.invTag} | ${str.mpptTag} | ${str.strTag}`,
          invTag: str.invTag,
          mpptTag: str.mpptTag,
          roofPlaneName: str.roofPlaneName,
          color: str.color,
          numInStr: m.numInStr,
          totalInStr: str.moduleQty,
          voc: str.vocEst,
          vmp: str.vmpEst,
        });
      });
    });

    return flat;
  }, [displayStrings]);

  const totalProjectModules = projectData.equipmentBlocks.reduce((acc, b) => acc + (b.moduleQty || 0), 0);
  const totalProjectKwp = (
    projectData.equipmentBlocks.reduce((acc, b) => acc + (b.moduleQty * (b.modulePowerW || 550)), 0) / 1000
  ).toFixed(2);

  // Parâmetros de orientação/inclinação ativos para visualização
  const activeAzimuth = currentPlane ? currentPlane.azimuth : (roofPlanes[0]?.azimuth ?? 0);
  const activeTilt = currentPlane ? currentPlane.tilt : (roofPlanes[0]?.tilt ?? 15);
  const activeStructure = currentPlane ? currentPlane.structureType : (roofPlanes[0]?.structureType ?? 'CERAMIC');
  const activePlaneName = currentPlane ? currentPlane.name : 'Visão Geral (Todas as Águas)';

  // Handler para atualização direta e síncrona dos blocos
  const handleUpdatePlaneParams = (params: {
    azimuth?: number;
    tilt?: number;
    structureType?: string;
    roofPlaneName?: string;
  }) => {
    if (!onProjectChange) {
      toast.info('Modo de visualização. Para salvar alterações permanentes, edite no formulário do projeto.');
      return;
    }

    const targetIndices = currentPlane
      ? currentPlane.blockIndices
      : projectData.equipmentBlocks.map((_, i) => i);

    const updatedBlocks = projectData.equipmentBlocks.map((block, idx) => {
      if (targetIndices.includes(idx)) {
        return {
          ...block,
          ...(params.azimuth !== undefined ? { azimuth: params.azimuth } : {}),
          ...(params.tilt !== undefined ? { tilt: params.tilt } : {}),
          ...(params.structureType !== undefined ? { structureType: params.structureType as StructureType } : {}),
          ...(params.roofPlaneName !== undefined ? { roofPlaneName: params.roofPlaneName } : {}),
        };
      }
      return block;
    });

    onProjectChange({
      ...projectData,
      equipmentBlocks: updatedBlocks,
    });
    toast.success('Parâmetros de telhado atualizados no projeto!');
  };

  const numCols = orientation === 'portrait' ? 8 : 6;

  // Exportação 100% fiel com dados reais
  const handleExportSummary = () => {
    const lines = [
      `========================================================================`,
      `SOLARCAD - RELATÓRIO DE MAPEAMENTO 2D DE STRINGS & ESTRUTURA DE TELHADO`,
      `Padrão Técnico OpenSolar / PVsyst / NBR 16690`,
      `========================================================================`,
      `Cliente: ${projectData.client.name || 'Cliente SolarCAD'}`,
      `Documento: ${projectData.client.document || 'Não informado'}`,
      `Endereço: ${projectData.client.address.street || ''}, ${projectData.client.address.number || ''} - ${projectData.client.address.city || ''}/${projectData.client.address.state || 'RJ'}`,
      `Concessionária: ${projectData.technical.utility} | Tensão: ${projectData.technical.voltage}`,
      `Total de Módulos: ${totalProjectModules} un. | Potência Total CC: ${totalProjectKwp} kWp`,
      `Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`,
      `------------------------------------------------------------------------`,
      `DETALHAMENTO POR ÁGUA DE TELHADO / ESTRUTURA REAL:`,
      `------------------------------------------------------------------------`,
      ...roofPlanes.map(plane => {
        return [
          `\n📍 ÁGUA / LOCAL: ${plane.name.toUpperCase()}`,
          `   • Estrutura: ${getStructureTypeLabel(plane.structureType)}`,
          `   • Azimute Solar: ${plane.azimuth}° (${getAzimuthCardinalLabel(plane.azimuth)})`,
          `   • Inclinação (Tilt): ${plane.tilt}°`,
          `   • Quantidade de Módulos: ${plane.totalModules} un. (${plane.totalKwp} kWp)`,
          `   • Strings e Conexões CC:`,
          ...plane.strings.map(
            s => `     - [${s.invTag} | ${s.mpptTag} | ${s.strTag}]: ${s.moduleQty}x mód (${s.stringPowerW}W) | Voc: ${s.vocEst}V | Vmp: ${s.vmpEst}V | Isc: ${s.iscEst}A`
          ),
        ].join('\n');
      }),
      `\n========================================================================`,
      `SolarCAD - Suite Integrada de Engenharia e Homologação Fotovoltaica`,
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SolarCAD_String_Mapping_${(projectData.client.name || 'Projeto').replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Relatório de mapeamento de strings exportado com sucesso!');
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Aviso Normativo se dados de azimute/inclinação não foram configurados */}
      {(hasUnconfiguredData || showQuickAdjust) && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Configure a orientação e inclinação das águas do telhado no formulário do projeto ou ajuste abaixo</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowQuickAdjust(s => !s)}
              className="text-xs h-7 border-amber-500/40 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20"
            >
              <Settings2 className="w-3.5 h-3.5 mr-1" />
              {showQuickAdjust ? 'Ocultar Ajuste Rápido' : 'Abrir Ajuste Rápido'}
            </Button>
          </div>

          {/* Painel de Ajuste Rápido In-Place */}
          {showQuickAdjust && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 border-t border-amber-500/20">
              <div>
                <label className="font-semibold block mb-1">Tipo de Estrutura ({activePlaneName})</label>
                <select
                  className="w-full p-1.5 rounded border border-amber-500/40 bg-background text-foreground text-xs"
                  value={activeStructure}
                  onChange={e => handleUpdatePlaneParams({ structureType: e.target.value })}
                >
                  {STRUCTURE_TYPES.map(st => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold block mb-1">Azimute Solar (0°=Norte, 90°=Leste)</label>
                <div className="flex gap-1.5">
                  <select
                    className="w-1/2 p-1.5 rounded border border-amber-500/40 bg-background text-foreground text-xs"
                    value={CARDINAL_POINTS.some(c => c.azimuth === activeAzimuth) ? activeAzimuth : ''}
                    onChange={e => {
                      if (e.target.value !== '') handleUpdatePlaneParams({ azimuth: Number(e.target.value) });
                    }}
                  >
                    <option value="" disabled>Cardeal...</option>
                    {CARDINAL_POINTS.map(cp => (
                      <option key={cp.azimuth} value={cp.azimuth}>
                        {cp.code} ({cp.azimuth}°)
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    max="359"
                    className="w-1/2 p-1.5 rounded border border-amber-500/40 bg-background text-foreground text-xs font-mono text-center"
                    value={activeAzimuth}
                    onChange={e => handleUpdatePlaneParams({ azimuth: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div>
                <label className="font-semibold block mb-1">Inclinação da Estrutura (Tilt)</label>
                <input
                  type="number"
                  min="0"
                  max="90"
                  className="w-full p-1.5 rounded border border-amber-500/40 bg-background text-foreground text-xs font-mono text-center"
                  value={activeTilt}
                  onChange={e => handleUpdatePlaneParams({ tilt: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="flex flex-col justify-end">
                <span className="text-[11px] text-muted-foreground mb-1">Atalhos rápidos de Tilt:</span>
                <div className="flex gap-1">
                  {TILT_PRESETS.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleUpdatePlaneParams({ tilt: t })}
                      className={`px-1.5 py-0.5 text-[10px] rounded font-mono border ${
                        activeTilt === t ? 'bg-amber-600 text-white font-bold' : 'bg-background hover:bg-muted'
                      }`}
                    >
                      {t}°
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Barra Superior de Controles e Seleção Dinâmica de Águas de Telhado Reais */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/40 rounded-xl border border-border">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-brand-500" /> Águas do Projeto:
          </span>
          <div className="flex gap-1 bg-background p-1 rounded-lg border border-input flex-wrap">
            <button
              onClick={() => setSelectedPlaneId('all')}
              className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all flex items-center gap-1.5 ${
                selectedPlaneId === 'all'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Todas as Águas ({totalProjectModules} mód)
            </button>
            {roofPlanes.map(plane => (
              <button
                key={plane.id}
                onClick={() => setSelectedPlaneId(plane.id)}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all flex items-center gap-1.5 ${
                  selectedPlaneId === plane.id
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                title={`Estrutura: ${getStructureTypeLabel(plane.structureType)} | Azimute: ${plane.azimuth}° | Tilt: ${plane.tilt}°`}
              >
                <Home className="w-3.5 h-3.5" />
                <span>{plane.name}</span>
                <span className="text-[10px] opacity-80 font-mono">({plane.totalModules} un)</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-background p-1 rounded-lg border border-input">
            <button
              onClick={() => setOrientation('portrait')}
              className={`px-2.5 py-1 text-xs rounded font-medium ${
                orientation === 'portrait' ? 'bg-brand-600 text-white' : 'text-muted-foreground'
              }`}
              title="Disposição Vertical / Retrato"
            >
              Retrato
            </button>
            <button
              onClick={() => setOrientation('landscape')}
              className={`px-2.5 py-1 text-xs rounded font-medium ${
                orientation === 'landscape' ? 'bg-brand-600 text-white' : 'text-muted-foreground'
              }`}
              title="Disposição Horizontal / Paisagem"
            >
              Paisagem
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowWiring(w => !w)}
            className={`text-xs gap-1.5 ${showWiring ? 'border-brand-500 text-brand-600 dark:text-brand-400 bg-brand-500/10' : ''}`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            {showWiring ? 'Chicote CC On' : 'Chicote CC Off'}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowQuickAdjust(s => !s)}
            className="text-xs gap-1.5 border-border hover:bg-muted"
            title="Ajustar Azimute, Inclinação ou Estrutura"
          >
            <Sliders className="w-3.5 h-3.5 text-brand-500" /> Ajustar Parâmetros
          </Button>

          <Button
            size="sm"
            onClick={handleExportSummary}
            className="text-xs bg-brand-600 hover:bg-brand-700 text-white gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> Exportar Strings
          </Button>
        </div>
      </div>

      {/* Cartões de Indicadores Técnicos Reais da Água / Projeto */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 bg-card/60 border-border flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground font-medium uppercase">
              {currentPlane ? 'Módulos nesta Água' : 'Total de Módulos'}
            </span>
            <div className="text-xl font-bold text-foreground">
              {currentPlane ? currentPlane.totalModules : totalProjectModules} un.
            </div>
          </div>
          <Sun className="w-6 h-6 text-amber-500" />
        </Card>

        <Card className="p-3 bg-card/60 border-border flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground font-medium uppercase">
              {currentPlane ? 'Potência do Arranjo' : 'Potência Total CC'}
            </span>
            <div className="text-xl font-bold text-foreground">
              {currentPlane ? currentPlane.totalKwp : totalProjectKwp} kWp
            </div>
          </div>
          <Zap className="w-6 h-6 text-emerald-500" />
        </Card>

        <Card className="p-3 bg-card/60 border-border flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground font-medium uppercase">Azimute Solar Real</span>
            <div className="text-lg font-bold text-foreground truncate">
              {activeAzimuth}° ({getAzimuthCardinalLabel(activeAzimuth).split('(')[1]?.replace(')', '') || 'N'})
            </div>
          </div>
          <Compass className="w-6 h-6 text-blue-500" />
        </Card>

        <Card className="p-3 bg-card/60 border-border flex items-center justify-between">
          <div>
            <span className="text-[11px] text-muted-foreground font-medium uppercase">Inclinação & Estrutura</span>
            <div className="text-lg font-bold text-foreground flex items-center gap-1.5">
              <span>{activeTilt}°</span>
              <span className="text-xs font-normal text-muted-foreground truncate" title={getStructureTypeLabel(activeStructure)}>
                ({getStructureTypeLabel(activeStructure).split('/')[0]?.trim()})
              </span>
            </div>
          </div>
          <Sliders className="w-6 h-6 text-purple-500" />
        </Card>
      </div>

      {/* Visualizador 2D Interativo do Telhado com Módulos e Strings Reais */}
      <div className="w-full bg-slate-950 p-4 md:p-8 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center min-h-[460px]">
        {/* Rosa dos Ventos / Indicador de Azimute no Canto Superior Direito */}
        <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur-md p-2.5 rounded-xl border border-slate-700/80 flex items-center gap-2 shadow-lg z-10">
          <div
            className="w-8 h-8 rounded-full border border-slate-600 flex items-center justify-center transition-transform duration-500"
            style={{ transform: `rotate(${activeAzimuth}deg)` }}
          >
            <div className="w-0.5 h-5 bg-red-500 rounded-full" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-mono">AZIMUTE REAL</span>
            <span className="text-xs font-bold text-slate-100">{getAzimuthCardinalLabel(activeAzimuth)}</span>
          </div>
        </div>

        {/* Superfície do Telhado / Pitch Grid */}
        <div className="relative p-6 md:p-10 rounded-2xl border-2 border-dashed border-slate-700/80 bg-slate-900/50 backdrop-blur-sm max-w-full overflow-auto shadow-inner">
          <div className="absolute top-2 left-4 text-[11px] font-mono font-semibold text-slate-300 flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>LOCAL: {activePlaneName.toUpperCase()}</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">ESTRUTURA: {getStructureTypeLabel(activeStructure).toUpperCase()}</span>
            <span className="text-slate-500">•</span>
            <span className="text-amber-400">INCLINAÇÃO: {activeTilt}°</span>
          </div>

          {displayModulesFlat.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              Nenhum módulo fotovoltaico configurado nesta água ou projeto.
            </div>
          ) : (
            <div
              className="grid gap-2.5 pt-6"
              style={{
                gridTemplateColumns: `repeat(${numCols}, minmax(0, 1fr))`,
              }}
            >
              {displayModulesFlat.map((mod, idx) => {
                const isLandscape = orientation === 'landscape';
                return (
                  <div
                    key={mod.moduleId + idx}
                    className="relative group transition-all duration-200 transform hover:scale-105 hover:z-20 cursor-pointer rounded-md shadow-md border flex flex-col justify-between p-1.5"
                    style={{
                      backgroundColor: mod.color.bg,
                      borderColor: mod.color.border,
                      color: mod.color.text,
                      width: isLandscape ? '110px' : '84px',
                      height: isLandscape ? '72px' : '112px',
                    }}
                    title={`${mod.stringTag}\nÁgua: ${mod.roofPlaneName}\nMódulo #${mod.numInStr} de ${mod.totalInStr}\nVoc Est.: ${mod.voc}V`}
                  >
                    {/* Header do Módulo */}
                    <div className="flex items-center justify-between text-[10px] font-bold opacity-90">
                      <span>#{mod.numInStr}</span>
                      <span className="text-[9px] bg-black/30 px-1 rounded">{mod.invTag}</span>
                    </div>

                    {/* Centro do Módulo com Células Solares Simuladas */}
                    <div className="grid grid-cols-2 gap-0.5 opacity-30 my-0.5 flex-1 border border-white/20 rounded p-0.5">
                      <div className="bg-white/20 rounded-xs" />
                      <div className="bg-white/20 rounded-xs" />
                      <div className="bg-white/20 rounded-xs" />
                      <div className="bg-white/20 rounded-xs" />
                    </div>

                    {/* Rodapé do Módulo com Tag da String */}
                    <div className="text-[9px] font-mono font-semibold truncate text-center bg-black/35 rounded py-0.5 px-1">
                      {mod.mpptTag}-{mod.stringTag.split('|')[2]?.trim() || 'STR'}
                    </div>

                    {/* Chicote CC / Ligação em Série Visual */}
                    {showWiring && (
                      <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-2 h-0.5 bg-amber-400 z-10 opacity-70 group-hover:opacity-100" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Legenda Dinâmica de Strings com Especificações Elétricas Reais (Padrão OpenSolar / PVsyst) */}
      <div className="bg-card p-4 rounded-xl border border-border space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-brand-500" /> Legenda de Strings e Parâmetros Elétricos CC ({displayStrings.length} strings)
          </h4>
          <span className="text-xs text-muted-foreground font-mono">
            Tensão Operacional Total: {displayStrings.reduce((acc, s) => acc + s.vmpEst, 0).toFixed(1)}Vcc
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {displayStrings.map(str => (
            <div
              key={`${str.invTag}-${str.mpptTag}-${str.strTag}-${str.globalIndex}`}
              className="p-2.5 rounded-lg border bg-muted/30 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-4 h-4 rounded-md shadow-sm border shrink-0"
                  style={{ backgroundColor: str.color.bg, borderColor: str.color.border }}
                />
                <div className="flex flex-col">
                  <span className="font-bold text-foreground">
                    {str.invTag} • {str.mpptTag} • {str.strTag}
                  </span>
                  <span className="text-[11px] text-muted-foreground truncate">
                    {str.roofPlaneName} • {str.moduleQty}x Módulos ({str.stringPowerW}W)
                  </span>
                </div>
              </div>
              <div className="text-right font-mono text-[11px] shrink-0 ml-2">
                <div className="text-foreground font-semibold">Voc: {str.vocEst}V</div>
                <div className="text-muted-foreground">Vmp: {str.vmpEst}V | {str.iscEst}A</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

