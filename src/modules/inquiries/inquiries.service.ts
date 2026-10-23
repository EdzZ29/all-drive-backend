import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Inquiry, InquiryStatus } from './entities/inquiry.entity';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { UpdateInquiryDto } from './dto/update-inquiry.dto';
import { InquiriesQueryDto } from './dto/inquiries-query.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { PushService } from '../push/push.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditActorType } from '../audit-logs/entities/audit-log.entity';
import { likePattern, pageOf } from '../../common/pagination';

@Injectable()
export class InquiriesService {
  constructor(
    @InjectRepository(Inquiry)
    private readonly repo: Repository<Inquiry>,
    private readonly notifications: NotificationsService,
    private readonly push: PushService,
    private readonly audit: AuditLogsService,
  ) {}

  // A message from the website's contact form.
  async createFromWebsite(dto: CreateInquiryDto) {
    const saved = await this.repo.save(
      this.repo.create({
        name: dto.name,
        contact: dto.contact,
        email: dto.email || null,
        topic: dto.topic,
        message: dto.message,
        page: dto.page || null,
        status: InquiryStatus.NEW,
      }),
    );

    // Fire-and-forget, like bookings: never lose the inquiry over an alert.
    this.notifications.notifyNewInquiry(saved).catch(() => undefined);
    void this.push.notifyAdminsOfInquiry(saved);
    this.audit.record({
      action: 'inquiry.created',
      entityType: 'inquiry',
      entityId: saved.id,
      entityLabel: saved.name,
      summary: `New inquiry from the website: ${saved.topic}`,
      actor: { type: AuditActorType.WEBSITE, name: saved.name },
    });

    return { id: saved.id };
  }

  // One page of the admin list, plus how many inquiries each tab has.
  async list(query: InquiriesQueryDto) {
    const { page, limit, skip } = pageOf(query);
    const filter = query.filter ?? 'All';
    const like = likePattern(query.q);
    const search = (
      qb: ReturnType<Repository<Inquiry>['createQueryBuilder']>,
    ) =>
      like
        ? qb.andWhere(
            '(i.name ILIKE :like OR i.contact ILIKE :like OR i.email ILIKE :like OR i.topic ILIKE :like OR i.message ILIKE :like)',
            { like },
          )
        : qb;

    const listQb = search(this.repo.createQueryBuilder('i'))
      .orderBy('i.createdAt', 'DESC')
      .skip(skip)
      .take(limit);
    if (filter === 'Open') {
      listQb.andWhere('i.status != :closed', { closed: InquiryStatus.CLOSED });
    } else if (filter !== 'All') {
      listQb.andWhere('i.status = :status', { status: filter });
    }
    const [[items, total], rows] = await Promise.all([
      listQb.getManyAndCount(),
      search(this.repo.createQueryBuilder('i'))
        .select('i.status', 'status')
        .addSelect('COUNT(*)::int', 'count')
        .groupBy('i.status')
        .getRawMany<{ status: InquiryStatus; count: number }>(),
    ]);
    const of = (s: InquiryStatus) =>
      Number(rows.find((r) => r.status === s)?.count ?? 0);
    const all = rows.reduce((sum, r) => sum + Number(r.count), 0);
    const counts = {
      Open: all - of(InquiryStatus.CLOSED),
      New: of(InquiryStatus.NEW),
      Contacted: of(InquiryStatus.CONTACTED),
      Closed: of(InquiryStatus.CLOSED),
      All: all,
    };
    return { items, total, page, limit, counts };
  }

  async findOne(id: number) {
    const inquiry = await this.repo.findOne({ where: { id } });
    if (!inquiry) throw new NotFoundException('Inquiry not found');
    return inquiry;
  }

  async update(id: number, dto: UpdateInquiryDto) {
    const inquiry = await this.findOne(id);
    const before = { status: inquiry.status, notes: inquiry.notes ?? '' };
    Object.assign(inquiry, {
      status: dto.status ?? inquiry.status,
      notes: dto.notes ?? inquiry.notes,
    });
    const saved = await this.repo.save(inquiry);
    const parts = [
      before.status !== saved.status &&
        `status ${before.status} → ${saved.status}`,
      before.notes !== (saved.notes ?? '') && 'notes edited',
    ].filter(Boolean);
    if (parts.length) {
      this.audit.record({
        action: 'inquiry.updated',
        entityType: 'inquiry',
        entityId: saved.id,
        entityLabel: saved.name,
        summary: `Updated inquiry from ${saved.name}: ${parts.join('; ')}`,
      });
    }
    return saved;
  }

  // Hidden everywhere, but kept so it can be restored.
  async remove(id: number) {
    const inquiry = await this.findOne(id);
    await this.repo.softDelete(id);
    this.audit.record({
      action: 'inquiry.deleted',
      entityType: 'inquiry',
      entityId: id,
      entityLabel: inquiry.name,
      summary: `Deleted inquiry from ${inquiry.name} (${inquiry.topic})`,
    });
    return { id, deleted: true };
  }

  async restore(id: number) {
    const inquiry = await this.repo.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!inquiry) throw new NotFoundException('Inquiry not found');
    if (inquiry.deletedAt) {
      await this.repo.restore(id);
      this.audit.record({
        action: 'inquiry.restored',
        entityType: 'inquiry',
        entityId: id,
        entityLabel: inquiry.name,
        summary: `Restored inquiry from ${inquiry.name} (${inquiry.topic})`,
      });
    }
    return this.findOne(id);
  }
}
