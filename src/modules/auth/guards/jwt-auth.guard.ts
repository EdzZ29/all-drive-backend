import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthUser, JwtPayload } from '../auth.types';
import { UsersService } from '../../users/users.service';
import { ACCESS_TOKEN_COOKIE } from '../cookie.util';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Routes explicitly marked @Public() bypass authentication (guest access).
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) throw new UnauthorizedException('Authentication required');

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.usersService.findOne(payload.sub).catch(() => null);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is no longer active');
    }

    // Reject tokens issued before the last logout / credential change.
    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException(
        'Session has expired, please log in again',
      );
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    (request as Request & { user: AuthUser }).user = authUser;

    return true;
  }

  // Accepts the token from the httpOnly cookie (browser flow) or from an
  // Authorization: Bearer header (API clients / mobile).
  private extractToken(request: Request): string | undefined {
    const cookies = request.cookies as Record<string, string> | undefined;
    const cookieToken = cookies?.[ACCESS_TOKEN_COOKIE];
    if (typeof cookieToken === 'string' && cookieToken.length > 0) {
      return cookieToken;
    }

    const header = request.headers.authorization;
    if (!header) return undefined;
    const [type, token] = header.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
