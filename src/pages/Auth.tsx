import { useState, useEffect } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const AuthPage = () => {
  const navigate = useNavigate();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleSetupHelpOpen, setGoogleSetupHelpOpen] = useState(false);
  const isNative = Capacitor.isNativePlatform();
  const isDesktop = typeof window !== 'undefined' && Boolean((window as any).electronAPI?.isDesktop);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate('/', { replace: true });
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/', { replace: true });
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      // 1. Electron Desktop (Loopback HTTP Server RFC 8252 + Navegador Padrão do Sistema)
      if (isDesktop && (window as any).electronAPI?.startDesktopOAuth) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: 'http://localhost:54321/callback',
            skipBrowserRedirect: true,
          },
        });

        if (error) {
          if (error.message?.includes('provider is not enabled') || error.message?.includes('validation_failed')) {
            setGoogleSetupHelpOpen(true);
            throw new Error('O login com o Google ainda não foi ativado no painel do Supabase.');
          }
          throw error;
        }

        if (data?.url) {
          toast.info('Abrindo o navegador para autenticação segura com o Google...');
          const result = await (window as any).electronAPI.startDesktopOAuth(data.url);

          if (result?.error) {
            toast.error(result.error);
            return;
          }

          if (result?.access_token && result?.refresh_token) {
            const { error: sessionErr } = await supabase.auth.setSession({
              access_token: result.access_token,
              refresh_token: result.refresh_token,
            });
            if (sessionErr) throw sessionErr;
            toast.success('Login com o Google realizado com sucesso!');
            navigate('/', { replace: true });
            return;
          }

          if (result?.code) {
            const { error: codeErr } = await supabase.auth.exchangeCodeForSession(result.code);
            if (codeErr) throw codeErr;
            toast.success('Login com o Google realizado com sucesso!');
            navigate('/', { replace: true });
            return;
          }
        }
        return;
      }

      // 2. Android Mobile (Capacitor Custom Tabs / Deep Link)
      if (isNative) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: 'com.autorais.solarcad://login-callback',
            skipBrowserRedirect: true,
          },
        });

        if (error) {
          if (error.message?.includes('provider is not enabled') || error.message?.includes('validation_failed')) {
            setGoogleSetupHelpOpen(true);
            throw new Error('O login com o Google ainda não foi ativado no painel do Supabase.');
          }
          throw error;
        }

        if (data?.url) {
          await Browser.open({ url: data.url, windowName: '_system' });
        }
        return;
      }

      // 3. Web Padrão
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        if (error.message?.includes('provider is not enabled') || error.message?.includes('validation_failed')) {
          setGoogleSetupHelpOpen(true);
          throw new Error('O login com o Google ainda não foi ativado no painel do Supabase.');
        }
        throw error;
      }
    } catch (err: any) {
      console.error('Google login error:', err);
      toast.error(err.message || 'Erro ao iniciar login com o Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-5">
        <div className="flex flex-col items-center justify-center gap-3 mb-2">
          <img src="./logo-solarcad.png" alt="SolarCad" className="w-44 h-auto" />
          <p className="text-xs text-muted-foreground text-center font-medium">
            Suíte Profissional de Homologação GD Fotovoltaica
          </p>
        </div>

        {/* Google Login Button */}
        <Button
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          variant="outline"
          className="w-full border-border hover:bg-secondary/70 text-foreground font-medium flex items-center justify-center gap-3 py-3 shadow-sm"
        >
          {googleLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          Continuar com o Google (Gmail)
        </Button>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-border"></div>
          <span className="flex-shrink mx-3 text-xs text-muted-foreground">ou entre com e-mail e senha</span>
          <div className="flex-grow border-t border-border"></div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            providers={[]}
            localization={{
              variables: {
                sign_in: {
                  email_label: 'E-mail',
                  password_label: 'Senha',
                  button_label: 'Entrar',
                  link_text: 'Já tem conta? Entre',
                },
                sign_up: {
                  email_label: 'E-mail',
                  password_label: 'Senha',
                  button_label: 'Cadastrar',
                  link_text: 'Não tem conta? Cadastre-se',
                },
              },
            }}
          />
        </div>

        {/* Dialog Informativo de Ativação do Google no Supabase */}
        <Dialog open={googleSetupHelpOpen} onOpenChange={setGoogleSetupHelpOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground text-base">
                <Info className="w-5 h-5 text-brand-500" />
                Ativação do Login Google no Supabase
              </DialogTitle>
              <DialogDescription className="text-xs">
                Para autenticar com o Google (Gmail), o provedor precisa ser habilitado no painel do Supabase com as credenciais OAuth do Google Cloud.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2.5 text-xs text-muted-foreground my-2">
              <div className="p-3 bg-muted/60 rounded-lg border border-border space-y-1">
                <span className="font-bold text-foreground block text-xs">1. Supabase Dashboard</span>
                <p>Acesse <b>Authentication &gt; Providers &gt; Google</b> e ative <b>Enable Google provider</b>.</p>
                <p>Insira o <b>Client ID</b> e <b>Client Secret</b> do Google Cloud.</p>
              </div>

              <div className="p-3 bg-muted/60 rounded-lg border border-border space-y-1">
                <span className="font-bold text-foreground block text-xs">2. URLs de Redirecionamento (Redirect URLs)</span>
                <p>Em <b>Authentication &gt; URL Configuration</b>, adicione:</p>
                <code className="block p-1 bg-background rounded font-mono text-[11px] text-foreground border border-border/50">
                  http://localhost:54321/callback
                </code>
                <code className="block p-1 bg-background rounded font-mono text-[11px] text-foreground border border-border/50">
                  com.autorais.solarcad://login-callback
                </code>
              </div>

              <div className="p-3 bg-muted/60 rounded-lg border border-border space-y-1">
                <span className="font-bold text-foreground block text-xs">3. Google Cloud Console</span>
                <p>Nas credenciais OAuth 2.0, adicione em <i>URIs de redirecionamento autorizados</i>:</p>
                <code className="block p-1 bg-background rounded font-mono text-[11px] text-foreground border border-border/50">
                  https://rjppcterrcbekbspqqmi.supabase.co/auth/v1/callback
                </code>
              </div>
            </div>

            <Button
              onClick={() => setGoogleSetupHelpOpen(false)}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold"
            >
              Entendido
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AuthPage;
