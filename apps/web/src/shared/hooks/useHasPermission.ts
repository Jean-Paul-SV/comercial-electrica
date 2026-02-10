import { useAuth } from '@shared/providers/AuthProvider';

/**
 * Hook para verificar si el usuario tiene un permiso específico.
 * @param permission - El permiso a verificar (ej. 'cash:create', 'sales:update')
 * @returns true si el usuario tiene el permiso, false en caso contrario
 */
export function useHasPermission(permission: string): boolean {
  const { permissions } = useAuth();
  return permissions.includes(permission);
}
