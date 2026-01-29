'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        classNames: {
          toast: 'bg-card border border-border text-foreground shadow-lg',
          title: 'text-foreground',
          description: 'text-muted-foreground',
          success: 'border-green-500/50',
          error: 'border-destructive/50',
        },
      }}
    />
  );
}
