import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';

import {
  AuditActorType,
  AuditEntityType,
  AuditLog,
} from './entities/audit-log.entity';
import { AuditQueryDto } from './dto/audit-query.dto';
import { currentRequest } from '../../common/request-context';
import { likePattern, Page, pageOf } from '../../common/pagination';
import type { AuthUser } from '../auth/auth.types';
import { User } from '../users/entities/user.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { Inquiry } from '../inquiries/entities/inquiry.entity';
import { ChatConversation } from '../chat/entities/chat-conversation.entity';
import { Vehicle } from '../vehicles/entities/vehicles.entity';

export interface AuditActor {
  type: AuditActorType;
  id?: number | null;
  name: string;
}

export interface AuditEntry {
  action: string;
  entityType: AuditEntityType;
  entityId?: number | null;
  entityLabel?: string;
  summary: string;
  details?: Record<string, unknown> | null;
  // Defaults to whoever made the current request (an admin, or the website).
  actor?: AuditActor;
}

// Entries for deleted items carry `canRestore` while the item is still deleted.
export type AuditListItem = AuditLog & { canRestore?: boolean };

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);
  // Admin names by id, so every entry doesn't need a lookup.
  private readonly names = new Map<number, string>();

  constructor(
    @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Booking) private readonly bookings: Repository<Booking>,
    @InjectRepository(Inquiry) private readonly inquiries: Repository<Inquiry>,
    @InjectRepository(ChatConversation)
    private readonly chats: Repository<ChatConversation>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
  ) {}

  /** Adds an entry. Never throws: logging must not break the action itself. */
  record(entry: AuditEntry) {
    void this.write(entry).catch((err) =>
      this.logger.error(
        `Activity log entry "${entry.action}" not saved: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
  }

  async list(query: AuditQueryDto): Promise<Page<AuditListItem>> {
    const { page, limit, skip } = pageOf(query);
    const qb = this.repo
      .createQueryBuilder('l')
      .orderBy('l.createdAt', 'DESC')
      .addOrderBy('l.id', 'DESC')
      .skip(skip)
      .take(limit);
    if (query.entityType) {
      qb.andWhere('l.entityType = :type', { type: query.entityType });
    }
    const like = likePattern(query.q);
    if (like) {
      qb.andWhere(
        '(l.summary ILIKE :like OR l.entityLabel ILIKE :like OR l.actorName ILIKE :like)',
        { like },
      );
    }
    const [items, total] = await qb.getManyAndCount();
    return { items: await this.withRestoreFlags(items), total, page, limit };
  }

  // ---------- Helpers ----------

  private async write(entry: AuditEntry) {
    const actor = entry.actor ?? (await this.currentActor());
    await this.repo.save(
      this.repo.create({
        actorType: actor.type,
        actorId: actor.id ?? null,
        actorName: clip(actor.name, 120),
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        entityLabel: clip(entry.entityLabel ?? '', 160),
        summary: clip(entry.summary, 500),
        details: entry.details ?? null,
      }),
    );
  }

  private async currentActor(): Promise<AuditActor> {
    const req = currentRequest();
    const user = (req as { user?: AuthUser } | undefined)?.user;
    if (user?.id) {
      return {
        type: AuditActorType.ADMIN,
        id: user.id,
        name: await this.adminName(user),
      };
    }
    if (req?.originalUrl?.startsWith('/api/website/')) {
      return { type: AuditActorType.WEBSITE, name: 'Website visitor' };
    }
    return { type: AuditActorType.SYSTEM, name: 'System' };
  }

  private async adminName(user: AuthUser) {
    const known = this.names.get(user.id);
    if (known) return known;
    const row = await this.users.findOne({
      where: { id: user.id },
      withDeleted: true,
    });
    const name = row?.name || user.email;
    this.names.set(user.id, name);
    return name;
  }

  /** An admin renamed themselves: later entries use the new name. */
  forgetName(userId: number) {
    this.names.delete(userId);
  }

  // Marks "deleted" entries whose item is still deleted (so it can be restored).
  private async withRestoreFlags(items: AuditLog[]): Promise<AuditListItem[]> {
    const repos: Partial<Record<AuditEntityType, Repository<{ id: number }>>> =
      {
        booking: this.bookings,
        inquiry: this.inquiries,
        chat: this.chats,
        vehicle: this.vehicles,
        admin: this.users,
      };
    const deletedIds = new Map<AuditEntityType, Set<number>>();
    await Promise.all(
      (Object.keys(repos) as AuditEntityType[]).map(async (type) => {
        const ids = items
          .filter(
            (i) =>
              i.entityType === type &&
              i.action.endsWith('.deleted') &&
              i.entityId,
          )
          .map((i) => i.entityId!);
        if (!ids.length) return;
        const rows = await repos[type]!.find({
          select: { id: true },
          where: { id: In(ids), deletedAt: Not(IsNull()) } as never,
          withDeleted: true,
        });
        deletedIds.set(type, new Set(rows.map((r) => r.id)));
      }),
    );
    return items.map((i) =>
      i.action.endsWith('.deleted') && i.entityId
        ? {
            ...i,
            canRestore: deletedIds.get(i.entityType)?.has(i.entityId) ?? false,
          }
        : i,
    );
  }
}
