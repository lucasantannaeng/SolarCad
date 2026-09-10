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
import { Sun, LayoutDashboard, Archive, Save, Loader2, LogOut, Database, FolderOpen, Settings, Building2, Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfigModal } from '@/components/ConfigModal';
import { CompanyProfileModal } from '@/components/CompanyProfileModal';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';

const isMobileApp = typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform());

const createDefaultBlock = (id: number, module = DEFAULT_MODULE, inverter = DEFAULT_INVERTER): EquipmentBlock => ({
  id,
  moduleId: module.id, inverterId: inverter.id,
  module, inverter,
  inverterBrand: inverter.brand, inverterModel: inverter.model, inverterPowerKw: inverter.power,
  moduleBrand: module.brand, moduleModel: module.model, modulePowerW: module.power,
  moduleQty: 0, inverterQty: 1,
  strings: [{ id: 1, count: 0 }],
  structureType: 'CERAMIC',
  roofPlaneName: `Água ${id} (Norte - Telhado Principal)`,
  azimuth: 0,
  tilt: 15,
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
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { modules, inverters, loading } = useEquipment();
  const { profile: companyProfile } = useCompanyProfile();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();

  const appTitle = isMobileApp ? 'SolarCAD Mobile v1.3.0' : 'SolarCAD Desktop v1.3.0';

  // Injeta perfil da empresa e responsável técnico no projeto atual se ainda não preenchido
  useEffect(() => {
    if (companyProfile?.legalRepresentative?.name && !projectData.engineer?.name) {
      setProjectData(prev => ({
        ...prev,
        engineer: {
          name: companyProfile.legalRepresentative.name,
          crea: `${companyProfile.legalRepresentative.creaCft}/${companyProfile.legalRepresentative.creaState}`,
        },
        companyProfile: companyProfile,
      }));
    }
  }, [companyProfile]);

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
      if (error) {
        console.warn('Erro ao salvar no Supabase, salvando em cache offline:', error);
        const localList = JSON.parse(localStorage.getItem('solarcad_offline_projects') || '[]');
        const localItem = {
          ...payload,
          id: `offline-${Date.now()}`,
          created_at: new Date().toISOString(),
          _isOffline: true,
        };
        localStorage.setItem('solarcad_offline_projects', JSON.stringify([localItem, ...localList]));
        toast.warning('Sem conexão com o Supabase. Projeto salvo como rascunho offline no dispositivo!');
        return;
      }

      toast.success('Projeto salvo com sucesso na nuvem (Supabase)!');
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
    <div className="h-screen w-screen bg-background flex flex-col md:flex-row overflow-hidden select-none md:select-auto">
      {/* Mobile Top Header (with Safe Area Inset) */}
      <header className="md:hidden pt-safe bg-brand-900 text-brand-100 px-4 py-2.5 flex items-center justify-between border-b border-brand-800 shadow-sm z-30 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <Sun className="w-6 h-6 text-accent animate-pulse flex-shrink-0" />
          <div className="leading-tight">
            <h1 className="font-bold text-base text-white tracking-tight">SolarCAD</h1>
            <span className="text-[10px] text-brand-200 block font-medium">
              {activeTab === 'form' ? 'Dados do Projeto' : activeTab === 'diagram' ? 'Diagrama Unifilar' : 'Projetos Salvos'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={saveDraft}
            disabled={saving}
            className="p-2 text-brand-200 hover:text-white hover:bg-brand-800/70 rounded-lg transition-colors disabled:opacity-50"
            title="Salvar Projeto"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          </button>
          <button
            onClick={() => setMobileMenuOpen(prev => !prev)}
            className="p-2 text-brand-200 hover:text-white hover:bg-brand-800/70 rounded-lg transition-colors"
            title="Abrir Menu"
            aria-label="Abrir Menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile Offcanvas Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-4/5 max-w-xs bg-brand-900 text-brand-100 h-full flex flex-col justify-between shadow-2xl z-50 pt-safe pb-safe border-r border-brand-800 animate-in slide-in-from-left duration-200">
            <div className="flex flex-col flex-1 overflow-y-auto">
              <div className="p-4 flex items-center justify-between border-b border-brand-800 bg-brand-950/20">
                <div className="flex items-center gap-2.5">
                  <Sun className="w-7 h-7 text-accent animate-pulse" />
                  <div>
                    <h2 className="font-bold text-base text-white">SolarCAD</h2>
                    <span className="text-[10px] text-brand-200 font-medium">Homologação GD • v1.3.0</span>
                  </div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-brand-200 hover:text-white hover:bg-brand-800 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
              <nav className="p-3 space-y-1.5 flex-1">
                <button
                  onClick={() => { setActiveTab('form'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-colors font-medium text-sm ${
                    activeTab === 'form' ? 'bg-brand-800 text-white font-semibold shadow-sm' : 'text-brand-200 hover:bg-brand-800/70'
                  }`}
                >
                  <LayoutDashboard size={18} /> Novo Projeto
                </button>
                <button
                  onClick={() => { setActiveTab('diagram'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-colors font-medium text-sm ${
                    activeTab === 'diagram' ? 'bg-brand-800 text-white font-semibold shadow-sm' : 'text-brand-200 hover:bg-brand-800/70'
                  }`}
                >
                  <Archive size={18} /> Diagrama Unifilar
                </button>
                <button
                  onClick={() => { setActiveTab('projects'); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-colors font-medium text-sm ${
                    activeTab === 'projects' ? 'bg-brand-800 text-white font-semibold shadow-sm' : 'text-brand-200 hover:bg-brand-800/70'
                  }`}
                >
                  <FolderOpen size={18} /> Projetos Salvos
                </button>
                <button
                  onClick={() => { setMobileMenuOpen(false); saveDraft(); }}
                  disabled={saving}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 text-brand-200 hover:bg-brand-800/70 rounded-lg transition-colors disabled:opacity-50 font-medium text-sm"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Salvar Projeto
                </button>
                <div className="pt-2 my-2 border-t border-brand-800/60" />
                <button
                  onClick={() => { setCompanyModalOpen(true); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 text-brand-200 hover:bg-brand-800/70 rounded-lg transition-colors font-medium text-sm"
                >
                  <Building2 size={18} /> Empresa & Procurador
                </button>
                <button
                  onClick={() => { setConfigOpen(true); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 text-brand-200 hover:bg-brand-800/70 rounded-lg transition-colors font-medium text-sm"
                >
                  <Settings size={18} /> Conexão & IA
                </button>
                {isAdmin && (
                  <Link
                    to="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-brand-200 hover:bg-brand-800/70 rounded-lg transition-colors font-medium text-sm"
                  >
                    <Database size={18} /> Gerenciamento
                  </Link>
                )}
              </nav>
            </div>
            <div className="p-3.5 space-y-2 border-t border-brand-800/80 bg-brand-950/40">
              {user && (
                <div className="text-xs text-brand-200 truncate text-center font-mono py-1 px-2 rounded bg-brand-900/50" title={user.email}>
                  {user.email}
                </div>
              )}
              <button
                onClick={() => { setMobileMenuOpen(false); signOut(); }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-brand-200 hover:bg-brand-800 hover:text-white rounded-lg transition-colors"
              >
                <LogOut size={14} /> Sair
              </button>
              <div className="text-[10px] text-brand-300/60 text-center font-mono pt-1">
                {appTitle}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex md:w-64 md:h-screen md:sticky md:top-0 bg-brand-900 text-brand-100 flex-col justify-between flex-shrink-0 z-20 shadow-xl border-r border-brand-800/80">
        <div className="flex flex-col flex-1 overflow-y-auto">
          <div className="p-5 flex items-center gap-3 border-b border-brand-800/80 bg-brand-950/20">
            <Sun className="w-8 h-8 text-accent animate-pulse" />
            <div>
              <h1 className="font-bold text-lg leading-tight text-primary-foreground">SolarCAD</h1>
              <span className="text-xs text-brand-200 opacity-90 font-medium">Homologação GD • v1.3.0</span>
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
            <button onClick={() => setCompanyModalOpen(true)} className="w-full flex items-center gap-3 px-4 py-3 text-brand-200 hover:bg-brand-800/70 hover:text-white rounded-lg transition-colors font-medium text-sm">
              <Building2 size={19} /> Empresa & Procurador
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
          <div className="text-[10px] text-brand-300/50 text-center font-mono pt-1">
            {appTitle}
          </div>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <main className="flex-1 h-full overflow-y-auto flex flex-col bg-background pb-safe md:pb-6">
        <header className="hidden md:flex bg-card shadow-sm border-b border-border p-6 items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {activeTab === 'form' ? 'Dados do Projeto' : activeTab === 'diagram' ? 'Diagrama Unifilar' : 'Projetos Salvos'}
            </h2>
            <p className="text-muted-foreground text-sm">
              {activeTab === 'form' ? 'Preencha os dados e adicione múltiplos conjuntos de inversores.' : activeTab === 'diagram' ? 'Diagrama com múltiplos inversores e barramento CA.' : 'Gerencie e carregue seus projetos salvos.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCompanyModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-brand-500/10 hover:bg-brand-500/20 text-brand-500 rounded-lg border border-brand-500/30 transition-all"
              title="Cadastro da Empresa Integradora e Procurador Legal"
            >
              <Building2 className="w-3.5 h-3.5 text-brand-500" /> Empresa & Procurador
            </button>
            <button
              onClick={() => setConfigOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-muted hover:bg-muted/80 text-foreground rounded-lg border border-border transition-all"
              title="Configurar Supabase & Chaves de IA"
            >
              <Settings className="w-3.5 h-3.5 text-brand-500" /> Configurações / IA
            </button>
          </div>
        </header>

        <div className={activeTab === 'diagram' ? "p-3 sm:p-4 md:p-6 w-full max-w-[1600px] mx-auto flex-1" : "p-3 sm:p-4 md:p-6 max-w-6xl mx-auto flex-1 w-full"}>
          {activeTab === 'form' ? (
            <ProjectForm data={projectData} onChange={setProjectData} onGenerate={() => generateMemorialPDF(projectData)} modules={modules} inverters={inverters} />
          ) : activeTab === 'diagram' ? (
            <div className="bg-card p-3 sm:p-4 md:p-6 rounded-lg shadow border border-border">
              <DiagramCanvas projectData={projectData} onProjectChange={setProjectData} />
            </div>
          ) : (
            <SavedProjects onLoadProject={(data) => { setProjectData(data); setActiveTab('form'); }} />
          )}
        </div>
      </main>

      {/* Modal de Configuração de Credenciais / IA */}
      <ConfigModal open={configOpen} onOpenChange={setConfigOpen} />

      {/* Modal de Cadastro da Empresa Integradora e Procurador Legal */}
      <CompanyProfileModal
        open={companyModalOpen}
        onOpenChange={setCompanyModalOpen}
        onProfileUpdated={(updatedProfile) => {
          setProjectData(prev => ({
            ...prev,
            companyProfile: updatedProfile,
            engineer: updatedProfile.legalRepresentative?.name ? {
              name: updatedProfile.legalRepresentative.name,
              crea: `${updatedProfile.legalRepresentative.creaCft}/${updatedProfile.legalRepresentative.creaState}`,
            } : prev.engineer,
          }));
        }}
      />
    </div>
  );
};

export default Index;
