import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Booking } from '../bookings/entities/booking.entity';
import { Inquiry } from '../inquiries/entities/inquiry.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { Vehicle } from '../vehicles/entities/vehicles.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Booking, Inquiry, Notification, Vehicle]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
