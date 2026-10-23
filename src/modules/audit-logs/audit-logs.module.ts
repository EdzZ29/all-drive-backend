import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditLogsController } from './audit-logs.controller';
import { AuditLogsService } from './audit-logs.service';
import { AuditLog } from './entities/audit-log.entity';
import { User } from '../users/entities/user.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Inquiry } from '../inquiries/entities/inquiry.entity';
import { ChatConversation } from '../chat/entities/chat-conversation.entity';
import { Vehicle } from '../vehicles/entities/vehicles.entity';

// Global so any module can record activity without importing this one.
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuditLog,
      User,
      Booking,
      Inquiry,
      ChatConversation,
      Vehicle,
    ]),
  ],
  controllers: [AuditLogsController],
  providers: [AuditLogsService],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
