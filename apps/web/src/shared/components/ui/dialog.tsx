'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@lib/utils';

type DialogContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext() {
  const ctx = React.useContext(DialogContext);
  if (!ctx) throw new Error('Dialog components must be used within Dialog');
  return ctx;
}

const Dialog = ({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? (onOpenChange ?? (() => {})) : setInternalOpen;

  const value: DialogContextValue = React.useMemo(
    () => ({
      open: isOpen,
      onOpenChange: setIsOpen,
    }),
    [isOpen, setIsOpen]
  );

  return (
    <DialogContext.Provider value={value}>
      {children}
    </DialogContext.Provider>
  );
};

const DialogTrigger = ({
  children,
  asChild,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  children: React.ReactNode;
}) => {
  const { onOpenChange } = useDialogContext();
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
      onClick: () => onOpenChange(true),
    });
  }
  return (
    <button type="button" onClick={() => onOpenChange(true)} {...props}>
      {children}
    </button>
  );
};

const DialogPortal = ({ children }: { children: React.ReactNode }) => {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
};

const DialogOverlay = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/40 animate-in fade-in-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = 'DialogOverlay';

type DialogContentProps = React.HTMLAttributes<HTMLDivElement> & {
  showClose?: boolean;
  onPointerDownOutside?: (e: React.PointerEvent) => void;
  onEscapeKeyDown?: (e: React.KeyboardEvent) => void;
};

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, showClose = true, onPointerDownOutside, onEscapeKeyDown, ...props }, ref) => {
    const { open, onOpenChange } = useDialogContext();

    React.useEffect(() => {
      const onEscape = (e: KeyboardEvent) => {
        if (e.key !== 'Escape') return;
        if (onEscapeKeyDown) {
          onEscapeKeyDown(e as unknown as React.KeyboardEvent);
          if (!e.defaultPrevented) onOpenChange(false);
        } else {
          onOpenChange(false);
        }
      };
      if (open) {
        document.addEventListener('keydown', onEscape);
        document.body.style.overflow = 'hidden';
      }
      return () => {
        document.removeEventListener('keydown', onEscape);
        document.body.style.overflow = '';
      };
    }, [open, onOpenChange, onEscapeKeyDown]);

    if (!open) return null;

    const handleOverlayPointerDown = (e: React.PointerEvent) => {
      if (onPointerDownOutside) {
        onPointerDownOutside(e);
      }
      if (!e.defaultPrevented) onOpenChange(false);
    };

    return createPortal(
      <>
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in"
          aria-hidden
          onPointerDown={handleOverlayPointerDown}
        />
        <div
          ref={ref}
          role="dialog"
          aria-modal
          className={cn(
            'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg max-h-[90vh] overflow-y-auto translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-background p-4 shadow-xl sm:rounded-xl sm:p-6 animate-fade-in-up',
            className
          )}
          onClick={(e) => e.stopPropagation()}
          {...props}
        >
          {children}
          {showClose && (
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute right-4 top-4 rounded-lg opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-opacity duration-200"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </>,
      document.body
    );
  }
);
DialogContent.displayName = 'DialogContent';

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-1.5 text-center sm:text-left',
      className
    )}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
DialogTitle.displayName = 'DialogTitle';

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
DialogDescription.displayName = 'DialogDescription';

const DialogClose = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const { onOpenChange } = useDialogContext();
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onOpenChange(false)}
      className={className}
      {...props}
    >
      {children}
    </button>
  );
});
DialogClose.displayName = 'DialogClose';

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
