import {
  Body,
  Controller,
  Get,
  MessageEvent,
  Param,
  Patch,
  Post,
  Sse,
} from '@nestjs/common';
import { Observable } from 'rxjs';

import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import {
  UpdateBookingDto,
  UpdateBookingStatusDto,
} from './dto/update-booking.dto';
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

  // Live stream of the client's own booking changes (SSE). Lets the client's
  // dashboard reflect admin approvals/completions without a refresh.
  @Roles(UserRole.CLIENT)
  @Sse('stream')
  stream(@CurrentUser('id') clientId: number): Observable<MessageEvent> {
    return this.bookingsService.streamForClient(clientId);
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

  // Admin: approve / decline / mark returned / complete a booking.
  @Roles(UserRole.ADMIN)
  @Patch(':id/status')
  updateStatus(@Param('id') id: number, @Body() dto: UpdateBookingStatusDto) {
    return this.bookingsService.updateStatus(+id, dto);
  }

  // Admin: adjust the booking's dates, handover time/place/method, or notes.
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: number, @Body() dto: UpdateBookingDto) {
    return this.bookingsService.update(+id, dto);
  }
}
