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
};

