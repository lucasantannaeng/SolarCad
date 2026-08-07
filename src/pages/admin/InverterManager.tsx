import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, Upload, Copy, Search } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DatasheetImportModal from './DatasheetImportModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface Inverter {
  id: number;
  brand: string;
  model: string;
  power: number;
  max_dc_voltage: number;
  max_input_current: number;
  mppt_min: number;
  mppt_max: number;
  mppt_count: number;
  nominal_output_voltage: number;
  output_phases: number | null;
}

const emptyInverter: Omit<Inverter, 'id'> = {
  brand: '',
  model: '',
  power: 0,
  max_dc_voltage: 0,
  max_input_current: 0,
  mppt_min: 0,
  mppt_max: 0,
  mppt_count: 1,
  nominal_output_voltage: 220,
  output_phases: 1,
};

const InverterManager = () => {
  const [inverters, setInverters] = useState<Inverter[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [inverterDialogOpen, setInverterDialogOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit' | 'duplicate'>('create');
  const [editingInverter, setEditingInverter] = useState<Inverter | null>(null);
  const [inverterForm, setInverterForm] = useState<Omit<Inverter, 'id'>>(emptyInverter);
  const [savingInverter, setSavingInverter] = useState(false);
  const [deleteInverterId, setDeleteInverterId] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [minPower, setMinPower] = useState<number | ''>('');
  const [maxPower, setMaxPower] = useState<number | ''>('');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');

  const filteredInverters = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return inverters.filter((i) => {
      if (term && !`${i.brand} ${i.model}`.toLowerCase().includes(term)) return false;
      if (minPower !== '' && i.power < Number(minPower)) return false;
      if (maxPower !== '' && i.power > Number(maxPower)) return false;
      if (phaseFilter !== 'all' && Number(i.output_phases || 1) !== Number(phaseFilter)) return false;
      return true;
    });
  }, [inverters, searchTerm, minPower, maxPower, phaseFilter]);

  const hasFilters =
    searchTerm !== '' || minPower !== '' || maxPower !== '' || phaseFilter !== 'all';
  const clearFilters = () => {
    setSearchTerm('');
    setMinPower('');
    setMaxPower('');
    setPhaseFilter('all');
  };

  const fetchInverters = async () => {
    setLoadingData(true);
    try {
      const { data, error } = await supabase.from('inverters').select('*').order('brand');
      if (error) throw error;
      setInverters(data || []);
    } catch (err) {
      console.error('Fetch inverters error:', err);
      toast.error('Erro ao carregar inversores. Tente novamente.');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchInverters();
  }, []);

  const openInverterDialog = (inv?: Inverter, nextMode: 'create' | 'edit' | 'duplicate' = 'create') => {
    setMode(nextMode);
    if (inv && nextMode !== 'create') {
      setEditingInverter(nextMode === 'edit' ? inv : null);
      setInverterForm({
        brand: inv.brand,
        model: nextMode === 'duplicate' ? `${inv.model} (cópia)` : inv.model,
        power: inv.power,
        max_dc_voltage: inv.max_dc_voltage,
        max_input_current: inv.max_input_current,
        mppt_min: inv.mppt_min,
        mppt_max: inv.mppt_max,
        mppt_count: inv.mppt_count,
        nominal_output_voltage: inv.nominal_output_voltage,
        output_phases: inv.output_phases,
      });
    } else {
      setEditingInverter(null);
      setInverterForm(emptyInverter);
    }
    setInverterDialogOpen(true);
  };

  const saveInverter = async () => {
    if (!inverterForm.brand.trim() || !inverterForm.model.trim()) {
      toast.error('Marca e modelo são obrigatórios.');
      return;
    }
    const numericFields: Array<[string, number]> = [
      ['Potência', inverterForm.power],
      ['Tensão DC Máxima', inverterForm.max_dc_voltage],
      ['Corrente Máxima de Entrada', inverterForm.max_input_current],
      ['MPPT Mínimo', inverterForm.mppt_min],
      ['MPPT Máximo', inverterForm.mppt_max],
      ['Quantidade de MPPTs', inverterForm.mppt_count],
      ['Tensão Nominal de Saída', inverterForm.nominal_output_voltage],
    ];
    const invalid = numericFields.find(([, v]) => !(v > 0));
    if (invalid) {
      toast.error(`Valor inválido em "${invalid[0]}": deve ser maior que zero.`);
      return;
    }
    if (inverterForm.mppt_max <= inverterForm.mppt_min) {
      toast.error('MPPT Máximo deve ser maior que MPPT Mínimo.');
      return;
    }

    setSavingInverter(true);
    try {
      const payload = {
        ...inverterForm,
        brand: inverterForm.brand.trim(),
        model: inverterForm.model.trim(),
      };
      if (mode === 'edit' && editingInverter) {
        const { error } = await supabase.from('inverters').update(payload).eq('id', editingInverter.id);
        if (error) throw error;
        toast.success('Equipamento atualizado!');
      } else {
        const { error } = await supabase.from('inverters').insert(payload);
        if (error) throw error;
        toast.success(mode === 'duplicate' ? 'Equipamento duplicado!' : 'Inversor adicionado!');
      }
      setInverterDialogOpen(false);
      fetchInverters();
    } catch (err) {
      console.error('Save inverter error:', err);
      toast.error('Erro ao salvar inversor. Tente novamente.');
    } finally {
      setSavingInverter(false);
    }
  };

  const confirmDeleteInverter = async () => {
    if (!deleteInverterId) return;
    try {
      const { error } = await supabase.from('inverters').delete().eq('id', deleteInverterId);
      if (error) throw error;
      toast.success('Inversor excluído!');
      fetchInverters();
    } catch (err) {
      console.error('Delete inverter error:', err);
      toast.error('Erro ao excluir inversor. Tente novamente.');
    } finally {
      setDeleteInverterId(null);
    }
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end gap-2 mb-4">
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="w-4 h-4 mr-2" /> Importar PDF
        </Button>
        <Button onClick={() => openInverterDialog()}>
          <Plus className="w-4 h-4 mr-2" /> Adicionar Inversor
        </Button>
      </div>
      <DatasheetImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        kind="inverter"
        onImported={fetchInverters}
      />
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por marca ou modelo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Input
          type="number"
          placeholder="Pot. mín (kW)"
          value={minPower}
          onChange={(e) => setMinPower(e.target.value === '' ? '' : Number(e.target.value))}
          className="w-36"
        />
        <Input
          type="number"
          placeholder="Pot. máx (kW)"
          value={maxPower}
          onChange={(e) => setMaxPower(e.target.value === '' ? '' : Number(e.target.value))}
          className="w-36"
        />
        <Select value={phaseFilter} onValueChange={setPhaseFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Fases de saída" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as fases</SelectItem>
            <SelectItem value="1">1 - Monofásico</SelectItem>
            <SelectItem value="2">2 - Bifásico</SelectItem>
            <SelectItem value="3">3 - Trifásico</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" onClick={clearFilters}>Limpar Filtros</Button>
        )}
      </div>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Marca</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead className="text-right">Potência (kW)</TableHead>
              <TableHead className="text-right">Vdc Max</TableHead>
              <TableHead className="text-right">Idc Max</TableHead>
              <TableHead className="text-right">MPPT Min</TableHead>
              <TableHead className="text-right">MPPT Max</TableHead>
              <TableHead className="text-right">MPPTs</TableHead>
              <TableHead className="text-right">Vac</TableHead>
              <TableHead className="text-right">Fases</TableHead>
              <TableHead className="w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInverters.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">{inv.brand}</TableCell>
                <TableCell>{inv.model}</TableCell>
                <TableCell className="text-right">{inv.power}</TableCell>
                <TableCell className="text-right">{inv.max_dc_voltage}</TableCell>
                <TableCell className="text-right">{inv.max_input_current}</TableCell>
                <TableCell className="text-right">{inv.mppt_min}</TableCell>
                <TableCell className="text-right">{inv.mppt_max}</TableCell>
                <TableCell className="text-right">{inv.mppt_count}</TableCell>
                <TableCell className="text-right">{inv.nominal_output_voltage}</TableCell>
                <TableCell className="text-right">{inv.output_phases || 1}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" title="Editar" onClick={() => openInverterDialog(inv, 'edit')}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Duplicar" onClick={() => openInverterDialog(inv, 'duplicate')}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Excluir" onClick={() => setDeleteInverterId(inv.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredInverters.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                  {inverters.length === 0 ? (
                    'Nenhum inversor cadastrado.'
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <span>Nenhum equipamento encontrado com estes filtros.</span>
                      <Button variant="outline" size="sm" onClick={clearFilters}>Limpar Filtros</Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={inverterDialogOpen} onOpenChange={setInverterDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{mode === 'edit' ? 'Editar Inversor' : mode === 'duplicate' ? 'Duplicar Inversor' : 'Novo Inversor'}</DialogTitle>
            <DialogDescription>Preencha os dados técnicos do inversor.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="inv-brand">Marca</Label>
                <Input id="inv-brand" value={inverterForm.brand} onChange={(e) => setInverterForm({ ...inverterForm, brand: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-model">Modelo</Label>
                <Input id="inv-model" value={inverterForm.model} onChange={(e) => setInverterForm({ ...inverterForm, model: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="inv-power">Potência (kW)</Label>
                <Input id="inv-power" type="number" step="0.1" value={inverterForm.power} onChange={(e) => setInverterForm({ ...inverterForm, power: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-vdc">Vdc Max (V)</Label>
                <Input id="inv-vdc" type="number" value={inverterForm.max_dc_voltage} onChange={(e) => setInverterForm({ ...inverterForm, max_dc_voltage: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-idc">Idc Max (A)</Label>
                <Input id="inv-idc" type="number" step="0.1" value={inverterForm.max_input_current} onChange={(e) => setInverterForm({ ...inverterForm, max_input_current: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="inv-mppt-min">MPPT Min (V)</Label>
                <Input id="inv-mppt-min" type="number" value={inverterForm.mppt_min} onChange={(e) => setInverterForm({ ...inverterForm, mppt_min: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-mppt-max">MPPT Max (V)</Label>
                <Input id="inv-mppt-max" type="number" value={inverterForm.mppt_max} onChange={(e) => setInverterForm({ ...inverterForm, mppt_max: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-mppt-count">Nº MPPTs</Label>
                <Input id="inv-mppt-count" type="number" value={inverterForm.mppt_count} onChange={(e) => setInverterForm({ ...inverterForm, mppt_count: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="inv-vac">Tensão AC (V)</Label>
                <Input id="inv-vac" type="number" value={inverterForm.nominal_output_voltage} onChange={(e) => setInverterForm({ ...inverterForm, nominal_output_voltage: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inv-phases">Fases de Saída</Label>
                <Input id="inv-phases" type="number" min={1} max={3} value={inverterForm.output_phases || 1} onChange={(e) => setInverterForm({ ...inverterForm, output_phases: Number(e.target.value) })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInverterDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveInverter} disabled={savingInverter}>
              {savingInverter && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteInverterId} onOpenChange={() => setDeleteInverterId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este inversor? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteInverter} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default InverterManager;
