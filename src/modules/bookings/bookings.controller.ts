import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { BookingsService } from './bookings.service';
import {
  UpdateBookingDto,
  UpdateBookingStatusDto,
} from './dto/update-booking.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

// Admin management of bookings. New bookings arrive from the public website
// through WebsiteController (POST /website/bookings), not from here.
@Roles(UserRole.ADMIN)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  findAll() {
    return this.bookingsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.bookingsService.findOne(+id);
  }

  // Approve / decline / mark returned / complete / cancel. Approving also emails
  // and texts the customer a confirmation (the response says what was sent).
  @Patch(':id/status')
  updateStatus(@Param('id') id: number, @Body() dto: UpdateBookingStatusDto) {
    return this.bookingsService.updateStatus(+id, dto);
  }

  // Send the confirmation email and text again (e.g. after fixing the email).
  @HttpCode(HttpStatus.OK)
  @Post(':id/confirmation-email')
  resendConfirmation(@Param('id') id: number) {
    return this.bookingsService.resendConfirmation(+id);
  }

  // Reschedule, assign a vehicle, set the final price, record payment, notes.
  @Patch(':id')
  update(@Param('id') id: number, @Body() dto: UpdateBookingDto) {
    return this.bookingsService.update(+id, dto);
  }
}
