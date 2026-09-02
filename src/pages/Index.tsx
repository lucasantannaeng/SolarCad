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
import { Sun, LayoutDashboard, Archive, Save, Loader2, LogOut, Database, FolderOpen, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfigModal } from '@/components/ConfigModal';

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
    dcCableDistance: 15,
  },
  equipmentBlocks: [createDefaultBlock(1)],
  creditBeneficiaries: [],
  paperSize: 'A4',
};

const Index = () => {
  const [projectData, setProjectData] = useState<ProjectState>(INITIAL_PROJECT_STATE);
  const [activeTab, setActiveTab] = useState<'form' | 'diagram' | 'projects'>('form');
  const [saving, setSaving] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
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
    <div className="h-screen w-screen bg-background flex flex-col md:flex-row overflow-hidden">
      <aside className="w-full md:w-64 md:h-screen md:sticky md:top-0 bg-brand-900 text-brand-100 flex flex-col justify-between flex-shrink-0 z-20 shadow-xl border-r border-brand-800/80">
        <div className="flex flex-col flex-1 overflow-y-auto">
          <div className="p-5 flex items-center gap-3 border-b border-brand-800/80 bg-brand-950/20">
            <Sun className="w-8 h-8 text-accent animate-pulse" />
            <div>
              <h1 className="font-bold text-lg leading-tight text-primary-foreground">SolarCAD</h1>
              <span className="text-xs text-brand-200 opacity-75">Homologação GD</span>
            </div>
          </div>
          <nav className="p-4 space-y-2 flex-1">
            <button onClick={() => setActiveTab('form')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium text-sm ${activeTab === 'form' ? 'bg-brand-800 text-primary-foreground shadow-sm' : 'text-brand-200 hover:bg-brand-800/70 hover:text-white'}`}>
              <LayoutDashboard size={19} /> Novo Projeto
            </button>
            <button onClick={() => setActiveTab('diagram')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium text-sm ${activeTab === 'diagram' ? 'bg-brand-800 text-primary-foreground shadow-sm' : 'text-brand-200 hover:bg-brand-800/70 hover:text-white'}`}>
              <Archive size={19} /> Diagrama Unifilar
            </button>
            <button onClick={() => setActiveTab('projects')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium text-sm ${activeTab === 'projects' ? 'bg-brand-800 text-primary-foreground shadow-sm' : 'text-brand-200 hover:bg-brand-800/70 hover:text-white'}`}>
              <FolderOpen size={19} /> Projetos Salvos
            </button>
            <button onClick={saveDraft} disabled={saving} className="w-full flex items-center gap-3 px-4 py-3 text-brand-200 hover:bg-brand-800/70 hover:text-white rounded-lg transition-colors disabled:opacity-50 font-medium text-sm">
              {saving ? <Loader2 size={19} className="animate-spin" /> : <Save size={19} />}
              Salvar Projeto
            </button>
            <button onClick={() => setConfigOpen(true)} className="w-full flex items-center gap-3 px-4 py-3 text-brand-200 hover:bg-brand-800/70 hover:text-white rounded-lg transition-colors font-medium text-sm">
              <Settings size={19} /> Conexão & IA
            </button>
            {isAdmin && (
              <Link to="/admin" className="w-full flex items-center gap-3 px-4 py-3 text-brand-200 hover:bg-brand-800/70 hover:text-white rounded-lg transition-colors font-medium text-sm">
                <Database size={19} /> Gerenciamento
              </Link>
            )}
          </nav>
        </div>
        <div className="p-4 space-y-2 border-t border-brand-800/80 bg-brand-950/40">
          {user && (
            <div className="text-xs text-brand-200 truncate text-center font-mono py-1 px-2 rounded bg-brand-900/50" title={user.email}>
              {user.email}
            </div>
          )}
          <button onClick={signOut} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-brand-200 hover:bg-brand-800 hover:text-white rounded-lg transition-colors">
            <LogOut size={14} /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 h-screen overflow-y-auto flex flex-col bg-background">
        <header className="bg-card shadow-sm border-b border-border p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {activeTab === 'form' ? 'Dados do Projeto' : activeTab === 'diagram' ? 'Diagrama Unifilar' : 'Projetos Salvos'}
            </h2>
            <p className="text-muted-foreground">
              {activeTab === 'form' ? 'Preencha os dados e adicione múltiplos conjuntos de inversores.' : activeTab === 'diagram' ? 'Diagrama com múltiplos inversores e barramento CA.' : 'Gerencie e carregue seus projetos salvos.'}
            </p>
          </div>
          <button
            onClick={() => setConfigOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-muted hover:bg-muted/80 text-foreground rounded-lg border border-border transition-all"
            title="Configurar Supabase & Chaves de IA"
          >
            <Settings className="w-3.5 h-3.5 text-brand-500" /> Configurações / IA
          </button>
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

      {/* Modal de Configuração de Credenciais / IA para quem clonar */}
      <ConfigModal open={configOpen} onOpenChange={setConfigOpen} />
    </div>
  );
};

export default Index;
