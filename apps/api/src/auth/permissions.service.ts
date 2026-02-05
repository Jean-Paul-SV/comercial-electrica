import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoleName } from '@prisma/client';

/**
 * Permisos en formato "resource:action".
 * Usado para fallback cuando el usuario no tiene UserRole (solo role legacy).
 */
/** Lista completa de permisos (recurso:accion) para fallback ADMIN cuando BD sin seed. */
const ALL_PERMISSION_SLUGS = [
  'sales:create',
  'sales:read',
  'sales:update',
  'sales:delete',
  'sales:manage',
  'quotes:create',
  'quotes:read',
  'quotes:update',
  'quotes:delete',
  'quotes:manage',
  'returns:create',
  'returns:read',
  'returns:update',
  'returns:delete',
  'cash:create',
  'cash:read',
  'cash:update',
  'cash:manage',
  'expenses:create',
  'expenses:read',
  'expenses:update',
  'expenses:delete',
  'inventory:create',
  'inventory:read',
  'inventory:update',
  'inventory:manage',
  'catalog:create',
  'catalog:read',
  'catalog:update',
  'catalog:delete',
  'catalog:manage',
  'customers:create',
  'customers:read',
  'customers:update',
  'customers:delete',
  'suppliers:create',
  'suppliers:read',
  'suppliers:update',
  'suppliers:delete',
  'purchases:create',
  'purchases:read',
  'purchases:update',
  'purchases:manage',
  'supplier-invoices:create',
  'supplier-invoices:read',
  'supplier-invoices:update',
  'supplier-invoices:manage',
  'reports:read',
  'reports:manage',
  'audit:read',
  'audit:manage',
  'backups:read',
  'backups:manage',
  'dian:read',
  'dian:manage',
  'users:create',
  'users:read',
  'users:update',
  'users:delete',
  'users:manage',
] as const;

const DEFAULT_PERMISSIONS_BY_ROLE: Record<RoleName, string[]> = {
  [RoleName.ADMIN]: ['*'], // bypass: tiene todo
  [RoleName.USER]: [
    'sales:read',
    'sales:create',
    'quotes:read',
    'quotes:create',
    'quotes:update',
    'returns:read',
    'returns:create',
    'cash:read',
    'cash:create',
    'cash:update',
    'expenses:read',
    'expenses:create',
    'catalog:read',
    'customers:read',
    'customers:create',
    'inventory:read',
    'reports:read',
  ],
};

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Devuelve la lista de permisos efectivos del usuario (resource:action).
   * Si tiene UserRole + Role + RolePermission, se resuelven desde BD.
   * Si no tiene UserRole, se usa el rol legacy (ADMIN => todo, USER => DEFAULT_PERMISSIONS_BY_ROLE).
   */
  async getEnabledPermissionsForUser(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        userRoles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });
    if (!user) return [];

    // Administrador siempre tiene todos los permisos (incl. users:read) aunque tenga roles RBAC.
    if (user.role === RoleName.ADMIN) {
      return await this.getAllPermissionSlugs();
    }

    const hasRbacRoles = user.userRoles.length > 0;
    if (hasRbacRoles) {
      const slugs = new Set<string>();
      for (const ur of user.userRoles) {
        for (const rp of ur.role.permissions) {
          slugs.add(`${rp.permission.resource}:${rp.permission.action}`);
        }
      }
      return Array.from(slugs);
    }

    // Fallback: rol legacy
    const legacy = DEFAULT_PERMISSIONS_BY_ROLE[user.role];
    if (legacy.includes('*')) {
      return await this.getAllPermissionSlugs();
    }
    return legacy;
  }

  /** Devuelve todos los slugs (resource:action) existentes en BD, o lista por defecto si BD vacía. */
  private async getAllPermissionSlugs(): Promise<string[]> {
    const list = await this.prisma.permission.findMany({
      select: { resource: true, action: true },
    });
    if (list.length > 0) {
      return list.map((p) => `${p.resource}:${p.action}`);
    }
    return [...ALL_PERMISSION_SLUGS];
  }

  /** Indica si el usuario tiene al menos uno de los permisos requeridos (o *). */
  async userHasAnyPermission(
    userId: string,
    required: string[],
  ): Promise<boolean> {
    const userPerms = await this.getEnabledPermissionsForUser(userId);
    if (userPerms.includes('*')) return true;
    return required.some((r) => userPerms.includes(r));
  }
}
