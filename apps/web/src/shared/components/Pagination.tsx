'use client';

import { useState, useCallback } from 'react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { cn } from '@lib/utils';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type PaginationProps = {
  meta: PaginationMeta | undefined;
  onPageChange: (page: number) => void;
  className?: string;
  label?: string;
};

export function Pagination({
  meta,
  onPageChange,
  className,
  label = 'Página',
}: PaginationProps) {
  const [goToPageValue, setGoToPageValue] = useState('');

  const goToPage = useCallback(() => {
    if (!meta) return;
    const num = parseInt(goToPageValue, 10);
    if (Number.isNaN(num) || num < 1 || num > meta.totalPages) return;
    onPageChange(num);
    setGoToPageValue('');
  }, [meta, goToPageValue, onPageChange]);

  if (!meta) return null;

  const { page, totalPages, hasPreviousPage, hasNextPage } = meta;

  const start = (page - 1) * meta.limit + 1;
  const end = Math.min(page * meta.limit, meta.total);
  const rangeText = meta.total > 0 ? `${start}–${end} de ${meta.total}` : '0 resultados';

  const showGoTo = totalPages > 3;

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 text-sm text-muted-foreground',
        className
      )}
    >
      <span className="text-muted-foreground order-2 sm:order-1 text-center sm:text-left">
        {label} {page} de {totalPages}
        {meta.total > 0 && (
          <span className="ml-1.5 font-normal">· {rangeText}</span>
        )}
      </span>
      <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 order-1 sm:order-2">
        {showGoTo && (
          <div className="flex items-center gap-1.5 mr-1">
            <Input
              type="number"
              min={1}
              max={totalPages}
              value={goToPageValue}
              onChange={(e) => setGoToPageValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), goToPage())}
              placeholder={String(page)}
              className="h-9 w-14 text-center rounded-lg text-sm tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              aria-label="Número de página"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={goToPage}
              className="h-9 px-2.5 shrink-0"
              aria-label="Ir a página"
            >
              Ir
            </Button>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          {showGoTo && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(1)}
              disabled={!hasPreviousPage}
              className="h-9 w-9 min-w-[2.25rem] p-0 shrink-0"
              aria-label="Primera página"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={!hasPreviousPage}
            className="h-9 w-9 min-w-[2.25rem] p-0 shrink-0"
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={!hasNextPage}
            className="h-9 w-9 min-w-[2.25rem] p-0 shrink-0"
            aria-label="Página siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {showGoTo && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(totalPages)}
              disabled={!hasNextPage}
              className="h-9 w-9 min-w-[2.25rem] p-0 shrink-0"
              aria-label="Última página"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
