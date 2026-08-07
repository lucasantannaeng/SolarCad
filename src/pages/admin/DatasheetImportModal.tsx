import { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Upload, FileText, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Kind = 'module' | 'inverter';
type Step = 'upload' | 'loading' | 'review' | 'saving';

interface ExtractedModule {
  brand: string;
  model: string;
  power: number;
  voc: number;
  isc: number;
  vmp: number;
  imp: number;
}

interface ExtractedInverter {
  brand: string;
  model: string;
  power: number;
  max_dc_voltage: number;
  mppt_min: number;
  mppt_max: number;
  max_input_current: number;
  mppt_count: number;
  nominal_output_voltage: number;
  output_phases: number;
}

interface ApiResult {
  type: 'inverter' | 'module' | 'mixed';
  extractedInverters: ExtractedInverter[];
  extractedModules: ExtractedModule[];
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: Kind;
  onImported: () => void;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const MODULE_FIELDS: Array<{ key: keyof ExtractedModule; label: string; numeric: boolean }> = [
  { key: 'brand', label: 'Marca', numeric: false },
  { key: 'model', label: 'Modelo', numeric: false },
  { key: 'power', label: 'Pot (W)', numeric: true },
  { key: 'voc', label: 'Voc', numeric: true },
  { key: 'isc', label: 'Isc', numeric: true },
  { key: 'vmp', label: 'Vmp', numeric: true },
  { key: 'imp', label: 'Imp', numeric: true },
];

const INVERTER_FIELDS: Array<{ key: keyof ExtractedInverter; label: string; numeric: boolean }> = [
  { key: 'brand', label: 'Marca', numeric: false },
  { key: 'model', label: 'Modelo', numeric: false },
  { key: 'power', label: 'Pot (kW)', numeric: true },
  { key: 'max_dc_voltage', label: 'Vdc max', numeric: true },
  { key: 'max_input_current', label: 'Idc max', numeric: true },
  { key: 'mppt_min', label: 'MPPT min', numeric: true },
  { key: 'mppt_max', label: 'MPPT max', numeric: true },
  { key: 'mppt_count', label: 'Nº MPPTs', numeric: true },
  { key: 'nominal_output_voltage', label: 'Vac', numeric: true },
  { key: 'output_phases', label: 'Fases', numeric: true },
];

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const DatasheetImportModal = ({ open, onOpenChange, kind, onImported }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [modules, setModules] = useState<ExtractedModule[]>([]);
  const [inverters, setInverters] = useState<ExtractedInverter[]>([]);
  const [selectedModules, setSelectedModules] = useState<Set<number>>(new Set());
  const [selectedInverters, setSelectedInverters] = useState<Set<number>>(new Set());
  const [editingModuleIdx, setEditingModuleIdx] = useState<number | null>(null);
  const [editingInverterIdx, setEditingInverterIdx] = useState<number | null>(null);

  const reset = () => {
    setStep('upload');
    setFile(null);
    setModules([]);
    setInverters([]);
    setSelectedModules(new Set());
    setSelectedInverters(new Set());
    setEditingModuleIdx(null);
    setEditingInverterIdx(null);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Apenas arquivos PDF são aceitos.');
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      toast.error('O PDF deve ter no máximo 10 MB.');
      return;
    }
    setFile(f);
  };

  const analyze = async () => {
    if (!file) return;
    setStep('loading');
    try {
      const fileBase64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke('process-datasheet', {
        body: { fileBase64, fileName: file.name, hint: kind },
      });
      if (error) {
        const msg = (error as { message?: string })?.message || 'Falha ao processar o datasheet.';
        toast.error(msg);
        setStep('upload');
        return;
      }
      const result = data as ApiResult;
      setModules(result.extractedModules || []);
      setInverters(result.extractedInverters || []);
      if (kind === 'module') {
        setSelectedModules(new Set((result.extractedModules || []).map((_, i) => i)));
      } else {
        setSelectedInverters(new Set((result.extractedInverters || []).map((_, i) => i)));
      }
      setStep('review');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar o PDF.');
      setStep('upload');
    }
  };

  const toggleSel = (set: Set<number>, idx: number, setter: (s: Set<number>) => void) => {
    const next = new Set(set);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setter(next);
  };

  const updateModule = (idx: number, key: keyof ExtractedModule, value: string) => {
    setModules((prev) =>
      prev.map((m, i) =>
        i === idx ? { ...m, [key]: typeof m[key] === 'number' ? Number(value) : value } : m
      )
    );
  };

  const updateInverter = (idx: number, key: keyof ExtractedInverter, value: string) => {
    setInverters((prev) =>
      prev.map((m, i) =>
        i === idx ? { ...m, [key]: typeof m[key] === 'number' ? Number(value) : value } : m
      )
    );
  };

  const validateModule = (m: ExtractedModule, idx: number): string | null => {
    if (!m.brand.trim() || !m.model.trim())
      return `Módulo #${idx + 1}: marca e modelo obrigatórios.`;
    for (const f of ['power', 'voc', 'isc', 'vmp', 'imp'] as const) {
      if (!(Number(m[f]) > 0)) return `Módulo #${idx + 1}: campo "${f}" deve ser > 0.`;
    }
    return null;
  };

  const validateInverter = (inv: ExtractedInverter, idx: number): string | null => {
    if (!inv.brand.trim() || !inv.model.trim())
      return `Inversor #${idx + 1}: marca e modelo obrigatórios.`;
    for (const f of [
      'power',
      'max_dc_voltage',
      'max_input_current',
      'mppt_min',
      'mppt_max',
      'mppt_count',
      'nominal_output_voltage',
    ] as const) {
      if (!(Number(inv[f]) > 0)) return `Inversor #${idx + 1}: campo "${f}" deve ser > 0.`;
    }
    if (inv.mppt_max <= inv.mppt_min)
      return `Inversor #${idx + 1}: MPPT max deve ser > MPPT min.`;
    if (![1, 2, 3].includes(Number(inv.output_phases)))
      return `Inversor #${idx + 1}: fases deve ser 1, 2 ou 3.`;
    return null;
  };

  const saveSelected = async () => {
    const modIndices = Array.from(selectedModules);
    const invIndices = Array.from(selectedInverters);
    const selModules = modIndices.map((i) => modules[i]);
    const selInverters = invIndices.map((i) => inverters[i]);

    if (selModules.length === 0 && selInverters.length === 0) {
      toast.error('Selecione ao menos um item para importar.');
      return;
    }
    for (let i = 0; i < selModules.length; i++) {
      const err = validateModule(selModules[i], modIndices[i]);
      if (err) {
        toast.error(err);
        return;
      }
    }
    for (let i = 0; i < selInverters.length; i++) {
      const err = validateInverter(selInverters[i], invIndices[i]);
      if (err) {
        toast.error(err);
        return;
      }
    }

    setStep('saving');
    try {
      if (selModules.length > 0) {
        const modulesToSave = selModules.map((mod) => ({
          brand: String(mod.brand).trim(),
          model: String(mod.model).trim(),
          power: Number(mod.power),
          voc: Number(mod.voc),
          isc: Number(mod.isc),
          vmp: Number(mod.vmp),
          imp: Number(mod.imp),
        }));
        const { error } = await supabase.from('modules').insert(modulesToSave);
        if (error) {
          console.error('Erro detalhado do Supabase (modules):', error);
          toast.error(`Erro ao salvar módulos: ${error.message || error.details}`);
          setStep('review');
          return;
        }
      }
      if (selInverters.length > 0) {
        const invertersToSave = selInverters.map((inv) => ({
          brand: String(inv.brand).trim(),
          model: String(inv.model).trim(),
          power: Number(inv.power),
          max_dc_voltage: Number(inv.max_dc_voltage),
          mppt_min: Number(inv.mppt_min),
          mppt_max: Number(inv.mppt_max),
          max_input_current: Number(inv.max_input_current),
          mppt_count: Number(inv.mppt_count),
          nominal_output_voltage: Number(inv.nominal_output_voltage),
          output_phases: Number(inv.output_phases),
        }));
        const { error } = await supabase.from('inverters').insert(invertersToSave);
        if (error) {
          console.error('Erro detalhado do Supabase (inverters):', error);
          toast.error(`Erro ao salvar inversores: ${error.message || error.details}`);
          setStep('review');
          return;
        }
      }
      toast.success(
        `Importação concluída: ${selModules.length} módulo(s), ${selInverters.length} inversor(es).`
      );
      onImported();
      handleClose(false);
    } catch (err) {
      const e = err as { message?: string; details?: string };
      console.error('Bulk insert error:', err);
      toast.error(`Erro ao salvar: ${e?.message || e?.details || 'verifique os dados.'}`);
      setStep('review');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Importar Datasheet (PDF)</DialogTitle>
          <DialogDescription>
            Envie um datasheet em PDF para extrair automaticamente as especificações via IA.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="py-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFile(e.dataTransfer.files?.[0] || null);
              }}
              onClick={() => inputRef.current?.click()}
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-10 cursor-pointer transition ${
                dragOver ? 'border-primary bg-primary/5' : 'border-muted'
              }`}
            >
              <Upload className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Arraste o PDF aqui ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground mt-1">Máx 10 MB · somente .pdf</p>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
              />
            </div>
            {file && (
              <div className="flex items-center gap-2 mt-3 text-sm">
                <FileText className="w-4 h-4" />
                <span className="font-medium">{file.name}</span>
                <span className="text-muted-foreground">
                  ({(file.size / 1024).toFixed(0)} KB)
                </span>
              </div>
            )}
          </div>
        )}

        {step === 'loading' && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Extraindo especificações com IA…</p>
          </div>
        )}

        {(step === 'review' || step === 'saving') && (
          <div className="py-2 max-h-[60vh] overflow-y-auto space-y-6">
            {modules.length > 0 && (
              <ReviewTable<ExtractedModule>
                title="Módulos detectados"
                items={modules}
                fields={MODULE_FIELDS}
                selected={selectedModules}
                onToggle={(i) => toggleSel(selectedModules, i, setSelectedModules)}
                editingIdx={editingModuleIdx}
                setEditingIdx={setEditingModuleIdx}
                onUpdate={updateModule}
              />
            )}
            {inverters.length > 0 && (
              <ReviewTable<ExtractedInverter>
                title="Inversores detectados"
                items={inverters}
                fields={INVERTER_FIELDS}
                selected={selectedInverters}
                onToggle={(i) => toggleSel(selectedInverters, i, setSelectedInverters)}
                editingIdx={editingInverterIdx}
                setEditingIdx={setEditingInverterIdx}
                onUpdate={updateInverter}
              />
            )}
            {modules.length === 0 && inverters.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma especificação foi detectada no PDF.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancelar
              </Button>
              <Button onClick={analyze} disabled={!file}>
                Analisar PDF
              </Button>
            </>
          )}
          {step === 'review' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Voltar
              </Button>
              <Button onClick={saveSelected}>
                Salvar Selecionados ({selectedModules.size + selectedInverters.size})
              </Button>
            </>
          )}
          {step === 'saving' && (
            <Button disabled>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando…
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface ReviewTableProps<T> {
  title: string;
  items: T[];
  fields: Array<{ key: keyof T; label: string; numeric: boolean }>;
  selected: Set<number>;
  onToggle: (idx: number) => void;
  editingIdx: number | null;
  setEditingIdx: (i: number | null) => void;
  onUpdate: (idx: number, key: keyof T, value: string) => void;
}

function ReviewTable<T>({
  title,
  items,
  fields,
  selected,
  onToggle,
  editingIdx,
  setEditingIdx,
  onUpdate,
}: ReviewTableProps<T>) {
  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">{title}</h4>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              {fields.map((f) => (
                <TableHead key={String(f.key)} className={f.numeric ? 'text-right' : ''}>
                  {f.label}
                </TableHead>
              ))}
              <TableHead className="w-20">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, idx) => {
              const isEditing = editingIdx === idx;
              return (
                <TableRow key={idx} data-state={selected.has(idx) ? 'selected' : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(idx)}
                      onCheckedChange={() => onToggle(idx)}
                    />
                  </TableCell>
                  {fields.map((f) => (
                    <TableCell key={String(f.key)} className={f.numeric ? 'text-right' : ''}>
                      {isEditing ? (
                        <Input
                          type={f.numeric ? 'number' : 'text'}
                          value={String(item[f.key] ?? '')}
                          onChange={(e) => onUpdate(idx, f.key, e.target.value)}
                          onBlur={() => setEditingIdx(null)}
                          className="h-8"
                          step={f.numeric ? '0.01' : undefined}
                        />
                      ) : (
                        <span className="text-sm">{String(item[f.key] ?? '')}</span>
                      )}
                    </TableCell>
                  ))}
                  <TableCell>
                    {isEditing ? (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setEditingIdx(null)}
                        >
                          <Check className="w-4 h-4 text-primary" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => setEditingIdx(null)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setEditingIdx(idx)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default DatasheetImportModal;
