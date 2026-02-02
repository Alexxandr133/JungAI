export type UserRole = 'psychologist' | 'client' | 'researcher' | 'admin' | 'guest';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}
