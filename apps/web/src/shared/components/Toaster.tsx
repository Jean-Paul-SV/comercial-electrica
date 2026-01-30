'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        classNames: {
          toast:
            'bg-card border border-border/80 text-foreground shadow-sm rounded-xl',
          title: 'text-foreground font-medium',
          description: 'text-muted-foreground text-sm',
          success: 'border-emerald-500/30',
          error: 'border-destructive/30',
        },
      }}
    />
  );
}
