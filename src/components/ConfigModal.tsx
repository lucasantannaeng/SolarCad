import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Settings, Link2, Sparkles, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({ open, onOpenChange }) => {
  // Supabase state
  const [supabaseUrl, setSupabaseUrl] = useState(() => localStorage.getItem('CUSTOM_SUPABASE_URL') || import.meta.env.VITE_SUPABASE_URL || '');
  const [supabaseKey, setSupabaseKey] = useState(() => localStorage.getItem('CUSTOM_SUPABASE_ANON_KEY') || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '');
  const [showSupabaseKey, setShowSupabaseKey] = useState(false);

  // AI State
  const [aiProvider, setAiProvider] = useState(() => localStorage.getItem('CUSTOM_AI_PROVIDER') || 'gemini');
  const [aiApiKey, setAiApiKey] = useState(() => localStorage.getItem('CUSTOM_AI_API_KEY') || '');
  const [showAiKey, setShowAiKey] = useState(false);

  const handleSave = () => {
    // Save Supabase
    if (supabaseUrl.trim()) localStorage.setItem('CUSTOM_SUPABASE_URL', supabaseUrl.trim());
    else localStorage.removeItem('CUSTOM_SUPABASE_URL');

    if (supabaseKey.trim()) localStorage.setItem('CUSTOM_SUPABASE_ANON_KEY', supabaseKey.trim());
    else localStorage.removeItem('CUSTOM_SUPABASE_ANON_KEY');

    // Save AI
    localStorage.setItem('CUSTOM_AI_PROVIDER', aiProvider);
    if (aiApiKey.trim()) localStorage.setItem('CUSTOM_AI_API_KEY', aiApiKey.trim());
    else localStorage.removeItem('CUSTOM_AI_API_KEY');

    toast.success('Configurações salvas com sucesso! Recarregando...');
    setTimeout(() => window.location.reload(), 800);
  };

  const handleReset = () => {
    localStorage.removeItem('CUSTOM_SUPABASE_URL');
    localStorage.removeItem('CUSTOM_SUPABASE_ANON_KEY');
    localStorage.removeItem('CUSTOM_AI_PROVIDER');
    localStorage.removeItem('CUSTOM_AI_API_KEY');

    toast.info('Restaurado para variáveis de ambiente padrão.');
    setTimeout(() => window.location.reload(), 800);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Settings className="w-4 h-4 text-brand-500" />
            Configuração de Conexão & Chaves de IA
          </DialogTitle>
          <DialogDescription className="text-xs">
            Configure seu próprio projeto Supabase e chave de IA para usar o SolarCAD de forma independente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Supabase Section */}
          <div className="space-y-2 p-3 bg-muted/40 rounded-lg border border-border">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Link2 className="w-3.5 h-3.5 text-brand-500" />
              Conexão Supabase (OCR & Backend)
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Supabase Project URL</Label>
              <input
                type="text"
                className="w-full text-xs p-2 rounded border border-input bg-background font-mono"
                placeholder="https://xyzcompany.supabase.co"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Supabase Anon Key</Label>
              <div className="relative">
                <input
                  type={showSupabaseKey ? 'text' : 'password'}
                  className="w-full text-xs p-2 pr-8 rounded border border-input bg-background font-mono"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowSupabaseKey(!showSupabaseKey)}
                  className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                >
                  {showSupabaseKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* AI Provider Section */}
          <div className="space-y-2 p-3 bg-muted/40 rounded-lg border border-border">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Sparkles className="w-3.5 h-3.5 text-brand-500" />
              Provedor de Inteligência Artificial
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Provedor</Label>
              <select
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value)}
                className="w-full text-xs p-2 rounded border border-input bg-background"
              >
                <option value="gemini">Google Gemini Oficial (Recomendado / Gratuito)</option>
                <option value="groq">Groq (Ultra-rápido Llama 3)</option>
                <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
                <option value="openrouter">OpenRouter (Multi-modelos)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Chave de API (Opcional)</Label>
              <div className="relative">
                <input
                  type={showAiKey ? 'text' : 'password'}
                  className="w-full text-xs p-2 pr-8 rounded border border-input bg-background font-mono"
                  placeholder="Cole sua API Key (ex: AIzaSy..., gsk_..., sk-...)"
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowAiKey(!showAiKey)}
                  className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                >
                  {showAiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs text-muted-foreground">
            Restaurar Padrão
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} className="text-xs bg-brand-500 hover:bg-brand-600 text-white">
              <CheckCircle className="w-3.5 h-3.5 mr-1" /> Salvar Configurações
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
