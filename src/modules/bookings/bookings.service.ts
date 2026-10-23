import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { randomInt } from 'crypto';

import { Booking, BookingStatus } from './entities/booking.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import {
  UpdateBookingDto,
  UpdateBookingStatusDto,
} from './dto/update-booking.dto';
import { VehiclesService } from '../vehicles/vehicles.service';
import { Vehicle, VehicleStatus } from '../vehicles/entities/vehicles.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { PushService } from '../push/push.service';
import { MailService } from '../mail/mail.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditActorType } from '../audit-logs/entities/audit-log.entity';
import { likePattern, pageOf } from '../../common/pagination';
import { BookingFilter, BookingsQueryDto } from './dto/bookings-query.dto';

// When a booking becomes Approved its assigned vehicle is in use, so it's
// marked Booked. Returning/completing/declining/cancelling frees it again.
const VEHICLE_STATUS_FOR_BOOKING: Partial<
  Record<BookingStatus, VehicleStatus>
> = {
  [BookingStatus.APPROVED]: VehicleStatus.BOOKED,
  [BookingStatus.RETURNED]: VehicleStatus.AVAILABLE,
  [BookingStatus.COMPLETED]: VehicleStatus.AVAILABLE,
  [BookingStatus.DECLINED]: VehicleStatus.AVAILABLE,
  [BookingStatus.CANCELLED]: VehicleStatus.AVAILABLE,
};

// Which statuses each tab of the admin bookings list shows.
const FILTER_STATUSES: Record<
  Exclude<BookingFilter, 'All'>,
  BookingStatus[]
> = {
  Pending: [BookingStatus.PENDING],
  Active: [BookingStatus.APPROVED, BookingStatus.RETURNED],
  History: [
    BookingStatus.COMPLETED,
    BookingStatus.DECLINED,
    BookingStatus.CANCELLED,
  ],
};

const peso = (v: number | string | null) =>
  v == null ? 'on request' : `₱${Number(v).toLocaleString('en-PH')}`;

// Statuses that still hold the assigned vehicle (used for clash detection).
const ACTIVE_STATUSES = [BookingStatus.PENDING, BookingStatus.APPROVED];

// "2026-10-21" + 3 days -> "2026-10-24", on plain calendar dates.
function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// The customer's email (any case) or phone number (any format: "0917 123 4567",
// "+63 917...", compared on the last 10 digits).
function matchesContact(
  booking: Pick<Booking, 'customerEmail' | 'customerPhone'>,
  contact: string,
) {
  const value = contact.trim();
  if (value.includes('@')) {
    return (
      !!booking.customerEmail &&
      booking.customerEmail.trim().toLowerCase() === value.toLowerCase()
    );
  }
  const digits = (s: string) => s.replace(/\D/g, '').slice(-10);
  const given = digits(value);
  return given.length >= 7 && given === digits(booking.customerPhone);
}

