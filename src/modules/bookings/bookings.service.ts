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
import { SmsService } from '../sms/sms.service';

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

// Statuses that still hold the assigned vehicle (used for clash detection).
const ACTIVE_STATUSES = [BookingStatus.PENDING, BookingStatus.APPROVED];

// "2026-10-21" + 3 days -> "2026-10-24", on plain calendar dates.
function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
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
    private readonly sms: SmsService,
  ) {}

  // A booking request from the public website's booking form.
  async createFromWebsite(dto: CreateBookingDto) {
    const [startDate, pickupTime] = dto.pickup.split('T');
    if (Number.isNaN(new Date(`${startDate}T00:00:00Z`).getTime())) {
      throw new BadRequestException('Invalid pickup date');
    }

    const reference = dto.reference ?? bookingReference();
    if (await this.bookingRepository.existsBy({ reference })) {
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

    return { id: saved.id, reference: saved.reference };
  }

  findAll() {
    return this.bookingRepository.find({ order: { createdAt: 'DESC' } });
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

    booking.status = dto.status;
    const saved = await this.bookingRepository.save(booking);

    // Keep the assigned vehicle's availability in sync.
    const vehicleStatus = VEHICLE_STATUS_FOR_BOOKING[dto.status];
    if (vehicleStatus && booking.vehicleId) {
      await this.vehiclesService.update(booking.vehicleId, {
        status: vehicleStatus,
      });
    }

    // Approving = confirming: tell the customer automatically, by email and text.
    // The approval stands even if a message can't be sent; the admin sees why.
    if (dto.status === BookingStatus.APPROVED) {
      return this.sendConfirmation(saved);
    }
    return saved;
  }

  // Sends the "booking confirmed" email and text again for an approved booking.
  async resendConfirmation(id: number) {
    const booking = await this.findOne(id);
    if (booking.status !== BookingStatus.APPROVED) {
      throw new BadRequestException(
        'Only approved bookings get a confirmation message',
      );
    }
    return this.sendConfirmation(booking);
  }

  // Emails and texts the customer at the same time. Returns the booking plus
  // what happened with each message.
  private async sendConfirmation(booking: Booking) {
    // Reload so the messages have the assigned car's details.
    const full = await this.findOne(booking.id);
    const [confirmationEmail, confirmationSms] = await Promise.all([
      this.mail.sendBookingConfirmed(full),
      this.sms.sendBookingConfirmed(full),
    ]);
    const now = new Date();
    if (confirmationEmail.sent) full.confirmationEmailSentAt = now;
    if (confirmationSms.sent) full.confirmationSmsSentAt = now;
    if (confirmationEmail.sent || confirmationSms.sent) {
      await this.bookingRepository.update(full.id, {
        confirmationEmailSentAt: full.confirmationEmailSentAt,
        confirmationSmsSentAt: full.confirmationSmsSentAt,
      });
    }
    return { ...full, confirmationEmail, confirmationSms };
  }

  async update(id: number, dto: UpdateBookingDto) {
    const booking = await this.findOne(id);

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
        await this.vehiclesService.update(previousVehicleId, {
          status: VehicleStatus.AVAILABLE,
        });
      }
      if (vehicleId) {
        await this.vehiclesService.update(vehicleId, {
          status: VehicleStatus.BOOKED,
        });
      }
    }

    // Reload so the response carries the (new) vehicle relation.
    return this.findOne(saved.id);
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
