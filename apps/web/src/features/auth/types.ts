export type AuthUser = {
  id: string;
  email: string;
  role: 'ADMIN' | 'USER';
  profilePictureUrl?: string | null;
};

/** Usuario en lista (GET /auth/users). */
export type UserListItem = {
  id: string;
  email: string;
  name?: string | null;
  role: 'ADMIN' | 'USER';
  profilePictureUrl?: string | null;
  createdAt: string;
};

export type MeResponse = {
  user: AuthUser;
  permissions: string[];
  /** true cuando el usuario no pertenece a ningún tenant (admin de plataforma). */
  isPlatformAdmin?: boolean;
  tenant?: {
    id: string;
    name: string;
    plan?: { name: string; slug: string };
    enabledModules: string[];
  };
};

export type LoginResponse = {
  accessToken: string;
  /** Si true, el usuario debe cambiar la contraseña (ej. temporal). */
  mustChangePassword?: boolean;
  /** Si true, redirigir al panel del proveedor (gestión empresas/suscripciones). */
  isPlatformAdmin?: boolean;
};

