'use client';

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'app.lowStockThreshold';
const DEFAULT_THRESHOLD = 10;

function readThreshold(): number {
  if (typeof window === 'undefined') return DEFAULT_THRESHOLD;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v == null) return DEFAULT_THRESHOLD;
    const n = parseInt(v, 10);
    return Number.isNaN(n) || n < 0 ? DEFAULT_THRESHOLD : n;
  } catch {
    return DEFAULT_THRESHOLD;
  }
}

/**
 * Umbral de stock mínimo para alertas (productos con stock ≤ este valor se consideran "stock bajo").
 * Persistido en localStorage. Por defecto 10.
 */
export function useLowStockThreshold(): [number, (value: number) => void] {
  const [value, setValueState] = useState(DEFAULT_THRESHOLD);

  useEffect(() => {
    setValueState(readThreshold());
  }, []);

  const setValue = useCallback((n: number) => {
    const safe = n >= 0 ? Math.floor(n) : DEFAULT_THRESHOLD;
    setValueState(safe);
    try {
      localStorage.setItem(STORAGE_KEY, String(safe));
    } catch {
      // ignore
    }
  }, []);

  return [value, setValue];
}
