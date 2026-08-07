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

      if (error) throw error;
      setProjects(data || []);
    } catch (err: any) {
      console.error('Fetch projects error:', err);
      toast.error('Erro ao carregar projetos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleDelete = async (id: string) => {
    try {
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
        <div className="border border-border rounded-lg overflow-hidden">
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
                  <TableCell className="font-medium">{project.client_name}</TableCell>
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
      )}
    </div>
  );
};
