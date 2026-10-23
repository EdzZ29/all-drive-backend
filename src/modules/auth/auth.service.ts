import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { UsersService } from '../users/users.service';
import { User, UserRole } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/account.dto';
import { JwtPayload } from './auth.types';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditActorType } from '../audit-logs/entities/audit-log.entity';

@Injectable()
export class AuthService {
  private static readonly SALT_ROUNDS = 10;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly audit: AuditLogsService,
  ) {}

  // Admin-provisioned account. There is no public self-registration.
  async createAccount(dto: RegisterDto, role: UserRole) {
    const password = await bcrypt.hash(dto.password, AuthService.SALT_ROUNDS);

    const user = await this.usersService.create({
      name: dto.name,
      email: dto.email.toLowerCase(),
      password,
      phone: dto.phone,
      role,
    });
    this.audit.record({
      action: 'admin.created',
      entityType: 'admin',
      entityId: user.id,
      entityLabel: user.name,
      summary: `Added admin ${user.name} (${user.email})`,
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(
      dto.email.toLowerCase(),
    );

    // Same error whether the email is unknown or the password is wrong,
    // so we don't leak which emails exist.
    const failed = (why: string) => {
      this.audit.record({
        action: 'account.login_failed',
        entityType: 'account',
        entityId: user?.id ?? null,
        entityLabel: dto.email,
        summary: `Failed sign-in for ${dto.email} (${why})`,
        actor: { type: AuditActorType.SYSTEM, name: 'Sign-in page' },
      });
    };
    if (!user) {
      failed('unknown email');
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) {
      failed('wrong password');
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      failed('account turned off');
      throw new UnauthorizedException('Account is disabled');
    }

    this.audit.record({
      action: 'account.login',
      entityType: 'account',
      entityId: user.id,
      entityLabel: user.name,
      summary: `${user.name} signed in`,
      actor: { type: AuditActorType.ADMIN, id: user.id, name: user.name },
    });
    return this.buildAuthResponse(user);
  }

  // Checks the current password, saves the new one, and invalidates every
  // existing session. Returns a fresh token for the session that made the change.
  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.usersService.findByIdWithPassword(userId);
    if (!user || !(await bcrypt.compare(dto.currentPassword, user.password))) {
      throw new BadRequestException('Current password is incorrect');
    }
    const hash = await bcrypt.hash(dto.newPassword, AuthService.SALT_ROUNDS);
    await this.usersService.setPassword(userId, hash);
    await this.usersService.bumpTokenVersion(userId);
    this.audit.record({
      action: 'account.password',
      entityType: 'account',
      entityId: userId,
      entityLabel: user.name,
      summary: `${user.name} changed their password (other sessions signed out)`,
    });
    return this.buildAuthResponse(await this.usersService.findOne(userId));
  }

  // Stateless JWT logout: bump tokenVersion so every existing token is rejected.
  async logout(userId: number) {
    await this.usersService.bumpTokenVersion(userId);
    this.audit.record({
      action: 'account.logout',
      entityType: 'account',
      entityId: userId,
      summary: 'Signed out',
    });
    return { message: 'Logged out successfully' };
  }

  private buildAuthResponse(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}
