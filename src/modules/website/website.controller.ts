import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { Public } from '../auth/decorators/public.decorator';
import { WebsiteKeyGuard } from '../auth/guards/website-key.guard';
import { BookingsService } from '../bookings/bookings.service';
import { CreateBookingDto } from '../bookings/dto/create-booking.dto';
import { InquiriesService } from '../inquiries/inquiries.service';
import { CreateInquiryDto } from '../inquiries/dto/create-inquiry.dto';

// Intake from the public website (alldrive-website). Customers have no
// accounts: the website's server forwards each booking and inquiry here with
// the shared WEBSITE_API_KEY, and they appear live on the admin dashboard.
@Public()
@UseGuards(WebsiteKeyGuard)
@Controller('website')
export class WebsiteController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly inquiriesService: InquiriesService,
  ) {}

  @Post('bookings')
  createBooking(@Body() dto: CreateBookingDto) {
    return this.bookingsService.createFromWebsite(dto);
  }

  @Post('inquiries')
  createInquiry(@Body() dto: CreateInquiryDto) {
    return this.inquiriesService.createFromWebsite(dto);
  }
}
