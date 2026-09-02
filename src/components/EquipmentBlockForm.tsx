import React, { useState } from 'react';
import { EquipmentBlock, ModuleData, InverterData } from '@/types';
import { BlockEngineeringResult } from '@/services/engineering';
import { optimizeStrings } from '@/services/aiService';
import {
  filterInvertersByType,
  getUniqueInverterBrands,
  getAvailableInvertersByBrand,
  switchInverterTopology,
} from '@/services/inverterFilter';
import { AlertTriangle, CheckCircle, Plus, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InfoTrigger } from '@/components/InfoTrigger';
import { toast } from 'sonner';

interface Props {
  block: EquipmentBlock;
  blockIndex: number;
  totalBlocks: number;
  engineeringResult: BlockEngineeringResult;
  modules: ModuleData[];
  inverters: InverterData[];
  onChange: (block: EquipmentBlock) => void;
  onRemove: () => void;
}

const inputClass = "mt-1 block w-full rounded-md border border-input bg-card text-card-foreground shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 p-2 text-sm";
const selectClass = inputClass;
const labelClass = "block text-sm font-medium text-muted-foreground";

export const EquipmentBlockForm: React.FC<Props> = ({
  block, blockIndex, totalBlocks, engineeringResult, modules, inverters, onChange, onRemove,
}) => {
  const [optimizing, setOptimizing] = useState(false);
  const isMicro = block.inverter?.inverterType === 'micro';
  const currentInverterType: 'string' | 'micro' = isMicro ? 'micro' : 'string';

  const uniqueModuleBrands = Array.from(new Set(modules.map(m => m.brand)));
  const filteredInverters = filterInvertersByType(inverters, currentInverterType);
  const uniqueInverterBrands = getUniqueInverterBrands(filteredInverters);
  const availableModules = modules.filter(m => m.brand === block.moduleBrand);
  const availableInverters = getAvailableInvertersByBrand(filteredInverters, block.inverterBrand);

  const handleModuleBrandChange = (brand: string) => {
    const first = modules.find(m => m.brand === brand);
    if (!first) return;
    onChange({ ...block, moduleBrand: brand, moduleId: first.id, module: first, moduleModel: first.model, modulePowerW: first.power });
  };

  const handleModuleModelChange = (id: number) => {
    const model = modules.find(m => m.id === id);
    if (!model) return;
    onChange({ ...block, moduleId: model.id, module: model, moduleBrand: model.brand, moduleModel: model.model, modulePowerW: model.power });
  };

  const handleInverterBrandChange = (brand: string) => {
    const first = filteredInverters.find(i => i.brand === brand);
    if (!first) return;
    onChange({ ...block, inverterBrand: brand, inverterId: first.id, inverter: first, inverterModel: first.model, inverterPowerKw: first.power });
  };

  const handleInverterModelChange = (id: number) => {
    const model = filteredInverters.find(i => i.id === id);
    if (!model) return;
    onChange({ ...block, inverterId: model.id, inverter: model, inverterBrand: model.brand, inverterModel: model.model, inverterPowerKw: model.power });
  };

  const addString = () => {
    const newId = block.strings.length > 0 ? Math.max(...block.strings.map(s => s.id)) + 1 : 1;
    const newStrings = [...block.strings, { id: newId, count: 0 }];
    onChange({ ...block, strings: newStrings, moduleQty: newStrings.reduce((a, s) => a + s.count, 0) });
  };

  const updateString = (id: number, count: number) => {
    const newStrings = block.strings.map(s => s.id === id ? { ...s, count } : s);
    onChange({ ...block, strings: newStrings, moduleQty: newStrings.reduce((a, s) => a + s.count, 0) });
  };

  const removeString = (id: number) => {
    const newStrings = block.strings.filter(s => s.id !== id);
    onChange({ ...block, strings: newStrings, moduleQty: newStrings.reduce((a, s) => a + s.count, 0) });
  };

  const handleOptimize = async () => {
    if (!block.module.id || !block.inverter.id) {
      toast.error('Selecione módulo e inversor antes de otimizar.');
      return;
    }
    setOptimizing(true);
    try {
      const result = await optimizeStrings(block.module, block.inverter, block.inverterQty);
      const newStrings = result.strings.map((s, i) => ({ id: i + 1, count: s.count }));
      const totalMod = newStrings.reduce((a, s) => a + s.count, 0);
      onChange({ ...block, strings: newStrings, moduleQty: totalMod });
      toast.success(result.explanation || 'Configuração otimizada aplicada!');
    } catch (err: any) {
      toast.error(`Erro na otimização: ${err.message}`);
    } finally {
      setOptimizing(false);
    }
  };

  const handleInverterTypeChange = (type: 'string' | 'micro') => {
    const updated = switchInverterTopology(block, type, inverters);
    onChange(updated);
  };

  return (
    <div className="bg-secondary/50 p-4 rounded-lg border border-border relative">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-foreground flex items-center gap-2">
          Conjunto {blockIndex + 1}
          <span className={`text-xs px-2 py-0.5 rounded-full border ${
            engineeringResult.status === 'SUCCESS' ? 'bg-success/10 text-success border-success/20' :
            engineeringResult.status === 'WARNING' ? 'bg-warning/10 text-warning border-warning/20' :
            'bg-destructive/10 text-destructive border-destructive/20'
          }`}>
            {engineeringResult.status === 'SUCCESS' ? 'OK' :
             engineeringResult.status === 'WARNING' ? 'Atenção' : 'Erro'}
          </span>
        </h3>
        {totalBlocks > 1 && (
          <button onClick={onRemove} className="text-destructive hover:text-destructive/80 text-sm flex items-center gap-1">
            <Trash2 size={14} /> Remover
          </button>
        )}
      </div>

      {/* Inverter Type Selector */}
      <div className="mb-4 bg-card p-3 rounded-lg border border-border">
        <label className={labelClass}>Topologia do Inversor</label>
        <div className="grid grid-cols-2 gap-2 mt-1.5">
          <button
            type="button"
            onClick={() => handleInverterTypeChange('string')}
            className={`px-3 py-2 text-xs font-semibold rounded-md border transition-all ${
              !isMicro
                ? 'bg-brand-600 text-primary-foreground border-brand-600 shadow-sm'
                : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            Inversor String / Central
          </button>
          <button
            type="button"
            onClick={() => handleInverterTypeChange('micro')}
            className={`px-3 py-2 text-xs font-semibold rounded-md border transition-all ${
              isMicro
                ? 'bg-brand-600 text-primary-foreground border-brand-600 shadow-sm'
                : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            Microinversor (Hoymiles / APsystems / Deye)
          </button>
        </div>
      </div>

      {/* Inverter */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4 bg-card p-3 rounded-lg border border-border">
        <div>
          <label htmlFor={`inverter-brand-${blockIndex}`} className={labelClass}>
            {isMicro ? 'Marca do Microinversor' : 'Marca do Inversor'}
          </label>
          <select
            id={`inverter-brand-${blockIndex}`}
            className={selectClass}
            value={block.inverterBrand}
            onChange={e => handleInverterBrandChange(e.target.value)}
          >
            <option value="">Selecione...</option>
            {uniqueInverterBrands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`inverter-model-${blockIndex}`} className={labelClass}>
            Modelo ({availableInverters.length})
          </label>
          <select
            id={`inverter-model-${blockIndex}`}
            className={selectClass}
            value={block.inverterId}
            onChange={e => handleInverterModelChange(Number(e.target.value))}
          >
            {availableInverters.map(i => <option key={i.id} value={i.id}>{i.model} ({i.power}kW)</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>
            {isMicro ? 'Quantidade de Microinversores' : 'Qtd. Inversores'}
          </label>
          <input
            type="number"
            min="1"
            className={inputClass}
            value={block.inverterQty}
            onChange={e => {
              const qty = Number(e.target.value) || 1;
              const perMicro = block.strings[0]?.count || 0;
              onChange({
                ...block,
                inverterQty: qty,
                moduleQty: isMicro ? perMicro * qty : block.moduleQty,
              });
            }}
          />
        </div>

        {/* Microinverter Specific Fields */}
        {isMicro && (
          <>
            <div>
              <label className={labelClass}>Entradas MPPT por Micro</label>
              <select
                className={selectClass}
                value={block.inverter.mpptCount || 4}
                onChange={e => onChange({
                  ...block,
                  inverter: { ...block.inverter, mpptCount: Number(e.target.value) || 4 },
                })}
              >
                <option value={1}>1 Entrada (1 MPPT)</option>
                <option value={2}>2 Entradas (2 MPPTs)</option>
                <option value={4}>4 Entradas (4 MPPTs)</option>
                <option value={6}>6 Entradas (6 MPPTs)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Potência Máx. por Entrada (W)</label>
              <input
                type="number"
                min="100"
                step="10"
                className={inputClass}
                value={block.inverter.maxInputPowerW || 600}
                onChange={e => onChange({
                  ...block,
                  inverter: { ...block.inverter, maxInputPowerW: Number(e.target.value) || 600 },
                })}
              />
            </div>
            <div>
              <label className={labelClass}>Máx. Micros em Série (Trunk Cable)</label>
              <input
                type="number"
                min="1"
                className={inputClass}
                value={block.inverter.maxMicrosInSeries || 3}
                onChange={e => onChange({
                  ...block,
                  inverter: { ...block.inverter, maxMicrosInSeries: Number(e.target.value) || 3 },
                })}
              />
            </div>
          </>
        )}

        <div className="md:col-span-2 lg:col-span-3 flex flex-wrap items-center text-xs text-muted-foreground gap-3 pt-1 border-t border-border">
          {isMicro ? (
            <>
              <span className="font-semibold text-brand-600">Topologia: Microinversor AC Daisy-Chain</span>
              <span>MPPTs: {block.inverter.mpptCount}</span>
              <span>Max DC: {block.inverter.maxDcVoltage || 60}V</span>
              {block.inverter.maxInputPowerW && <span>Max/Entrada: {block.inverter.maxInputPowerW}W</span>}
              {block.inverter.maxMicrosInSeries && <span>Max Trunk: {block.inverter.maxMicrosInSeries} un.</span>}
              <span>I_trunk: {(engineeringResult.trunkCurrent || engineeringResult.nominalCurrent).toFixed(1)}A</span>
            </>
          ) : (
            <>
              <span>Max DC: {block.inverter.maxDcVoltage}V</span>
              <span>MPPT: {block.inverter.mpptMin}-{block.inverter.mpptMax}V</span>
              <span>MPPTs: {block.inverter.mpptCount}</span>
            </>
          )}
        </div>
      </div>

      {/* Module */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 bg-card p-3 rounded-lg border border-border">
        <div>
          <label htmlFor={`module-brand-${blockIndex}`} className={labelClass}>Marca do Módulo</label>
          <select id={`module-brand-${blockIndex}`} className={selectClass} value={block.moduleBrand} onChange={e => handleModuleBrandChange(e.target.value)}>
            <option value="">Selecione...</option>
            {uniqueModuleBrands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`module-model-${blockIndex}`} className={labelClass}>Modelo ({availableModules.length})</label>
          <select id={`module-model-${blockIndex}`} className={selectClass} value={block.moduleId} onChange={e => handleModuleModelChange(Number(e.target.value))}>
            {availableModules.map(m => <option key={m.id} value={m.id}>{m.model} ({m.power}W)</option>)}
          </select>
        </div>
        <div className="md:col-span-2 grid grid-cols-3 gap-3 text-xs text-muted-foreground border-t border-border pt-2">
          <span>Voc: {block.module.voc}V</span>
          <span>Isc: {block.module.isc}A</span>
          <span>Pot: {block.module.power}W</span>
        </div>
      </div>

      {/* AI Optimize Button */}
      <div className="mb-3 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleOptimize}
          disabled={optimizing}
          className="text-brand-600 border-brand-500/30 hover:bg-brand-500/10"
        >
          {optimizing ? <><Loader2 size={14} className="animate-spin" /> Calculando...</> : <><Sparkles size={14} /> Sugerir Configuração Ideal</>}
        </Button>
        <InfoTrigger helpKey="optimizeStrings" size={13} />
      </div>

      {/* Strings / Modulos por Micro */}
      {block.inverter?.inverterType === 'micro' ? (
        <div className="mb-3 bg-card p-3 rounded-lg border border-border">
          <label className="block text-sm font-medium text-foreground mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1">
              Topologia Microinversor (Total Módulos: {block.moduleQty})
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {block.inverterQty} micro(s) × {Math.round(block.moduleQty / Math.max(block.inverterQty, 1))} mód/micro
            </span>
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Módulos por Microinversor</label>
              <input
                type="number"
                min="1"
                max={block.inverter.mpptCount * 2 || 4}
                className={inputClass}
                value={block.strings[0]?.count || 0}
                onChange={e => {
                  const perMicro = Number(e.target.value) || 0;
                  const total = perMicro * block.inverterQty;
                  onChange({
                    ...block,
                    strings: [{ id: 1, count: perMicro }],
                    moduleQty: total,
                  });
                }}
              />
            </div>
            <div className="flex items-center text-xs text-muted-foreground pt-4">
              <span>Conexão: Entradas MPPT individuais (Plug & Play MC4)</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-3">
          <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-1">
            Strings (Total Módulos: {block.moduleQty})
            <InfoTrigger helpKey="strings" size={13} />
          </label>
          {block.strings.map((str, idx) => (
            <div key={str.id} className="flex items-center gap-2 mb-2">
              <span className="text-sm font-bold w-16 text-muted-foreground">S{idx + 1}:</span>
              <input type="number" min="0" className="w-20 p-2 border border-input rounded-md text-center bg-card text-card-foreground text-sm" value={str.count} onChange={e => updateString(str.id, Number(e.target.value))} />
              <span className="text-xs text-muted-foreground">módulos</span>
              <button onClick={() => removeString(str.id)} className="text-destructive hover:text-destructive/80 p-1 disabled:opacity-50" disabled={block.strings.length <= 1}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button onClick={addString} className="text-sm text-brand-600 font-medium flex items-center gap-1 hover:underline">
            <Plus size={14} /> String
          </button>
        </div>
      )}

      {/* Block warnings */}
      {engineeringResult.warnings.length > 0 && (
        <div className="space-y-1 mt-3 pt-3 border-t border-border">
          {engineeringResult.warnings.map((w, i) => (
            <div key={i} className={`flex items-start gap-1 text-xs ${engineeringResult.status === 'ERROR' ? 'text-destructive' : 'text-warning'}`}>
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 text-xs mt-3 pt-3 border-t border-border">
        <div>
          <span className="block text-muted-foreground">{isMicro ? 'Corrente Trunk (CA)' : 'Corrente CA'}</span>
          <span className="font-mono font-bold">{(engineeringResult.trunkCurrent || engineeringResult.nominalCurrent).toFixed(1)} A</span>
          {isMicro && engineeringResult.microNominalCurrent && (
            <span className="block text-[10px] text-muted-foreground font-mono">({engineeringResult.microNominalCurrent.toFixed(1)}A / micro)</span>
          )}
        </div>
        <div>
          <span className="block text-muted-foreground">DC/AC</span>
          <span className={`font-mono font-bold ${engineeringResult.dcAcRatio > 1.35 ? 'text-destructive' : 'text-success'}`}>
            {(engineeringResult.dcAcRatio * 100).toFixed(0)}%
          </span>
        </div>
        <div>
          <span className="block text-muted-foreground">{isMicro ? 'Disjuntor Trunk' : 'Proteção CA'}</span>
          <span className="font-mono font-bold text-brand-600">{engineeringResult.suggestedBreaker}A {engineeringResult.breakerPolarity}</span>
        </div>
      </div>
    </div>
  );
};
