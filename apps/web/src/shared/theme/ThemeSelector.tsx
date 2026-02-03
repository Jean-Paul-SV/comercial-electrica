'use client';

import { useRef, useEffect, useState } from 'react';
import { Palette, Sun, Moon, Check } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { cn } from '@lib/utils';
import { useTheme } from './ThemeProvider';
import { THEME_PRESETS, type ThemeId } from './themes';

type ThemeSelectorProps = {
  /** En sidebar colapsado: solo icono. */
  collapsed?: boolean;
  className?: string;
};

export function ThemeSelector({ collapsed = false, className }: ThemeSelectorProps) {
  const { colorTheme, setColorTheme, darkMode, toggleDarkMode } = useTheme();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className={cn('relative', className)}>
      <Button
        ref={triggerRef}
        variant="ghost"
        size="sm"
        className={cn(
          'gap-2 text-muted-foreground hover:text-foreground',
          collapsed && 'justify-center px-2 w-9'
        )}
        onClick={() => setOpen((o) => !o)}
        aria-label="Cambiar apariencia"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Palette className="h-4 w-4 shrink-0" />
        {!collapsed && <span>Apariencia</span>}
      </Button>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Elegir color y modo"
          className="absolute bottom-full left-0 mb-2 z-50 w-64 rounded-xl border border-border bg-popover p-3 shadow-lg animate-in fade-in duration-150"
        >
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Color de la interfaz
          </p>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {THEME_PRESETS.map((preset) => {
              const isSelected = colorTheme === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setColorTheme(preset.id as ThemeId);
                  }}
                  className={cn(
                    'relative flex flex-col items-center gap-1 rounded-lg border-2 p-2 transition-colors',
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : 'border-transparent hover:bg-muted/70'
                  )}
                  aria-pressed={isSelected}
                  aria-label={`Tema ${preset.name}`}
                >
                  <span className="relative inline-block">
                    <span
                      className="block h-7 w-7 rounded-full border-2 border-white shadow-sm ring-1 ring-black/10"
                      style={{ backgroundColor: preset.swatch }}
                    />
                    {isSelected && (
                      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/20">
                        <Check className="h-3.5 w-3.5 text-white drop-shadow" strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] font-medium text-foreground truncate w-full text-center">
                    {preset.name}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="border-t border-border pt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Modo</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={toggleDarkMode}
              aria-label={darkMode ? 'Usar modo claro' : 'Usar modo oscuro'}
            >
              {darkMode ? (
                <>
                  <Sun className="h-3.5 w-3.5" />
                  Claro
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5" />
                  Oscuro
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
