/**
 * Cola de operaciones pendientes cuando falla la red (Resiliencia nivel B).
 * Almacena en localStorage; al volver online se reenvían con el mismo Idempotency-Key.
 * Ver docs/RESILIENCIA_Y_SINCRONIZACION.md
 */

const STORAGE_KEY = 'ce_offline_queue';

export type PendingOperation = {
  id: string;
  idempotencyKey: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  createdAt: string;
  label?: string;
};

type Listener = (items: PendingOperation[]) => void;
const listeners: Set<Listener> = new Set();

function readFromStorage(): PendingOperation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingOperation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeToStorage(items: PendingOperation[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    listeners.forEach((fn) => fn(items));
  } catch {
    // ignore
  }
}

export function getPendingQueue(): PendingOperation[] {
  return readFromStorage();
}

export function addToQueue(item: Omit<PendingOperation, 'createdAt'>): void {
  const items = readFromStorage();
  const withDate: PendingOperation = {
    ...item,
    createdAt: new Date().toISOString(),
  };
  if (items.some((i) => i.id === item.id || i.idempotencyKey === item.idempotencyKey)) {
    return;
  }
  items.unshift(withDate);
  writeToStorage(items);
}

export function removeFromQueue(id: string): void {
  const items = readFromStorage().filter((i) => i.id !== id);
  writeToStorage(items);
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener(readFromStorage());
  return () => listeners.delete(listener);
}
