import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';

// Every route here requires authentication (global JwtAuthGuard). Booking
// actions are further restricted to CLIENT accounts, so guests cannot reserve.
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // Reserve a vehicle — logged-in clients only.
  @Roles(UserRole.CLIENT)
  @Post()
  create(@CurrentUser('id') clientId: number, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(clientId, dto);
  }

  // A client's own bookings.
  @Roles(UserRole.CLIENT)
  @Get('me')
  findMine(@CurrentUser('id') clientId: number) {
    return this.bookingsService.findMine(clientId);
  }

  @Roles(UserRole.CLIENT)
  @Patch(':id/cancel')
  cancel(@CurrentUser('id') clientId: number, @Param('id') id: number) {
    return this.bookingsService.cancel(+id, clientId);
  }

  // Admin oversight of all bookings.
  @Roles(UserRole.ADMIN)
  @Get()
  findAll() {
    return this.bookingsService.findAll();
  }
}
