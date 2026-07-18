import {
  Controller,
  Get,
  MessageEvent,
  Param,
  Patch,
  Sse,
} from '@nestjs/common';
import { Observable } from 'rxjs';

import { NotificationsService } from './notifications.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

// Admin-only. The global JwtAuthGuard authenticates via the httpOnly cookie
// (which EventSource sends automatically), then RolesGuard enforces ADMIN.
@Roles(UserRole.ADMIN)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  // Recent notifications for the bell dropdown.
  @Get()
  findAll() {
    return this.notifications.findRecent();
  }

  @Get('unread-count')
  unreadCount() {
    return this.notifications.unreadCount();
  }

  // Live stream of new notifications (Server-Sent Events).
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.notifications.stream();
  }

  @Patch('read-all')
  markAllRead() {
    return this.notifications.markAllRead();
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string) {
    return this.notifications.markRead(+id);
  }
}
