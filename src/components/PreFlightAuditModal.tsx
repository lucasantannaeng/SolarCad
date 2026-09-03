import React, { useState } from 'react';
import { ProjectState } from '@/types';
import { validateProjectPreFlight, PreFlightAuditResult, PreFlightCheckItem } from '@/services/preFlightValidator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  FileCheck,
  Zap,
  Cable,
  Flame,
  Building2,
  FileSpreadsheet,
  Layers,
} from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectState;
  onProceedAnyway?: () => void;
}

export const PreFlightAuditModal: React.FC<Props> = ({ open, onOpenChange, project, onProceedAnyway }) => {
  const [filter, setFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'PASS'>('ALL');

  const audit = validateProjectPreFlight(project);

  const filteredItems = audit.items.filter(item => {
    if (filter === 'CRITICAL') return item.status === 'critical';
    if (filter === 'WARNING') return item.status === 'warning';
    if (filter === 'PASS') return item.status === 'pass';
    return true;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'ELECTRICAL':
        return <Zap className="w-4 h-4 text-amber-500" />;
      case 'CABLING':
        return <Cable className="w-4 h-4 text-blue-500" />;
      case 'SAFETY':
        return <Flame className="w-4 h-4 text-orange-500" />;
      case 'GRID_COMPLIANCE':
        return <Building2 className="w-4 h-4 text-purple-500" />;
      case 'RATEIO':
        return <FileSpreadsheet className="w-4 h-4 text-emerald-500" />;
      case 'DOCUMENTATION':
      default:
        return <FileCheck className="w-4 h-4 text-brand-500" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between flex-wrap gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
              <ShieldCheck className="w-6 h-6 text-brand-500" />
              Validador Pré-Protocolo (Checklist Anti-Exigência)
            </DialogTitle>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                audit.overallStatus === 'pass'
                  ? 'bg-success/15 text-success border-success/30'
                  : audit.overallStatus === 'warning'
                  ? 'bg-warning/15 text-warning border-warning/30'
                  : 'bg-destructive/15 text-destructive border-destructive/30'
              }`}>
                {audit.overallStatus === 'pass' ? '100% CONFORME' : audit.overallStatus === 'warning' ? 'APTO COM ALERTAS' : 'CRÍTICO / NÃO-CONFORME'}
              </span>
              <span className="text-xs font-mono font-bold bg-muted px-2 py-1 rounded border border-border">
                Score: {audit.score}%
              </span>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Auditoria técnica automatizada contra as exigências das concessionárias (Light RECON-BT, Enel CNC-GD, Energisa NDU-013, Cerci e REN ANEEL 1.000/2021).
          </DialogDescription>
        </DialogHeader>

        {/* Status Banner */}
        <div className={`p-4 rounded-lg border text-xs space-y-1.5 ${
          audit.canProtocol
            ? audit.overallStatus === 'pass'
              ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200'
              : 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-900 dark:text-amber-200'
            : 'bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 text-red-900 dark:text-red-200'
        }`}>
          <div className="flex items-center gap-2 font-bold text-sm">
            {audit.canProtocol ? (
              <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-destructive shrink-0" />
            )}
            <span>{audit.canProtocol ? 'Projeto Apto para Solicitação de Acesso' : 'Protocolo Bloqueado — Exigências Críticas Detectadas'}</span>
          </div>
          <p className="text-xs opacity-90">{audit.summary}</p>
        </div>

        {/* Filter Badges */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1 rounded-full border transition-all ${
              filter === 'ALL' ? 'bg-foreground text-background font-bold' : 'bg-card text-muted-foreground hover:bg-muted'
            }`}
          >
            Todos ({audit.totalChecks})
          </button>
          <button
            onClick={() => setFilter('CRITICAL')}
            className={`px-3 py-1 rounded-full border transition-all ${
              filter === 'CRITICAL' ? 'bg-destructive text-white font-bold' : 'bg-card text-destructive hover:bg-destructive/10'
            }`}
          >
            Críticos ({audit.criticalChecks})
          </button>
          <button
            onClick={() => setFilter('WARNING')}
            className={`px-3 py-1 rounded-full border transition-all ${
              filter === 'WARNING' ? 'bg-amber-500 text-white font-bold' : 'bg-card text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            Avisos ({audit.warningChecks})
          </button>
          <button
            onClick={() => setFilter('PASS')}
            className={`px-3 py-1 rounded-full border transition-all ${
              filter === 'PASS' ? 'bg-emerald-600 text-white font-bold' : 'bg-card text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
            }`}
          >
            Conformes ({audit.passedChecks})
          </button>
        </div>

        {/* Audit Items List */}
        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`p-3.5 rounded-lg border transition-all ${
                item.status === 'critical'
                  ? 'bg-red-50/30 dark:bg-red-950/15 border-red-200 dark:border-red-900/40'
                  : item.status === 'warning'
                  ? 'bg-amber-50/30 dark:bg-amber-950/15 border-amber-200 dark:border-amber-900/40'
                  : 'bg-card border-border'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-1">
                  {getCategoryIcon(item.category)}
                  <span className="font-bold text-sm text-foreground">{item.title}</span>
                  {item.normativeRef && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono hidden sm:inline">
                      {item.normativeRef}
                    </span>
                  )}
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wider shrink-0 ${
                  item.status === 'critical'
                    ? 'bg-destructive/15 text-destructive'
                    : item.status === 'warning'
                    ? 'bg-warning/20 text-warning'
                    : 'bg-success/15 text-success'
                }`}>
                  {item.status === 'critical' ? 'CRÍTICO' : item.status === 'warning' ? 'ALERTA' : 'CONFORME'}
                </span>
              </div>

              <p className="text-xs text-foreground/90 mt-1.5 leading-relaxed">{item.details}</p>

              {item.recommendation && (
                <div className="mt-2 p-2 rounded bg-muted/70 text-xs text-muted-foreground border-l-2 border-brand-500 space-y-0.5">
                  <span className="font-bold text-foreground text-[11px] block">Ação Recomendada:</span>
                  <span>{item.recommendation}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between w-full flex-wrap gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {onProceedAnyway && (
            <Button
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onProceedAnyway();
              }}
              className="bg-brand-600 hover:bg-brand-700 text-white"
            >
              Prosseguir com Geração de Documentos
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
