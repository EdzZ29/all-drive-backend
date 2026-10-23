import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { IsEmail } from 'class-validator';

import { BookingsService } from './bookings.service';
import {
  UpdateBookingDto,
  UpdateBookingStatusDto,
} from './dto/update-booking.dto';
import { BookingsQueryDto } from './dto/bookings-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

class ConfirmationSentDto {
  @IsEmail()
  to!: string;
}

// Admin management of bookings. New bookings arrive from the public website
// through WebsiteController (POST /website/bookings), not from here.
@Roles(UserRole.ADMIN)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // ?filter=Pending|Active|History|All&page=&limit=&q=
  @Get()
  list(@Query() query: BookingsQueryDto) {
    return this.bookingsService.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.bookingsService.findOne(id);
  }

  // Approve / decline / mark returned / complete / cancel. Approving also emails
  // the customer a confirmation (the response says whether it was sent).
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    return this.bookingsService.updateStatus(id, dto);
  }

  // Send the confirmation email again (e.g. after fixing the email).
  @HttpCode(HttpStatus.OK)
  @Post(':id/confirmation-email')
  resendConfirmation(@Param('id', ParseIntPipe) id: number) {
    return this.bookingsService.resendConfirmation(id);
  }

  // The approval email, ready for the website to send when this server can't.
  @Get(':id/confirmation-email')
  confirmationEmail(@Param('id', ParseIntPipe) id: number) {
    return this.bookingsService.confirmationEmail(id);
  }

  // The website sent the approval email.
  @HttpCode(HttpStatus.OK)
  @Post(':id/confirmation-email/sent')
  confirmationSent(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmationSentDto,
  ) {
    return this.bookingsService.confirmationSent(id, dto.to);
  }

  // Reschedule, assign a vehicle, set the final price, record payment, notes.
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBookingDto) {
    return this.bookingsService.update(id, dto);
  }

  // Hidden everywhere, but kept: POST :id/restore brings it back.
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.bookingsService.remove(id);
  }

  @HttpCode(HttpStatus.OK)
  @Post(':id/restore')
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.bookingsService.restore(id);
  }
}
