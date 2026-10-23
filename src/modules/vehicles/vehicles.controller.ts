import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  // Managing the fleet is admin-only.
  @Roles(UserRole.ADMIN)
  @Post('create')
  create(@Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create(dto);
  }

  // Guests may browse the catalogue.
  @Public()
  @Get()
  findAll() {
    return this.vehiclesService.findAll();
  }

  // Guests may view vehicle details.
  @Public()
  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.vehiclesService.findOne(+id);
  }

  @Roles(UserRole.ADMIN)
  @Put(':id')
  update(@Param('id') id: number, @Body() dto: UpdateVehicleDto) {
    return this.vehiclesService.update(+id, dto);
  }

  // Hidden everywhere, but kept: POST :id/restore brings it back.
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.vehiclesService.remove(+id);
  }

  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @Post(':id/restore')
  restore(@Param('id') id: number) {
    return this.vehiclesService.restore(+id);
  }
}