// Short, easy-to-read reference, e.g. "AD-1013-7K2Q" (no 0/O or 1/I mix-ups).
// Same format the website uses, for bookings it didn't number itself.
function bookingReference() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const random = Array.from(
    { length: 4 },
    () => chars[randomInt(chars.length)],
  ).join('');
  const date = new Date()
    .toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Manila',
    })
    .replace('/', '');
  return `AD-${date}-${random}`;
}

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    private readonly vehiclesService: VehiclesService,
    private readonly notifications: NotificationsService,
    private readonly push: PushService,
    private readonly mail: MailService,
    private readonly audit: AuditLogsService,
  ) {}

  // A booking request from the public website's booking form.
  async createFromWebsite(dto: CreateBookingDto) {
    const [startDate, pickupTime] = dto.pickup.split('T');
    if (Number.isNaN(new Date(`${startDate}T00:00:00Z`).getTime())) {
      throw new BadRequestException('Invalid pickup date');
    }

    const reference = dto.reference ?? bookingReference();
    if (
      await this.bookingRepository.exists({
        where: { reference },
        withDeleted: true,
      })
    ) {
      // The website retried a booking that already arrived: don't duplicate.
      throw new ConflictException(`Booking ${reference} already exists`);
    }

    const booking = this.bookingRepository.create({
      reference,
      customerName: dto.name,
      customerPhone: dto.contact,
      customerEmail: dto.email || null,
      customerAddress: dto.address,
      customerWork: dto.work,
      carCategory: dto.carCategory,
      carModel: dto.carModel || null,
      carLabel: dto.carLabel,
      destination: dto.destination,
      rateZone: dto.zone,
      specificPlace: dto.specificPlace || null,
      startDate,
      endDate: addDays(startDate, dto.days),
      pickupTime,
      days: dto.days,
      driveType: dto.driveType,
      yearsDriving: dto.yearsDriving ?? null,
      purpose: dto.purpose,
      estimatedTotal: dto.estimatedTotal ?? null,
      estimateText: dto.estimateText,
      totalPrice: dto.estimatedTotal ?? null,
      status: BookingStatus.PENDING,
    });
    const saved = await this.bookingRepository.save(booking);

    // Tell admins in real time; the live payload also updates their lists.
    // Fire-and-forget: a notification failure must never lose the booking.
    this.notifications.notifyNewBooking(saved).catch(() => undefined);
    // Web push to admins' phones/laptops, also without waiting on it.
    void this.push.notifyAdmins(saved);
    this.audit.record({
      action: 'booking.created',
      entityType: 'booking',
      entityId: saved.id,
      entityLabel: saved.reference,
      summary: `New booking ${saved.reference} from the website: ${saved.carLabel}, ${saved.startDate} (${saved.days} day${saved.days > 1 ? 's' : ''})`,
      actor: { type: AuditActorType.WEBSITE, name: saved.customerName },
    });

    return { id: saved.id, reference: saved.reference };
  }

  // One page of the admin list, plus how many bookings each tab has.
  async list(query: BookingsQueryDto) {
    const { page, limit, skip } = pageOf(query);
    const filter = query.filter ?? 'All';
    const like = likePattern(query.q);
    const search = (
      qb: ReturnType<Repository<Booking>['createQueryBuilder']>,
    ) =>
      like
        ? qb.andWhere(
            '(b.reference ILIKE :like OR b.customerName ILIKE :like OR b.customerPhone ILIKE :like OR b.customerEmail ILIKE :like OR b.carLabel ILIKE :like)',
            { like },
          )
        : qb;

    const listQb = search(
      this.bookingRepository
        .createQueryBuilder('b')
        .leftJoinAndSelect('b.vehicle', 'vehicle'),
    )
      .orderBy('b.createdAt', 'DESC')
      .skip(skip)
      .take(limit);
    if (filter !== 'All') {
      listQb.andWhere('b.status IN (:...statuses)', {
        statuses: FILTER_STATUSES[filter],
      });
    }
    const [[items, total], rows] = await Promise.all([
      listQb.getManyAndCount(),
      search(this.bookingRepository.createQueryBuilder('b'))
        .select('b.status', 'status')
        .addSelect('COUNT(*)::int', 'count')
        .groupBy('b.status')
        .getRawMany<{ status: BookingStatus; count: number }>(),
    ]);
    const byStatus = (statuses: BookingStatus[]) =>
      rows
        .filter((r) => statuses.includes(r.status))
        .reduce((sum, r) => sum + Number(r.count), 0);
    const counts = {
      Pending: byStatus(FILTER_STATUSES.Pending),
      Active: byStatus(FILTER_STATUSES.Active),
      History: byStatus(FILTER_STATUSES.History),
      All: rows.reduce((sum, r) => sum + Number(r.count), 0),
    };
    return { items, total, page, limit, counts };
  }

  // "Track my booking" on the website. The code alone isn't enough: the email
  // or mobile number must match too. Any mismatch gets the same answer, so it
  // can't be used to find out which codes exist.
  async track(reference: string, contact: string) {
    const code = reference.trim().toUpperCase().replace(/\s+/g, '');
    const booking = await this.bookingRepository.findOne({
      where: { reference: code },
    });
    if (!booking || !matchesContact(booking, contact)) {
      throw new NotFoundException(
        "We couldn't find a booking with those details",
      );
    }
    const car = booking.vehicle
      ? `${booking.vehicle.brand} ${booking.vehicle.model}`
      : null;
    // Only what the customer needs to see (no internal notes or ids).
    return {
      reference: booking.reference,
      customerName: booking.customerName,
      status: booking.status,
      carLabel: booking.carLabel,
      assignedCar: car,
      startDate: booking.startDate,
      endDate: booking.endDate,
      pickupTime: booking.pickupTime,
      days: booking.days,
      driveType: booking.driveType,
      destination: booking.destination,
      specificPlace: booking.specificPlace,
      handover: booking.handover,
      location: booking.location,
      totalPrice: booking.totalPrice,
      estimateText: booking.estimateText,
      paymentStatus: booking.paymentStatus,
      createdAt: booking.createdAt,
    };
  }

  async findOne(id: number) {
    const booking = await this.bookingRepository.findOne({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  // Allowed status transitions for the admin workflow.
  private static readonly TRANSITIONS: Record<BookingStatus, BookingStatus[]> =
    {
      [BookingStatus.PENDING]: [
        BookingStatus.APPROVED,
        BookingStatus.DECLINED,
        BookingStatus.CANCELLED,
      ],
      [BookingStatus.APPROVED]: [
        BookingStatus.RETURNED,
        BookingStatus.COMPLETED,
        BookingStatus.CANCELLED,
      ],
      [BookingStatus.RETURNED]: [BookingStatus.COMPLETED],
      [BookingStatus.DECLINED]: [],
      [BookingStatus.COMPLETED]: [],
      [BookingStatus.CANCELLED]: [],
    };

  async updateStatus(id: number, dto: UpdateBookingStatusDto) {
    const booking = await this.findOne(id);

    if (booking.status === dto.status) return booking;

    const allowed = BookingsService.TRANSITIONS[booking.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot change a ${booking.status} booking to ${dto.status}`,
      );
    }

    const previous = booking.status;
    booking.status = dto.status;
    const saved = await this.bookingRepository.save(booking);
    this.audit.record({
      action: 'booking.status',
      entityType: 'booking',
      entityId: saved.id,
      entityLabel: saved.reference,
      summary: `Changed booking ${saved.reference} (${saved.customerName}) from ${previous} to ${saved.status}`,
      details: { from: previous, to: saved.status },
    });

    // Keep the assigned vehicle's availability in sync.
    const vehicleStatus = VEHICLE_STATUS_FOR_BOOKING[dto.status];
    if (vehicleStatus && booking.vehicleId) {
      await this.vehiclesService.setStatus(booking.vehicleId, vehicleStatus);
    }

    // Approving = confirming: email the customer automatically.
    // The approval stands even if a message can't be sent; the admin sees why.
    if (dto.status === BookingStatus.APPROVED) {
      return this.sendConfirmation(saved);
    }
    return saved;
  }

  // Sends the "booking confirmed" email again for an approved booking.
  async resendConfirmation(id: number) {
    const booking = await this.findOne(id);
    if (booking.status !== BookingStatus.APPROVED) {
      throw new BadRequestException(
        'Only approved bookings get a confirmation message',
      );
    }
    const result = await this.sendConfirmation(booking);
    this.audit.record({
      action: 'booking.confirmation',
      entityType: 'booking',
      entityId: booking.id,
      entityLabel: booking.reference,
      summary: result.confirmationEmail.sent
        ? `Resent the confirmation email for ${booking.reference} to ${result.confirmationEmail.to}`
        : `Tried to resend the confirmation for ${booking.reference}: ${result.confirmationEmail.message}`,
    });
    return result;
  }

  // Emails the customer. Returns the booking plus what happened with the email.
  private async sendConfirmation(booking: Booking) {
    // Reload so the email has the assigned car's details.
    const full = await this.findOne(booking.id);
    const confirmationEmail = await this.mail.sendBookingConfirmed(full);
    if (confirmationEmail.sent) {
      full.confirmationEmailSentAt = new Date();
      await this.bookingRepository.update(full.id, {
        confirmationEmailSentAt: full.confirmationEmailSentAt,
      });
    }
    return { ...full, confirmationEmail };
  }

  async update(id: number, dto: UpdateBookingDto) {
    const booking = await this.findOne(id);
    const before = { ...booking };

    const startDate = dto.startDate?.slice(0, 10) ?? booking.startDate;
    const days = dto.days ?? booking.days;
    const endDate = addDays(startDate, days);

    // Assigning (or swapping) the fleet vehicle.
    const previousVehicleId = booking.vehicleId;
    const vehicleChanged =
      dto.vehicleId !== undefined && dto.vehicleId !== previousVehicleId;
    if (vehicleChanged && dto.vehicleId != null) {
      const vehicle = await this.vehiclesService.findOne(dto.vehicleId);
      if (vehicle.status === VehicleStatus.MAINTENANCE) {
        throw new BadRequestException('That vehicle is under maintenance');
      }
    }
    const vehicleId = vehicleChanged
      ? (dto.vehicleId ?? null)
      : booking.vehicleId;
    if (vehicleId && ACTIVE_STATUSES.includes(booking.status)) {
      await this.assertVehicleFree(vehicleId, startDate, endDate, booking.id);
    }

    Object.assign(booking, {
      startDate,
      endDate,
      days,
      pickupTime: dto.pickupTime ?? booking.pickupTime,
      driveType: dto.driveType ?? booking.driveType,
      handover: dto.handover ?? booking.handover,
      location: dto.location ?? booking.location,
      totalPrice:
        dto.totalPrice !== undefined ? dto.totalPrice : booking.totalPrice,
      paymentMethod:
        dto.paymentMethod !== undefined
          ? dto.paymentMethod
          : booking.paymentMethod,
      paymentStatus: dto.paymentStatus ?? booking.paymentStatus,
      notes: dto.notes ?? booking.notes,
      customerEmail:
        dto.customerEmail !== undefined
          ? dto.customerEmail.trim() || null
          : booking.customerEmail,
    });
    if (vehicleChanged) {
      // Point the eager relation at the new car too, or save() would write the
      // stale relation's id back over vehicleId.
      booking.vehicleId = vehicleId;
      booking.vehicle = vehicleId ? ({ id: vehicleId } as Vehicle) : null;
    }

    const saved = await this.bookingRepository.save(booking);

    // Swapping the car on a confirmed booking moves the "Booked" flag with it.
    if (vehicleChanged && booking.status === BookingStatus.APPROVED) {
      if (previousVehicleId) {
        await this.vehiclesService.setStatus(
          previousVehicleId,
          VehicleStatus.AVAILABLE,
        );
      }
      if (vehicleId) {
        await this.vehiclesService.setStatus(vehicleId, VehicleStatus.BOOKED);
      }
    }

    // Reload so the response carries the (new) vehicle relation.
    const updated = await this.findOne(saved.id);
    this.logChanges(before, updated);
    return updated;
  }

  // The approval email, ready to send, for when this server can't send it itself (the
  // website sends it with its own Gmail, then calls confirmationSent).
  async confirmationEmail(id: number) {
    const booking = await this.findOne(id);
    if (booking.status !== BookingStatus.APPROVED) {
      throw new BadRequestException(
        'Only approved bookings get a confirmation message',
      );
    }
    const email = this.mail.composeBookingConfirmed(booking);
    if (!email) {
      throw new BadRequestException(
        'The customer did not leave an email. Call or text them.',
      );
    }
    return email;
  }

  // The website sent the approval email: record it like a sent email.
  async confirmationSent(id: number, to: string) {
    const booking = await this.findOne(id);
    booking.confirmationEmailSentAt = new Date();
    await this.bookingRepository.update(id, {
      confirmationEmailSentAt: booking.confirmationEmailSentAt,
    });
    this.audit.record({
      action: 'booking.confirmation',
      entityType: 'booking',
      entityId: id,
      entityLabel: booking.reference,
      summary: `Emailed the approval for ${booking.reference} to ${to}`,
    });
    return { ...booking, confirmationEmail: { sent: true as const, to } };
  }

  // Deleting hides the booking everywhere; it can be restored (Undo, or the
  // activity log). A confirmed booking's car is freed meanwhile.
  async remove(id: number) {
    const booking = await this.findOne(id);
    await this.bookingRepository.softDelete(id);
    if (booking.status === BookingStatus.APPROVED && booking.vehicleId) {
      await this.vehiclesService
        .setStatus(booking.vehicleId, VehicleStatus.AVAILABLE)
        .catch(() => undefined);
    }
    this.audit.record({
      action: 'booking.deleted',
      entityType: 'booking',
      entityId: id,
      entityLabel: booking.reference,
      summary: `Deleted booking ${booking.reference} (${booking.customerName}, ${booking.status})`,
    });
    return { id, deleted: true };
  }

  async restore(id: number) {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.deletedAt) {
      await this.bookingRepository.restore(id);
      // Back to confirmed: its car is in use again (if the car still exists).
      if (booking.status === BookingStatus.APPROVED && booking.vehicleId) {
        await this.vehiclesService
          .setStatus(booking.vehicleId, VehicleStatus.BOOKED)
          .catch(() => undefined);
      }
      this.audit.record({
        action: 'booking.restored',
        entityType: 'booking',
        entityId: id,
        entityLabel: booking.reference,
        summary: `Restored booking ${booking.reference} (${booking.customerName})`,
      });
    }
    return this.findOne(id);
  }

  // One activity-log entry listing what an edit changed (nothing if nothing did).
  private logChanges(before: Booking, after: Booking) {
    const car = (b: Booking) =>
      b.vehicle
        ? `${b.vehicle.brand} ${b.vehicle.model} (${b.vehicle.plateNumber})`
        : 'none';
    const fields: [string, (b: Booking) => string][] = [
      ['assigned car', car],
      ['pickup', (b) => `${b.startDate} ${b.pickupTime ?? ''}`.trim()],
      ['days', (b) => String(b.days)],
      ['service', (b) => b.driveType],
      ['handover', (b) => b.handover],
      ['location', (b) => b.location ?? ''],
      ['price', (b) => peso(b.totalPrice)],
      ['payment', (b) => b.paymentStatus],
      ['payment method', (b) => b.paymentMethod ?? 'none'],
      ['customer email', (b) => b.customerEmail ?? 'none'],
    ];
    const changes: Record<string, [string, string]> = {};
    for (const [label, read] of fields) {
      const [from, to] = [read(before), read(after)];
      if (from !== to) changes[label] = [from, to];
    }
    const notesChanged = (before.notes ?? '') !== (after.notes ?? '');
    if (!Object.keys(changes).length && !notesChanged) return;
    const parts = Object.entries(changes).map(
      ([label, [from, to]]) => `${label} ${from} → ${to}`,
    );
    if (notesChanged) parts.push('notes edited');
    this.audit.record({
      action: 'booking.updated',
      entityType: 'booking',
      entityId: after.id,
      entityLabel: after.reference,
      summary: `Updated booking ${after.reference}: ${parts.join('; ')}`,
      details: {
        changes,
        ...(notesChanged && { notes: [before.notes, after.notes] }),
      },
    });
  }

  // Rejects assigning a vehicle that another active booking already holds on
  // overlapping dates.
  private async assertVehicleFree(
    vehicleId: number,
    startDate: string,
    endDate: string,
    excludeId: number,
  ) {
    const clash = await this.bookingRepository
      .createQueryBuilder('b')
      .where('b.vehicleId = :vehicleId', { vehicleId })
      .andWhere({ id: Not(excludeId), status: In(ACTIVE_STATUSES) })
      .andWhere('b.startDate < :endDate AND b.endDate > :startDate', {
        startDate,
        endDate,
      })
      .getOne();
    if (clash) {
      throw new BadRequestException(
        `That vehicle is already assigned to booking ${clash.reference} on overlapping dates`,
      );
    }
  }
}
