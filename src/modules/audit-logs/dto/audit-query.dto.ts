import { IsIn, IsOptional } from 'class-validator';

import { PageQueryDto } from '../../../common/pagination';
import type { AuditEntityType } from '../entities/audit-log.entity';

export const AUDIT_ENTITY_TYPES: AuditEntityType[] = [
  'booking',
  'inquiry',
  'chat',
  'vehicle',
  'admin',
  'catalog',
  'account',
];

export class AuditQueryDto extends PageQueryDto {
  @IsOptional()
  @IsIn(AUDIT_ENTITY_TYPES)
  entityType?: AuditEntityType;
}
