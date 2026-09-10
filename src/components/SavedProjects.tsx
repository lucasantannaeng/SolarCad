import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ProjectState, UtilityCompany, ConnectionType, VoltageLevel, EquipmentBlock } from '@/types';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, Upload, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface SavedProjectsProps {
  onLoadProject: (data: ProjectState) => void;
}

interface ProjectRow {
  id: string;
  client_name: string;
  client_document: string | null;
  client_email: string | null;
  client_phone: string | null;
  utility: string | null;
  connection_type: string | null;
  voltage_level: string | null;
  module_id: number | null;
  inverter_id: number | null;
  address: any;
  technical_details: any;
  user_id: string;
  created_at: string | null;
}

export const SavedProjects: React.FC<SavedProjectsProps> = ({ onLoadProject }) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      const offlineList: ProjectRow[] = JSON.parse(localStorage.getItem('solarcad_offline_projects') || '[]');

      if (error) {
        console.warn('Falha ao consultar projetos do Supabase, exibindo cache offline:', error);
        setProjects(offlineList);
        return;
      }

      const combined = [...offlineList, ...(data || [])];
      setProjects(combined);
    } catch (err: any) {
      console.error('Fetch projects error:', err);
      const offlineList: ProjectRow[] = JSON.parse(localStorage.getItem('solarcad_offline_projects') || '[]');
      setProjects(offlineList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [user]);

  const handleDelete = async (id: string) => {
    try {
      if (id.startsWith('offline-') || id.startsWith('local-')) {
        const offlineList: ProjectRow[] = JSON.parse(localStorage.getItem('solarcad_offline_projects') || '[]');
        const filtered = offlineList.filter(p => p.id !== id);
        localStorage.setItem('solarcad_offline_projects', JSON.stringify(filtered));
        setProjects(prev => prev.filter(p => p.id !== id));
        toast.success('Rascunho offline excluído com sucesso!');
        return;
      }

      // Delete related equipment first
      await supabase.from('project_equipment').delete().eq('project_id', id);
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
      toast.success('Projeto excluído com sucesso!');
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      console.error('Delete project error:', err);
      toast.error('Erro ao excluir projeto. Tente novamente.');
    }
  };

  const handleLoad = (project: ProjectRow) => {
    const td = project.technical_details || {};
    const addr = project.address || {};

    const equipmentBlocks: EquipmentBlock[] = td.equipmentBlocks || [{
      id: 1,
      moduleId: project.module_id || 0,
      inverterId: project.inverter_id || 0,
      module: { id: 0, brand: '', model: '', power: 0, voc: 0, isc: 0, vmp: 0, imp: 0 },
      inverter: { id: 0, brand: '', model: '', power: 0, maxDcVoltage: 0, maxInputCurrent: 0, mpptMin: 0, mpptMax: 0, mpptCount: 0, nominalOutputVoltage: 0, outputPhases: 1 },
      inverterBrand: '', inverterModel: '', inverterPowerKw: 0,
      moduleBrand: '', moduleModel: '', modulePowerW: 0,
      moduleQty: 0, inverterQty: 1,
      strings: [{ id: 1, count: 0 }],
    }];

    const state: ProjectState = {
      client: {
        name: project.client_name || '',
        document: project.client_document || '',
        email: project.client_email || '',
        phone: project.client_phone || '',
        utilityId: td.utilityId || '',
        art: td.art || '',
        address: {
          street: addr.street || '',
          number: addr.number || '',
          neighborhood: addr.neighborhood || '',
          city: addr.city || '',
          state: addr.state || 'RJ',
          zipCode: addr.zipCode || '',
        },
      },
      engineer: td.engineer || { name: '', crea: '' },
      technical: {
        utility: (project.utility as UtilityCompany) || UtilityCompany.LIGHT,
        connectionType: (project.connection_type as ConnectionType) || ConnectionType.BIPHASIC,
        voltage: (project.voltage_level as VoltageLevel) || VoltageLevel.V_127_220,
        mainBreaker: td.mainBreaker || 63,
        distance: td.distance || 15,
      },
      equipmentBlocks,
      paperSize: td.paperSize || 'A4',
    };

    onLoadProject(state);
    toast.success(`Projeto "${project.client_name}" carregado!`);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const utilityLabel = (val: string | null) => {
    if (val === UtilityCompany.LIGHT) return 'Light';
    if (val === UtilityCompany.ENEL_RJ) return 'Enel RJ';
    return val || '—';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Carregando projetos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{projects.length} projeto(s) encontrado(s)</p>
        <Button variant="outline" size="sm" onClick={fetchProjects}>
          <RefreshCw size={16} /> Atualizar
        </Button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum projeto salvo ainda.
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {projects.map(project => (
              <div
                key={project.id}
                className="bg-card border border-border rounded-xl p-3.5 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-sm text-foreground line-clamp-1 flex items-center gap-1.5">
                      {project.client_name || 'Projeto sem nome'}
                      {(project.id.startsWith('offline-') || project.id.startsWith('local-')) && (
                        <span className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-normal">
                          Offline
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-brand-500/15 text-brand-700 dark:text-brand-300 border border-brand-500/30">
                        {utilityLabel(project.utility)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDate(project.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs gap-1.5 h-8 font-medium"
                    onClick={() => handleLoad(project)}
                  >
                    <Upload size={13} /> Carregar Projeto
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" className="h-8 px-2.5 text-xs gap-1" title="Excluir projeto">
                        <Trash2 size={13} />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="max-w-md mx-4">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                          Deseja excluir o projeto "{project.client_name}"? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(project.id)}>Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Cliente</TableHead>
                  <TableHead>Concessionária</TableHead>
                  <TableHead>Data de Criação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map(project => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{project.client_name}</span>
                        {(project.id.startsWith('offline-') || project.id.startsWith('local-')) && (
                          <span className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-normal">
                            Offline
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{utilityLabel(project.utility)}</TableCell>
                    <TableCell>{formatDate(project.created_at)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleLoad(project)}>
                        <Upload size={14} /> Carregar
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 size={14} /> Excluir
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                            <AlertDialogDescription>
                              Deseja excluir o projeto "{project.client_name}"? Esta ação não pode ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(project.id)}>Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
};
