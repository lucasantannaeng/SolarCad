import React, { useState } from 'react';
import { ProjectState } from '@/types';
import { generateArtGuide, copyArtTextToClipboard, ArtField } from '@/services/artGuideService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Check, FileText, CheckCircle2, Award, Zap, Building } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectState;
}

export const ArtGuideModal: React.FC<Props> = ({ open, onOpenChange, project }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'crea' | 'cft' | 'fields' | 'full'>('crea');

  const guide = generateArtGuide(project);

  const handleCopy = async (fieldId: string, value: string, label: string) => {
    const success = await copyArtTextToClipboard(value);
    if (success) {
      setCopiedField(fieldId);
      toast.success(`${label} copiado para a área de transferência!`);
      setTimeout(() => setCopiedField(null), 2000);
    } else {
      toast.error('Não foi possível copiar automaticamente.');
    }
  };

  const handleCopyAll = async () => {
    const success = await copyArtTextToClipboard(guide.fullReportText);
    if (success) {
      toast.success('Relatório completo da ART/TRT copiado!');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between flex-wrap gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
              <Award className="w-6 h-6 text-brand-500" />
              Guia Rápido de Preenchimento de ART / TRT
            </DialogTitle>
            <Button
              size="sm"
              onClick={handleCopyAll}
              className="bg-brand-600 hover:bg-brand-700 text-primary-foreground text-xs font-semibold gap-1.5 shadow-sm"
            >
              <Copy size={14} /> Copiar Relatório Completo
            </Button>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Atividades técnicas oficiais CONFEA/CREA e CFT/CRT para preenchimento ágil nos portais Glic (CREA) e SITAC (CFT).
          </DialogDescription>
        </DialogHeader>

        {/* Resumo da Usina Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-lg bg-muted/50 border border-border text-xs">
          <div>
            <span className="text-muted-foreground block text-[11px]">Potência CC (Módulos):</span>
            <span className="font-mono font-bold text-brand-600 dark:text-brand-400 text-sm">{guide.totalDcPowerKwp.toFixed(2)} kWp</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Potência CA (Inversores):</span>
            <span className="font-mono font-bold text-foreground text-sm">{guide.totalAcPowerKw.toFixed(2)} kW</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Geração Estimada:</span>
            <span className="font-mono font-bold text-foreground text-sm">{guide.estimatedMonthlyGenKwh} kWh/mês</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Conselho Alvo:</span>
            <span className="font-bold text-brand-600 dark:text-brand-400 text-sm">{guide.councilType}</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-border pb-2 text-xs font-medium">
          <button
            onClick={() => setActiveTab('crea')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'crea' ? 'bg-brand-600 text-white font-bold' : 'hover:bg-muted text-muted-foreground'
            }`}
          >
            🏛️ CREA / CONFEA (Glic)
          </button>
          <button
            onClick={() => setActiveTab('cft')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'cft' ? 'bg-brand-600 text-white font-bold' : 'hover:bg-muted text-muted-foreground'
            }`}
          >
            📐 CFT / CRT (SITAC)
          </button>
          <button
            onClick={() => setActiveTab('fields')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'fields' ? 'bg-brand-600 text-white font-bold' : 'hover:bg-muted text-muted-foreground'
            }`}
          >
            📋 Todos os Campos (1-Clique)
          </button>
          <button
            onClick={() => setActiveTab('full')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'full' ? 'bg-brand-600 text-white font-bold' : 'hover:bg-muted text-muted-foreground'
            }`}
          >
            📄 Texto do Objeto / Contrato
          </button>
        </div>

        {/* TAB 1: CREA / CONFEA */}
        {activeTab === 'crea' && (
          <div className="space-y-4 text-sm">
            <div className="p-3 rounded-md bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-300">
              <span className="font-bold block mb-1">Passo a Passo no Portal CREA (Glic / ART Web):</span>
              1. Selecione o Tipo de ART: <strong>Obra ou Serviço</strong>.<br />
              2. Adicione as 2 atividades técnicas discriminadas abaixo com unidade em <strong>kWp</strong>.<br />
              3. Cole a descrição técnica oficial no campo <strong>Objeto do Contrato</strong>.
            </div>

            <div className="space-y-2.5">
              {guide.confeaActivities.map((act, i) => (
                <div key={i} className="p-3 rounded-lg border border-border bg-card flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs bg-brand-500/10 text-brand-600 dark:text-brand-400 px-2 py-0.5 rounded">
                        {act.code}
                      </span>
                      <span className="font-bold text-foreground text-sm">{act.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{act.description}</p>
                    <div className="text-xs text-foreground/80 font-mono">
                      Nível: <strong>{act.level}</strong> | Quantidade: <strong>{act.quantity} {act.unit}</strong>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(`confea_${i}`, `${act.code} - ${act.name} (Qtd: ${act.quantity} ${act.unit})`, act.name)}
                    className="shrink-0 text-xs gap-1"
                  >
                    {copiedField === `confea_${i}` ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                    Copiar
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: CFT / CRT */}
        {activeTab === 'cft' && (
          <div className="space-y-4 text-sm">
            <div className="p-3 rounded-md bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-xs text-emerald-900 dark:text-emerald-300">
              <span className="font-bold block mb-1">Passo a Passo no Portal CFT (SITAC / TRT Web):</span>
              1. Selecione o Tipo de TRT: <strong>Obra / Serviço</strong>.<br />
              2. Grupo: <strong>Eletrotécnica</strong> | Atividades: <strong>Projeto</strong> e <strong>Execução</strong> (Resolução CFT nº 074/2019).<br />
              3. Informe a quantidade em <strong>{guide.totalDcPowerKwp.toFixed(2)} kWp</strong> e cole o texto do objeto.
            </div>

            <div className="space-y-2.5">
              {guide.cftActivities.map((act, i) => (
                <div key={i} className="p-3 rounded-lg border border-border bg-card flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded">
                        {act.code}
                      </span>
                      <span className="font-bold text-foreground text-sm">{act.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{act.description}</p>
                    <div className="text-xs text-foreground/80 font-mono">
                      Nível: <strong>{act.level}</strong> | Quantidade: <strong>{act.quantity} {act.unit}</strong>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(`cft_${i}`, `${act.name} (${act.quantity} ${act.unit})`, act.name)}
                    className="shrink-0 text-xs gap-1"
                  >
                    {copiedField === `cft_${i}` ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                    Copiar
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: TODOS OS CAMPOS */}
        {activeTab === 'fields' && (
          <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
            {guide.fields.map((f) => (
              <div key={f.id} className="p-2.5 rounded-lg border border-border bg-card flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase block">{f.label}</span>
                  <span className="text-xs font-mono font-bold text-foreground truncate block">{f.value || '-'}</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopy(f.id, f.value, f.label)}
                  className="shrink-0 h-8 px-2.5 text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400"
                  title={`Copiar ${f.label}`}
                >
                  {copiedField === f.id ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: TEXTO DO OBJETO */}
        {activeTab === 'full' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Texto Oficial para o Campo "Objeto / Descrição do Contrato":</span>
              <Button
                size="sm"
                onClick={() => handleCopy('desc_full', guide.technicalDescription, 'Descrição do Objeto')}
                className="bg-brand-600 hover:bg-brand-700 text-white text-xs gap-1.5"
              >
                {copiedField === 'desc_full' ? <Check size={14} /> : <Copy size={14} />}
                Copiar Descrição
              </Button>
            </div>
            <textarea
              readOnly
              rows={10}
              value={guide.technicalDescription}
              className="w-full text-xs font-mono p-3 rounded-lg border border-input bg-muted/40 text-foreground focus:outline-none"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
