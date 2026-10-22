import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { createHash, timingSafeEqual } from 'crypto';

// Header the public website's server sends with every booking / inquiry.
export const WEBSITE_KEY_HEADER = 'x-website-key';

// Lets the public website (alldrive-website) post bookings and inquiries
// without a user account. The website calls these routes from its server, never
// from the browser, so the shared key in WEBSITE_API_KEY stays secret. Use it
// together with @Public() so the JWT guard lets the request through first.
@Injectable()
export class WebsiteKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('WEBSITE_API_KEY');
    if (!expected) {
      throw new ServiceUnavailableException(
        'Website integration is not configured (set WEBSITE_API_KEY)',
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers[WEBSITE_KEY_HEADER];
    if (typeof provided !== 'string' || !sameSecret(provided, expected)) {
      throw new UnauthorizedException('Invalid website key');
    }
    return true;
  }
}

// Constant-time comparison. Hashing first gives both sides the same length.
function sameSecret(a: string, b: string) {
  const digest = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(digest(a), digest(b));
}
