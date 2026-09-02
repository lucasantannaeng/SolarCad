import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, Upload, Copy, Search } from 'lucide-react';
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

export interface Module {
  id: number;
  brand: string;
  model: string;
  power: number;
  voc: number;
  isc: number;
  vmp: number;
  imp: number;
}

const emptyModule: Omit<Module, 'id'> = {
  brand: '',
  model: '',
  power: 0,
  voc: 0,
  isc: 0,
  vmp: 0,
  imp: 0,
};

const ModuleManager = () => {
  const [modules, setModules] = useState<Module[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit' | 'duplicate'>('create');
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [moduleForm, setModuleForm] = useState<Omit<Module, 'id'>>(emptyModule);
  const [savingModule, setSavingModule] = useState(false);
  const [deleteModuleId, setDeleteModuleId] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [minPower, setMinPower] = useState<number | ''>('');
  const [maxPower, setMaxPower] = useState<number | ''>('');

  const filteredModules = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return modules.filter((m) => {
      if (term && !`${m.brand} ${m.model}`.toLowerCase().includes(term)) return false;
      if (minPower !== '' && m.power < Number(minPower)) return false;
      if (maxPower !== '' && m.power > Number(maxPower)) return false;
      return true;
    });
  }, [modules, searchTerm, minPower, maxPower]);

  const hasFilters = searchTerm !== '' || minPower !== '' || maxPower !== '';
  const clearFilters = () => {
    setSearchTerm('');
    setMinPower('');
    setMaxPower('');
  };

  const fetchModules = async () => {
    setLoadingData(true);
    try {
      const { data, error } = await supabase.from('modules').select('*').order('brand');
      if (error) throw error;
      setModules(data || []);
    } catch (err) {
      console.error('Fetch modules error:', err);
      toast.error('Erro ao carregar módulos. Tente novamente.');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchModules();
  }, []);

  const openModuleDialog = (mod?: Module, nextMode: 'create' | 'edit' | 'duplicate' = 'create') => {
    setMode(nextMode);
    if (mod && nextMode !== 'create') {
      setEditingModule(nextMode === 'edit' ? mod : null);
      setModuleForm({
        brand: mod.brand,
        model: nextMode === 'duplicate' ? `${mod.model} (cópia)` : mod.model,
        power: mod.power,
        voc: mod.voc,
        isc: mod.isc,
        vmp: mod.vmp,
        imp: mod.imp,
      });
    } else {
      setEditingModule(null);
      setModuleForm(emptyModule);
    }
    setModuleDialogOpen(true);
  };

  const saveModule = async () => {
    if (!moduleForm.brand.trim() || !moduleForm.model.trim()) {
      toast.error('Marca e modelo são obrigatórios.');
      return;
    }
    const numericFields: Array<[string, number]> = [
      ['Potência', moduleForm.power],
      ['Voc', moduleForm.voc],
      ['Isc', moduleForm.isc],
      ['Vmp', moduleForm.vmp],
      ['Imp', moduleForm.imp],
    ];
    const invalid = numericFields.find(([, v]) => !(v > 0));
    const cleanBrand = moduleForm.brand.trim();
    const cleanModel = moduleForm.model.trim();

    // Verificação Anti-Duplicidade
    const isDuplicate = modules.some(
      mod =>
        mod.id !== (editingModule ? editingModule.id : -1) &&
        mod.brand.trim().toLowerCase() === cleanBrand.toLowerCase() &&
        mod.model.trim().toLowerCase() === cleanModel.toLowerCase()
    );

    if (isDuplicate) {
      toast.error(`Módulo fotovoltaico já cadastrado: ${cleanBrand} - ${cleanModel} já existe no banco de dados.`);
      return;
    }

    setSavingModule(true);
    try {
      const payload = {
        ...moduleForm,
        brand: cleanBrand,
        model: cleanModel,
      };
      if (mode === 'edit' && editingModule) {
        const { error } = await supabase.from('modules').update(payload).eq('id', editingModule.id);
        if (error) throw error;
        toast.success('Equipamento atualizado!');
      } else {
        const { error } = await supabase.from('modules').insert(payload);
        if (error) throw error;
        toast.success(mode === 'duplicate' ? 'Equipamento duplicado!' : 'Módulo adicionado!');
      }
      setModuleDialogOpen(false);
      fetchModules();
    } catch (err) {
      console.error('Save module error:', err);
      toast.error('Erro ao salvar módulo. Tente novamente.');
    } finally {
      setSavingModule(false);
    }
  };

  const confirmDeleteModule = async () => {
    if (!deleteModuleId) return;
    try {
      const { error } = await supabase.from('modules').delete().eq('id', deleteModuleId);
      if (error) throw error;
      toast.success('Módulo excluído!');
      fetchModules();
    } catch (err) {
      console.error('Delete module error:', err);
      toast.error('Erro ao excluir módulo. Tente novamente.');
    } finally {
      setDeleteModuleId(null);
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
        <Button onClick={() => openModuleDialog()}>
          <Plus className="w-4 h-4 mr-2" /> Adicionar Módulo
        </Button>
      </div>
      <DatasheetImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        kind="module"
        onImported={fetchModules}
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
          placeholder="Pot. mín (W)"
          value={minPower}
          onChange={(e) => setMinPower(e.target.value === '' ? '' : Number(e.target.value))}
          className="w-36"
        />
        <Input
          type="number"
          placeholder="Pot. máx (W)"
          value={maxPower}
          onChange={(e) => setMaxPower(e.target.value === '' ? '' : Number(e.target.value))}
          className="w-36"
        />
        {hasFilters && (
          <Button variant="ghost" onClick={clearFilters}>Limpar Filtros</Button>
        )}
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Marca</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead className="text-right">Potência (W)</TableHead>
              <TableHead className="text-right">Voc (V)</TableHead>
              <TableHead className="text-right">Isc (A)</TableHead>
              <TableHead className="text-right">Vmp (V)</TableHead>
              <TableHead className="text-right">Imp (A)</TableHead>
              <TableHead className="w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredModules.map((mod) => (
              <TableRow key={mod.id}>
                <TableCell className="font-medium">{mod.brand}</TableCell>
                <TableCell>{mod.model}</TableCell>
                <TableCell className="text-right">{mod.power}</TableCell>
                <TableCell className="text-right">{mod.voc}</TableCell>
                <TableCell className="text-right">{mod.isc}</TableCell>
                <TableCell className="text-right">{mod.vmp}</TableCell>
                <TableCell className="text-right">{mod.imp}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" title="Editar" onClick={() => openModuleDialog(mod, 'edit')}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Duplicar" onClick={() => openModuleDialog(mod, 'duplicate')}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Excluir" onClick={() => setDeleteModuleId(mod.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filteredModules.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  {modules.length === 0 ? (
                    'Nenhum módulo cadastrado.'
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


      <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{mode === 'edit' ? 'Editar Módulo' : mode === 'duplicate' ? 'Duplicar Módulo' : 'Novo Módulo'}</DialogTitle>
            <DialogDescription>Preencha os dados técnicos do módulo fotovoltaico.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mod-brand">Marca</Label>
                <Input id="mod-brand" value={moduleForm.brand} onChange={(e) => setModuleForm({ ...moduleForm, brand: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mod-model">Modelo</Label>
                <Input id="mod-model" value={moduleForm.model} onChange={(e) => setModuleForm({ ...moduleForm, model: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mod-power">Potência (W)</Label>
                <Input id="mod-power" type="number" value={moduleForm.power} onChange={(e) => setModuleForm({ ...moduleForm, power: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mod-voc">Voc (V)</Label>
                <Input id="mod-voc" type="number" step="0.1" value={moduleForm.voc} onChange={(e) => setModuleForm({ ...moduleForm, voc: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mod-isc">Isc (A)</Label>
                <Input id="mod-isc" type="number" step="0.01" value={moduleForm.isc} onChange={(e) => setModuleForm({ ...moduleForm, isc: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mod-vmp">Vmp (V)</Label>
                <Input id="mod-vmp" type="number" step="0.1" value={moduleForm.vmp} onChange={(e) => setModuleForm({ ...moduleForm, vmp: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mod-imp">Imp (A)</Label>
                <Input id="mod-imp" type="number" step="0.01" value={moduleForm.imp} onChange={(e) => setModuleForm({ ...moduleForm, imp: Number(e.target.value) })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModuleDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveModule} disabled={savingModule}>
              {savingModule && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteModuleId} onOpenChange={() => setDeleteModuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este módulo? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteModule} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ModuleManager;
