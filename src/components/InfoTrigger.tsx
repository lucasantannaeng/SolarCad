import React from 'react';
import { HelpCircle } from 'lucide-react';
import { HELP, HelpEntry } from '@/constants/helpContent';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface InfoTriggerProps {
  /** Key from HELP constant, or a custom HelpEntry */
  helpKey?: string;
  entry?: HelpEntry;
  size?: number;
}

export const InfoTrigger: React.FC<InfoTriggerProps> = ({ helpKey, entry, size = 14 }) => {
  const content = entry || (helpKey ? HELP[helpKey] : null);
  if (!content) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground/50 hover:text-primary transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label={`Ajuda: ${content.title}`}
        >
          <HelpCircle size={size} />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <HelpCircle size={18} className="text-primary shrink-0" />
            {content.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p className="leading-relaxed">{content.description}</p>
          {content.example && (
            <div className="bg-muted rounded-md p-3 border border-border">
              <span className="text-xs font-semibold text-foreground block mb-1">💡 Exemplo / Dica</span>
              <p className="whitespace-pre-line text-xs leading-relaxed">{content.example}</p>
            </div>
          )}
          {content.norm && (
            <div className="bg-primary/5 rounded-md p-3 border border-primary/10">
              <span className="text-xs font-semibold text-primary block mb-1">📐 Referência Normativa</span>
              <p className="text-xs leading-relaxed text-foreground/80">{content.norm}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
