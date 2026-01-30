'use client';

import { cn } from '@lib/utils';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

type EmptyStateProps = {
  message: string;
  description?: string;
  icon?: LucideIcon;
  className?: string;
};

export function EmptyState({
  message,
  description,
  icon: Icon = Inbox,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
      role="status"
      aria-label={message}
    >
      <Icon className="h-10 w-10 text-muted-foreground/60 mb-3 shrink-0" aria-hidden />
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
      {description && (
        <p className="text-xs text-muted-foreground/80 mt-1 max-w-sm">{description}</p>
      )}
    </div>
  );
}
