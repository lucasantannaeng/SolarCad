import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import Index from "./pages/Index";
import AuthPage from "./pages/Auth";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const Admin = lazy(() => import("./pages/Admin"));

const queryClient = new QueryClient();

const FullScreenLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
  </div>
);

const NativeDeepLinkHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listenerPromise = CapApp.addListener('appUrlOpen', async ({ url }) => {
      try {
        await Browser.close().catch(() => {});
      } catch {}

      if (url && (url.includes('login-callback') || url.includes('access_token') || url.includes('code='))) {
        const hashPart = url.split('#')[1];
        if (hashPart) {
          const params = new URLSearchParams(hashPart);
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (!error) {
              navigate('/', { replace: true });
              return;
            }
          }
        }

        const queryPart = url.split('?')[1]?.split('#')[0];
        if (queryPart) {
          const params = new URLSearchParams(queryPart);
          const code = params.get('code');
          if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (!error) {
              navigate('/', { replace: true });
              return;
            }
          }
        }
      }
    });

    return () => {
      listenerPromise.then(handle => handle.remove()).catch(() => {});
    };
  }, [navigate]);

  return null;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HashRouter>
        <NativeDeepLinkHandler />
        <AuthProvider>
          <Suspense fallback={<FullScreenLoader />}>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
