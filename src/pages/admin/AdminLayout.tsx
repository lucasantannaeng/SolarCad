import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { Link, Navigate } from 'react-router-dom';
import { Loader2, Database, Sun, LogOut, LayoutDashboard } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ModuleManager from './ModuleManager';
import InverterManager from './InverterManager';

const AdminLayout = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();

  if (authLoading || adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-brand-900 text-brand-100 flex-shrink-0">
        <div className="p-6 flex items-center gap-3 border-b border-brand-700">
          <Sun className="w-8 h-8 text-accent" />
          <div>
            <h1 className="font-bold text-lg leading-tight text-primary-foreground">SolarCAD</h1>
            <span className="text-xs text-brand-200 opacity-75">Admin</span>
          </div>
        </div>
        <nav className="p-4 space-y-2">
          <Link to="/" className="w-full flex items-center gap-3 px-4 py-3 text-brand-200 hover:bg-brand-800 rounded-lg transition-colors">
            <LayoutDashboard size={20} /> Projetos
          </Link>
          <div className="w-full flex items-center gap-3 px-4 py-3 bg-brand-800 text-primary-foreground rounded-lg">
            <Database size={20} /> Gerenciamento
          </div>
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
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Database className="w-6 h-6" /> Gerenciamento de Equipamentos
          </h2>
          <p className="text-muted-foreground">Adicione, edite ou remova módulos e inversores do sistema.</p>
        </header>

        <div className="p-6 max-w-6xl mx-auto">
          <Tabs defaultValue="modules" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="modules">Módulos</TabsTrigger>
              <TabsTrigger value="inverters">Inversores</TabsTrigger>
            </TabsList>

            <TabsContent value="modules">
              <ModuleManager />
            </TabsContent>

            <TabsContent value="inverters">
              <InverterManager />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
