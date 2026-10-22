import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto, UpdateProfileDto } from './dto/account.dto';
import { Public } from './decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthUser } from './auth.types';
import { UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import {
  ACCESS_TOKEN_COOKIE,
  baseCookieOptions,
  durationToMs,
} from './cookie.util';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  // Admin sign-in. There is no public registration: customers use the website
  // without an account, and admins are added by another admin (POST /admins).
  // passthrough:true lets us set the auth cookie while still returning JSON.
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setAuthCookie(res, result.accessToken);
    return result;
  }

  // Clears the cookie and invalidates every token issued to this user.
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.logout(user.id);
    this.clearAuthCookie(res);
    return result;
  }

  // Returns the currently authenticated principal.
  @Get('me')
  me(@CurrentUser('id') id: number) {
    return this.usersService.findOne(id);
  }

  // Edit your own name / phone.
  @Patch('me')
  updateMe(@CurrentUser('id') id: number, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(id, dto);
  }

  // Signs out every other session, and keeps this one signed in with a new
  // cookie.
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  async changePassword(
    @CurrentUser('id') id: number,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.changePassword(id, dto);
    this.setAuthCookie(res, result.accessToken);
    return { message: 'Password changed' };
  }

  // Admin-only: provision another admin/staff account. Returns the new user
  // only; the new admin signs in with their own password.
  @Roles(UserRole.ADMIN)
  @Post('admins')
  async createAdmin(@Body() dto: RegisterDto) {
    const { user } = await this.authService.createAccount(dto, UserRole.ADMIN);
    return user;
  }

  private isProduction() {
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  private setAuthCookie(res: Response, token: string) {
    const maxAge = durationToMs(
      this.config.get<string>('JWT_EXPIRES_IN'),
      ONE_DAY_MS,
    );
    res.cookie(ACCESS_TOKEN_COOKIE, token, {
      ...baseCookieOptions(this.isProduction()),
      maxAge,
    });
  }

  private clearAuthCookie(res: Response) {
    // Options (except maxAge/expires) must match those used when setting it.
    res.clearCookie(
      ACCESS_TOKEN_COOKIE,
      baseCookieOptions(this.isProduction()),
    );
  }
}
