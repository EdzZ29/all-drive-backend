import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../auth.types';

// Injects the authenticated user (attached by JwtAuthGuard) into a handler.
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = request.user;
    return data && user ? user[data] : user;
  },
);
