import React, { useState, useEffect } from 'react';
import { ProjectState, UtilityCompany, ConnectionType, VoltageLevel, EquipmentBlock } from '@/types';
import { getProjectEngineeringStatus } from '@/services/engineering';
import { DEFAULT_MODULE, DEFAULT_INVERTER } from '@/constants';
import { ProjectForm } from '@/components/ProjectForm';
import { DiagramCanvas } from '@/components/DiagramCanvas';
import { generateMemorialPDF } from '@/services/pdfService';
import { useEquipment } from '@/hooks/useEquipment';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { SavedProjects } from '@/components/SavedProjects';
import { Sun, LayoutDashboard, Archive, Save, Loader2, LogOut, Database, FolderOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

const createDefaultBlock = (id: number, module = DEFAULT_MODULE, inverter = DEFAULT_INVERTER): EquipmentBlock => ({
  id,
  moduleId: module.id, inverterId: inverter.id,
  module, inverter,
  inverterBrand: inverter.brand, inverterModel: inverter.model, inverterPowerKw: inverter.power,
  moduleBrand: module.brand, moduleModel: module.model, modulePowerW: module.power,
  moduleQty: 0, inverterQty: 1,
  strings: [{ id: 1, count: 0 }],
});

const INITIAL_PROJECT_STATE: ProjectState = {
  client: {
    name: '', document: '', email: '', phone: '', utilityId: '', art: '',
    address: { street: '', number: '', neighborhood: '', city: '', state: 'RJ', zipCode: '' },
  },
  engineer: { name: '', crea: '' },
  technical: {
    utility: UtilityCompany.LIGHT,
    connectionType: ConnectionType.BIPHASIC,
    voltage: VoltageLevel.V_127_220,
    mainBreaker: 63,
    distance: 15,
  },
  equipmentBlocks: [createDefaultBlock(1)],
  paperSize: 'A4',
};

const Index = () => {
  const [projectData, setProjectData] = useState<ProjectState>(INITIAL_PROJECT_STATE);
  const [activeTab, setActiveTab] = useState<'form' | 'diagram' | 'projects'>('form');
  const [saving, setSaving] = useState(false);
  const { modules, inverters, loading } = useEquipment();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();

  useEffect(() => {
    if (modules.length > 0 && inverters.length > 0 && projectData.equipmentBlocks[0]?.moduleId === 0) {
      const defMod = modules[0];
      const defInv = inverters[0];
      setProjectData(prev => ({
        ...prev,
        equipmentBlocks: prev.equipmentBlocks.map(b => b.moduleId === 0
          ? createDefaultBlock(b.id, defMod, defInv)
          : b
        ),
      }));
    }
  }, [modules, inverters]);

  useEffect(() => {
    const saved = localStorage.getItem('solar_engineer_profile');
    if (saved) {
      try {
        setProjectData(prev => ({ ...prev, engineer: JSON.parse(saved) }));
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (projectData.engineer?.name || projectData.engineer?.crea) {
      localStorage.setItem('solar_engineer_profile', JSON.stringify(projectData.engineer));
    }
  }, [projectData.engineer?.name, projectData.engineer?.crea]);

  const saveDraft = async () => {
    setSaving(true);
    try {
      if (!user) {
        toast.error('Você precisa estar logado para salvar projetos.');
        return;
      }

      const engResult = getProjectEngineeringStatus(projectData.equipmentBlocks, projectData.technical);

      const payload = {
        client_name: projectData.client.name || 'Novo Projeto',
        client_document: projectData.client.document || null,
        client_email: projectData.client.email || null,
        client_phone: projectData.client.phone || null,
        utility: projectData.technical.utility,
        connection_type: projectData.technical.connectionType,
        voltage_level: projectData.technical.voltage,
        module_id: projectData.equipmentBlocks[0]?.moduleId || null,
        inverter_id: projectData.equipmentBlocks[0]?.inverterId || null,
        address: projectData.client.address as any,
        technical_details: {
          mainBreaker: projectData.technical.mainBreaker,
          distance: projectData.technical.distance,
          equipmentBlocks: projectData.equipmentBlocks,
          engineer: projectData.engineer,
          art: projectData.client.art,
          utilityId: projectData.client.utilityId,
          paperSize: projectData.paperSize,
          suggestedBreaker: engResult.totalSuggestedBreaker,
          breakerPolarity: engResult.totalBreakerPolarity,
          blockBreakers: engResult.blocks.map(b => ({
            blockId: b.blockId,
            breaker: b.suggestedBreaker,
            polarity: b.breakerPolarity,
          })),
        } as any,
        user_id: user.id,
      };

      const { error } = await supabase.from('projects').insert(payload);
      if (error) throw error;
      toast.success('Projeto salvo com sucesso!');
    } catch (err: any) {
      console.error('Save draft error:', err);
      toast.error('Erro ao salvar projeto. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span>Carregando equipamentos...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-brand-900 text-brand-100 flex-shrink-0">
        <div className="p-6 flex items-center gap-3 border-b border-brand-700">
          <Sun className="w-8 h-8 text-accent" />
          <div>
            <h1 className="font-bold text-lg leading-tight text-primary-foreground">SolarCAD</h1>
            <span className="text-xs text-brand-200 opacity-75">Homologação GD</span>
          </div>
        </div>
        <nav className="p-4 space-y-2">
          <button onClick={() => setActiveTab('form')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'form' ? 'bg-brand-800 text-primary-foreground' : 'text-brand-200 hover:bg-brand-800'}`}>
            <LayoutDashboard size={20} /> Novo Projeto
          </button>
          <button onClick={() => setActiveTab('diagram')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'diagram' ? 'bg-brand-800 text-primary-foreground' : 'text-brand-200 hover:bg-brand-800'}`}>
            <Archive size={20} /> Diagrama Unifilar
          </button>
          <button onClick={() => setActiveTab('projects')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'projects' ? 'bg-brand-800 text-primary-foreground' : 'text-brand-200 hover:bg-brand-800'}`}>
            <FolderOpen size={20} /> Projetos Salvos
          </button>
          <button onClick={saveDraft} disabled={saving} className="w-full flex items-center gap-3 px-4 py-3 text-brand-200 hover:bg-brand-800 rounded-lg transition-colors disabled:opacity-50">
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            Salvar Projeto
          </button>
          {isAdmin && (
            <Link to="/admin" className="w-full flex items-center gap-3 px-4 py-3 text-brand-200 hover:bg-brand-800 rounded-lg transition-colors">
              <Database size={20} /> Gerenciamento
            </Link>
          )}
        </nav>
        <div className="md:fixed md:bottom-0 md:left-0 md:w-64 p-4 space-y-2 bg-brand-900">
          {user && <div className="text-xs text-brand-200 truncate text-center" title={user.email}>{user.email}</div>}
          <button onClick={signOut} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs text-brand-200 hover:bg-brand-800 rounded-lg transition-colors">
            <LogOut size={14} /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="bg-card shadow-sm border-b border-border p-6">
          <h2 className="text-2xl font-bold text-foreground">
            {activeTab === 'form' ? 'Dados do Projeto' : activeTab === 'diagram' ? 'Diagrama Unifilar' : 'Projetos Salvos'}
          </h2>
          <p className="text-muted-foreground">
            {activeTab === 'form' ? 'Preencha os dados e adicione múltiplos conjuntos de inversores.' : activeTab === 'diagram' ? 'Diagrama com múltiplos inversores e barramento CA.' : 'Gerencie e carregue seus projetos salvos.'}
          </p>
        </header>
        <div className="p-6 max-w-6xl mx-auto">
          {activeTab === 'form' ? (
            <ProjectForm data={projectData} onChange={setProjectData} onGenerate={() => generateMemorialPDF(projectData)} modules={modules} inverters={inverters} />
          ) : activeTab === 'diagram' ? (
            <div className="bg-card p-6 rounded-lg shadow border border-border">
              <DiagramCanvas projectData={projectData} />
            </div>
          ) : (
            <SavedProjects onLoadProject={(data) => { setProjectData(data); setActiveTab('form'); }} />
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
