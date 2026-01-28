export type AuthUser = {
  id: string;
  email: string;
  role: 'ADMIN' | 'USER';
};

export type LoginResponse = {
  accessToken: string;
};

