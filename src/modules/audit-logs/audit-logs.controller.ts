import { Controller, Get, Query } from '@nestjs/common';

import { AuditLogsService } from './audit-logs.service';
import { AuditQueryDto } from './dto/audit-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

// The dashboard's activity log: who did what, newest first.
@Roles(UserRole.ADMIN)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly audit: AuditLogsService) {}

  @Get()
  list(@Query() query: AuditQueryDto) {
    return this.audit.list(query);
  }
}
