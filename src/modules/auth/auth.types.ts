import { UserRole } from '../users/entities/user.entity';

// Shape of the JWT payload we sign.
export interface JwtPayload {
  sub: number; // user id
  email: string;
  role: UserRole;
  tokenVersion: number;
}

// The authenticated principal attached to the request by JwtAuthGuard.
export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
}
