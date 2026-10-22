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

@Injectable()
export class AuthService {
  private static readonly SALT_ROUNDS = 10;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
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

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailWithPassword(
      dto.email.toLowerCase(),
    );

    // Same error whether the email is unknown or the password is wrong,
    // so we don't leak which emails exist.
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

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
    return this.buildAuthResponse(await this.usersService.findOne(userId));
  }

  // Stateless JWT logout: bump tokenVersion so every existing token is rejected.
  async logout(userId: number) {
    await this.usersService.bumpTokenVersion(userId);
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
