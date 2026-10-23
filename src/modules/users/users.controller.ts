import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { IsBoolean } from 'class-validator';

import { UsersService } from './users.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from './entities/user.entity';

class SetActiveDto {
  @IsBoolean()
  isActive!: boolean;
}

// Admin-only user directory.
@Controller('users')
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.usersService.findOne(+id);
  }

  // Turn an admin account off (can't sign in) or back on.
  @Patch(':id/active')
  setActive(
    @Param('id') id: number,
    @Body() dto: SetActiveDto,
    @CurrentUser('id') actingUserId: number,
  ) {
    return this.usersService.setActive(+id, dto.isActive, actingUserId);
  }

  // Hidden and signed out, but kept: POST :id/restore brings it back.
  @Delete(':id')
  remove(@Param('id') id: number, @CurrentUser('id') actingUserId: number) {
    return this.usersService.remove(+id, actingUserId);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/restore')
  restore(@Param('id') id: number) {
    return this.usersService.restore(+id);
  }
}
