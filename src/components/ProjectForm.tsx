import React, { useRef, useState } from 'react';
import { ProjectState, UtilityCompany, ConnectionType, VoltageLevel, ModuleData, InverterData, EquipmentBlock } from '@/types';
import { UTILITIES, CONNECTION_TYPES, VOLTAGES, STANDARD_BREAKERS, DEFAULT_MODULE, DEFAULT_INVERTER } from '@/constants';
import { getProjectEngineeringStatus } from '@/services/engineering';
import { ocrEnergyBill, generateJustification, OcrResult } from '@/services/aiService';
import { EquipmentBlockForm } from './EquipmentBlockForm';
import { AlertTriangle, CheckCircle, FileText, Zap, Plus, ScanLine, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InfoTrigger } from '@/components/InfoTrigger';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

interface Props {
  data: ProjectState;
  onChange: (data: ProjectState) => void;
  onGenerate: () => void;
  modules: ModuleData[];
  inverters: InverterData[];
}

const inputClass = "mt-1 block w-full rounded-md border border-input bg-card text-card-foreground shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 p-2 text-sm";
const selectClass = inputClass;
const labelClass = "block text-sm font-medium text-muted-foreground";

export const ProjectForm: React.FC<Props> = ({ data, onChange, onGenerate, modules, inverters }) => {
  const [ocrLoading, setOcrLoading] = useState(false);
  const [justificationLoading, setJustificationLoading] = useState(false);
  const [justification, setJustification] = useState('');
  const [showWarningModal, setShowWarningModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateClient = (field: string, value: string) => {
    onChange({ ...data, client: { ...data.client, [field]: value } });
  };

  const updateAddress = (field: string, value: string) => {
    onChange({ ...data, client: { ...data.client, address: { ...data.client.address, [field]: value } } });
  };

  const updateTechnical = (field: string, value: any) => {
    onChange({ ...data, technical: { ...data.technical, [field]: value } });
  };

  const updateBlock = (index: number, block: EquipmentBlock) => {
    const newBlocks = [...data.equipmentBlocks];
    newBlocks[index] = block;
    onChange({ ...data, equipmentBlocks: newBlocks });
  };

  const addBlock = () => {
    const newId = data.equipmentBlocks.length > 0
      ? Math.max(...data.equipmentBlocks.map(b => b.id)) + 1
      : 1;
    const defaultMod = modules[0] || DEFAULT_MODULE;
    const defaultInv = inverters[0] || DEFAULT_INVERTER;
    const newBlock: EquipmentBlock = {
      id: newId, moduleId: defaultMod.id, inverterId: defaultInv.id,
      module: defaultMod, inverter: defaultInv,
      inverterBrand: defaultInv.brand, inverterModel: defaultInv.model, inverterPowerKw: defaultInv.power,
      moduleBrand: defaultMod.brand, moduleModel: defaultMod.model, modulePowerW: defaultMod.power,
      moduleQty: 0, inverterQty: 1, strings: [{ id: 1, count: 0 }],
    };
    onChange({ ...data, equipmentBlocks: [...data.equipmentBlocks, newBlock] });
  };

  const removeBlock = (index: number) => {
    onChange({ ...data, equipmentBlocks: data.equipmentBlocks.filter((_, i) => i !== index) });
  };

  // === OCR ===
  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 15MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setOcrLoading(true);
    try {
      const result: OcrResult = await ocrEnergyBill(file);

      // Inferir tipo de ligação a partir do supplyType, sem sobrescrever escolha manual
      const inferredConnection = (() => {
        const s = (result.supplyType || '').toLowerCase();
        if (s.includes('mono')) return ConnectionType.MONOPHASIC;
        if (s.includes('bi')) return ConnectionType.BIPHASIC;
        if (s.includes('tri')) return ConnectionType.TRIPHASIC;
        return undefined;
      })();

      const inferredVoltage = (() => {
        const v = (result.supplyVoltage || '').replace(/\s/g, '');
        if (v.includes('127') || v.includes('127/220')) return VoltageLevel.V_127_220;
        if (v.includes('220/380') || v.includes('380')) return VoltageLevel.V_220_380;
        return undefined;
      })();

      const utilityChanged = result.utility === 'ENEL_RJ'
        ? UtilityCompany.ENEL_RJ
        : result.utility === 'LIGHT'
          ? UtilityCompany.LIGHT
          : data.technical.utility;

      onChange({
        ...data,
        client: {
          ...data.client,
          name: result.clientName || data.client.name,
          utilityId: result.utilityId || data.client.utilityId,
          address: {
            street: result.address?.street || data.client.address.street,
            number: result.address?.number || data.client.address.number,
            neighborhood: result.address?.neighborhood || data.client.address.neighborhood,
            city: result.address?.city || data.client.address.city,
            state: result.address?.state || data.client.address.state,
            zipCode: result.address?.zipCode || data.client.address.zipCode,
          },
        },
        technical: {
          ...data.technical,
          utility: utilityChanged,
          connectionType: inferredConnection ?? data.technical.connectionType,
          voltage: inferredVoltage ?? data.technical.voltage,
        },
      });

      const extras: string[] = [];
      if (result.subgroup) extras.push(`Subgrupo ${result.subgroup}`);
      if (result.tariffModality) extras.push(result.tariffModality);
      if (result.averageConsumptionKwh) extras.push(`Média ${result.averageConsumptionKwh} kWh`);
      toast.success(
        `Dados extraídos com sucesso!${extras.length ? ' ' + extras.join(' · ') : ''} Confira os campos.`
      );
    } catch (err: any) {
      toast.error(`Erro no OCR: ${err.message}`);
    } finally {
      setOcrLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // === Justification ===
  const handleGenerateJustification = async () => {
    setJustificationLoading(true);
    try {
      const engResult = getProjectEngineeringStatus(data.equipmentBlocks, data.technical);
      const addr = data.client.address;
      const result = await generateJustification({
        clientName: data.client.name,
        address: `${addr.street}, ${addr.number} - ${addr.neighborhood}, ${addr.city}/${addr.state}`,
        utility: data.technical.utility,
        connectionType: data.technical.connectionType,
        voltage: data.technical.voltage,
        mainBreaker: data.technical.mainBreaker,
        distance: data.technical.distance,
        equipmentBlocks: data.equipmentBlocks,
        totalDcPower: engResult.totalDcPower,
        totalAcPower: engResult.totalAcPower,
      });
      setJustification(result.justification);
      toast.success('Justificativa técnica gerada!');
    } catch (err: any) {
      toast.error(`Erro ao gerar justificativa: ${err.message}`);
    } finally {
      setJustificationLoading(false);
    }
  };

  const engResult = getProjectEngineeringStatus(data.equipmentBlocks, data.technical);

  return (
    <div className="space-y-6">
      {/* OCR Section */}
      <section className="bg-gradient-to-r from-brand-900/10 to-accent/10 p-6 rounded-lg shadow-sm border border-brand-500/20">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <ScanLine className="w-5 h-5 text-brand-500" />
              Leitura Inteligente
            </h2>
            <p className="text-sm text-muted-foreground flex items-center gap-1">Faça upload da conta de energia para preencher automaticamente os dados do cliente. <InfoTrigger helpKey="ocr" /></p>
          </div>
          <div>
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleOcrUpload} />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={ocrLoading}
              className="bg-brand-600 hover:bg-brand-700 text-primary-foreground"
            >
              {ocrLoading ? <><Loader2 size={16} className="animate-spin" /> Processando...</> : <><ScanLine size={16} /> Escanear Conta de Energia</>}
            </Button>
          </div>
        </div>
      </section>

      {/* Utility */}
      <section className="bg-card p-6 rounded-lg shadow-sm border border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-brand-500" />
            Concessionária e Padrão
            <InfoTrigger helpKey="concessionaria" />
          </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Concessionária <InfoTrigger helpKey="concessionaria" size={12} /></label>
            <select className={selectClass} value={data.technical.utility} onChange={e => updateTechnical('utility', e.target.value)}>
              {UTILITIES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Identificação ({data.technical.utility === UtilityCompany.LIGHT ? 'Cód. Cliente' : 'Nº UC'})</label>
            <input type="text" className={inputClass} value={data.client.utilityId} onChange={e => updateClient('utilityId', e.target.value)} />
          </div>
        </div>
      </section>

      {/* Client */}
      <section className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <h2 className="text-lg font-semibold text-foreground mb-4">Dados do Cliente</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3">
            <label className={labelClass}>Nome Completo</label>
            <input type="text" className={inputClass} value={data.client.name} onChange={e => updateClient('name', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>CPF / CNPJ</label>
            <input type="text" className={inputClass} value={data.client.document} onChange={e => updateClient('document', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input type="email" className={inputClass} value={data.client.email} onChange={e => updateClient('email', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Nº ART <InfoTrigger helpKey="art" size={12} /></label>
            <input type="text" className={inputClass} value={data.client.art || ''} onChange={e => updateClient('art', e.target.value)} />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className={labelClass}>Logradouro</label>
            <input type="text" className={inputClass} value={data.client.address.street} onChange={e => updateAddress('street', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Número</label>
            <input type="text" className={inputClass} value={data.client.address.number} onChange={e => updateAddress('number', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Bairro</label>
            <input type="text" className={inputClass} value={data.client.address.neighborhood} onChange={e => updateAddress('neighborhood', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Cidade</label>
            <input type="text" className={inputClass} value={data.client.address.city} onChange={e => updateAddress('city', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Estado</label>
            <input type="text" className={inputClass} value={data.client.address.state} onChange={e => updateAddress('state', e.target.value)} />
          </div>
        </div>
      </section>

      {/* Engineer */}
      <section className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <h2 className="text-lg font-semibold text-foreground mb-4">Responsável Técnico</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Nome do Engenheiro</label>
            <input type="text" className={inputClass} value={data.engineer?.name || ''} onChange={e => onChange({ ...data, engineer: { ...data.engineer, name: e.target.value } })} />
          </div>
          <div>
            <label className={labelClass}>Nº CREA</label>
            <input type="text" className={inputClass} value={data.engineer?.crea || ''} onChange={e => onChange({ ...data, engineer: { ...data.engineer, crea: e.target.value } })} />
          </div>
        </div>
      </section>

      {/* Technical */}
      <section className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <h2 className="text-lg font-semibold text-foreground mb-4">Dados Técnicos da Instalação</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className={labelClass}>Tipo Conexão <InfoTrigger helpKey="connectionType" size={12} /></label>
            <select className={selectClass} value={data.technical.connectionType} onChange={e => updateTechnical('connectionType', e.target.value)}>
              {CONNECTION_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Tensão Rede <InfoTrigger helpKey="voltage" size={12} /></label>
            <select className={selectClass} value={data.technical.voltage} onChange={e => updateTechnical('voltage', e.target.value)}>
              {VOLTAGES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Disjuntor Padrão (A) <InfoTrigger helpKey="mainBreaker" size={12} /></label>
            <select className={selectClass} value={data.technical.mainBreaker} onChange={e => updateTechnical('mainBreaker', Number(e.target.value))}>
              {STANDARD_BREAKERS.map(b => <option key={b} value={b}>{b} A</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Distância Padrão (m) <InfoTrigger helpKey="distance" size={12} /></label>
            <input type="number" min="1" className={inputClass} value={data.technical.distance} onChange={e => updateTechnical('distance', Number(e.target.value))} />
          </div>
        </div>
      </section>

      {/* Equipment Blocks */}
      <section className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            Equipamentos e Strings
            <span className={`text-sm px-3 py-1 rounded-full border ${
              engResult.overallStatus === 'SUCCESS' ? 'bg-success/10 text-success border-success/20' :
              engResult.overallStatus === 'WARNING' ? 'bg-warning/10 text-warning border-warning/20' :
              'bg-destructive/10 text-destructive border-destructive/20'
            }`}>
              {engResult.overallStatus === 'SUCCESS' ? 'Aprovado' :
               engResult.overallStatus === 'WARNING' ? 'Atenção' : 'Erro'}
            </span>
          </h2>
          <button onClick={addBlock} className="flex items-center gap-1 px-3 py-2 text-sm font-medium bg-brand-600 text-primary-foreground rounded-md hover:bg-brand-700 transition">
            <Plus size={16} /> Adicionar Conjunto
          </button>
        </div>

        <div className="space-y-4">
          {data.equipmentBlocks.map((block, idx) => (
            <EquipmentBlockForm
              key={block.id}
              block={block}
              blockIndex={idx}
              totalBlocks={data.equipmentBlocks.length}
              engineeringResult={engResult.blocks[idx]}
              modules={modules}
              inverters={inverters}
              onChange={(updated) => updateBlock(idx, updated)}
              onRemove={() => removeBlock(idx)}
            />
          ))}
        </div>

        {/* Global Engineering Summary */}
        <div className={`mt-6 p-4 rounded border ${engResult.overallStatus === 'ERROR' ? 'bg-destructive/5 border-destructive/20' : 'bg-secondary border-border'}`}>
          <h4 className="font-bold text-foreground mb-2">Resumo de Engenharia (Todos os Conjuntos)</h4>
          {engResult.globalWarnings.length > 0 && (
            <div className="space-y-2 mb-3">
              {engResult.globalWarnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-destructive">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
          {engResult.globalWarnings.length === 0 && engResult.overallStatus === 'SUCCESS' && (
            <div className="flex items-center gap-2 text-success text-sm mb-3">
              <CheckCircle size={16} /> Sistema perfeitamente dimensionado.
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm pt-3 border-t border-border">
            <div>
              <span className="block text-muted-foreground">Corrente Total</span>
              <span className="font-mono font-bold">{engResult.totalNominalCurrent.toFixed(1)} A</span>
            </div>
            <div>
              <span className="block text-muted-foreground">Proteção Geral</span>
              <span className="font-mono font-bold text-brand-600">{engResult.totalSuggestedBreaker}A {engResult.totalBreakerPolarity}</span>
            </div>
            <div>
              <span className="block text-muted-foreground">Potência DC Total</span>
              <span className="font-mono font-bold">{engResult.totalDcPower.toFixed(2)} kWp</span>
            </div>
            <div>
              <span className="block text-muted-foreground">Potência AC Total</span>
              <span className="font-mono font-bold">{engResult.totalAcPower.toFixed(2)} kW</span>
            </div>
          </div>
        </div>
      </section>

      {/* AI Justification */}
      <section className="bg-card p-6 rounded-lg shadow-sm border border-border">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand-500" />
            Justificativa Técnica (IA)
            <InfoTrigger helpKey="justification" />
          </h2>
          <Button
            onClick={handleGenerateJustification}
            disabled={justificationLoading}
            className="bg-brand-600 hover:bg-brand-700 text-primary-foreground"
          >
            {justificationLoading ? <><Loader2 size={16} className="animate-spin" /> Gerando...</> : <><Sparkles size={16} /> Gerar com IA</>}
          </Button>
        </div>
        <textarea
          className="w-full min-h-[200px] rounded-md border border-input bg-card text-card-foreground p-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          placeholder="Clique em 'Gerar com IA' para criar uma justificativa técnica baseada nos dados do projeto, ou escreva manualmente..."
          value={justification}
          onChange={e => setJustification(e.target.value)}
        />
        <p className="text-xs text-muted-foreground mt-2">
          O texto gerado é editável. Revise antes de incluir no memorial descritivo.
        </p>
      </section>

      {/* Actions */}
      <div className="flex justify-end pt-4">
        <button
          onClick={() => {
            const hasIssues = engResult.overallStatus !== 'SUCCESS';
            if (hasIssues) {
              setShowWarningModal(true);
            } else {
              onGenerate();
            }
          }}
          className="flex items-center gap-2 px-6 py-3 rounded-md font-bold shadow-lg transition-all bg-primary text-primary-foreground hover:bg-brand-700 hover:shadow-xl"
        >
          <FileText size={20} />
          Gerar Memorial Descritivo (PDF)
        </button>
      </div>

      {/* Warning Modal */}
      <Dialog open={showWarningModal} onOpenChange={setShowWarningModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="w-5 h-5" />
              Divergências Técnicas Encontradas
            </DialogTitle>
            <DialogDescription>
              Deseja prosseguir com a geração mesmo com divergências técnicas?
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-60 overflow-y-auto space-y-2 my-2">
            {engResult.globalWarnings.map((w, i) => (
              <div key={`gw-${i}`} className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 p-2 rounded">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{w}</span>
              </div>
            ))}
            {engResult.blocks.map((block) =>
              block.warnings.map((w, i) => (
                <div key={`b${block.blockId}-${i}`} className="flex items-start gap-2 text-sm text-warning bg-warning/5 p-2 rounded">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  <span>Conjunto {block.blockId}: {w}</span>
                </div>
              ))
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowWarningModal(false)}>
              Corrigir Agora
            </Button>
            <Button
              onClick={() => {
                setShowWarningModal(false);
                onGenerate();
              }}
              className="bg-brand-600 hover:bg-brand-700 text-primary-foreground"
            >
              <FileText size={16} />
              Gerar Documento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
