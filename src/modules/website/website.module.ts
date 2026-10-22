import { Module } from '@nestjs/common';

import { WebsiteController } from './website.controller';
import { BookingsModule } from '../bookings/bookings.module';
import { InquiriesModule } from '../inquiries/inquiries.module';

@Module({
  imports: [BookingsModule, InquiriesModule],
  controllers: [WebsiteController],
})
export class WebsiteModule {}
