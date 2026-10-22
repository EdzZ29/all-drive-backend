import { Module } from '@nestjs/common';

import { WebsiteController } from './website.controller';
import { BookingsModule } from '../bookings/bookings.module';
import { InquiriesModule } from '../inquiries/inquiries.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [BookingsModule, InquiriesModule, ChatModule],
  controllers: [WebsiteController],
})
export class WebsiteModule {}
