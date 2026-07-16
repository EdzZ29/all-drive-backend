import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Not, Repository } from 'typeorm';

import { Booking, BookingStatus } from './entities/booking.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import {
  UpdateBookingDto,
  UpdateBookingStatusDto,
} from './dto/update-booking.dto';
import { VehiclesService } from '../vehicles/vehicles.service';
import { VehicleStatus } from '../vehicles/entities/vehicles.entity';

// When a booking becomes Approved the vehicle is in use, so it's hidden from
// the public fleet. Returning/completing/declining/cancelling frees it again.
const VEHICLE_STATUS_FOR_BOOKING: Partial<Record<BookingStatus, VehicleStatus>> =
  {
    [BookingStatus.APPROVED]: VehicleStatus.BOOKED,
    [BookingStatus.RETURNED]: VehicleStatus.AVAILABLE,
    [BookingStatus.COMPLETED]: VehicleStatus.AVAILABLE,
    [BookingStatus.DECLINED]: VehicleStatus.AVAILABLE,
    [BookingStatus.CANCELLED]: VehicleStatus.AVAILABLE,
  };

// Statuses that still hold the vehicle (used for clash detection).
const ACTIVE_STATUSES = [
  BookingStatus.PENDING,
  BookingStatus.APPROVED,
  BookingStatus.RETURNED,
];

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    private readonly vehiclesService: VehiclesService,
  ) {}

  async create(clientId: number, dto: CreateBookingDto) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid booking dates');
    }
    if (end <= start) {
      throw new BadRequestException('End date must be after start date');
    }

    const vehicle = await this.vehiclesService.findOne(dto.vehicleId);
    if (vehicle.status === VehicleStatus.MAINTENANCE) {
      throw new BadRequestException('Vehicle is not available for booking');
    }

    // Reject overlapping active reservations for the same vehicle.
    const clash = await this.bookingRepository.findOne({
      where: {
        vehicleId: dto.vehicleId,
        status: Not(
          // Only cancelled/declined/completed bookings free up the vehicle.
          BookingStatus.CANCELLED,
        ),
        startDate: Between(dto.startDate, dto.endDate),
      },
    });
    if (clash && ACTIVE_STATUSES.includes(clash.status)) {
      throw new BadRequestException(
        'Vehicle is already booked for the selected dates',
      );
    }

    const days = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );
    const totalPrice = days * Number(vehicle.dailyRate);

    const booking = this.bookingRepository.create({
      clientId,
      vehicleId: dto.vehicleId,
      startDate: dto.startDate,
      endDate: dto.endDate,
      totalPrice,
      driveType: dto.driveType,
      handover: dto.handover,
      location: dto.location ?? null,
      pickupTime: dto.pickupTime ?? null,
      contactPhone: dto.contactPhone ?? null,
      idType: dto.idType ?? null,
      idImage: dto.idImage ?? null,
      licenseNumber: dto.licenseNumber ?? null,
      licenseImage: dto.licenseImage ?? null,
      paymentMethod: dto.paymentMethod ?? null,
      // 50% reservation down-payment.
      downpaymentAmount: Math.round((totalPrice / 2) * 100) / 100,
      downpaymentProof: dto.downpaymentProof ?? null,
      notes: dto.notes ?? null,
      status: BookingStatus.PENDING,
    });

    const saved = await this.bookingRepository.save(booking);

    // Once booked, the vehicle drops out of the public fleet until it's
    // returned/completed (or the booking is declined/cancelled).
    await this.vehiclesService.update(dto.vehicleId, {
      status: VehicleStatus.BOOKED,
    });

    return saved;
  }

  findAll() {
    return this.bookingRepository.find({ order: { createdAt: 'DESC' } });
  }

  findMine(clientId: number) {
    return this.bookingRepository.find({
      where: { clientId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOneForClient(id: number, clientId: number) {
    const booking = await this.bookingRepository.findOne({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');

    // A client may only access their own bookings.
    if (booking.clientId !== clientId) {
      throw new ForbiddenException('This booking does not belong to you');
    }
    return booking;
  }

  async cancel(id: number, clientId: number) {
    const booking = await this.findOneForClient(id, clientId);

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Booking is already cancelled');
    }
    if (
      booking.status === BookingStatus.COMPLETED ||
      booking.status === BookingStatus.RETURNED
    ) {
      throw new BadRequestException(
        'Completed or returned bookings cannot be cancelled',
      );
    }

    booking.status = BookingStatus.CANCELLED;
    const saved = await this.bookingRepository.save(booking);

    // Cancelling releases the vehicle back to the public fleet.
    await this.vehiclesService.update(booking.vehicleId, {
      status: VehicleStatus.AVAILABLE,
    });

    return saved;
  }

  // ---- Admin operations -------------------------------------------------

  private async findOneOrFail(id: number) {
    const booking = await this.bookingRepository.findOne({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  // Allowed status transitions for the admin workflow.
  private static readonly TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
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
    const booking = await this.findOneOrFail(id);

    if (booking.status === dto.status) return booking;

    const allowed = BookingsService.TRANSITIONS[booking.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot change a ${booking.status} booking to ${dto.status}`,
      );
    }

    // A booking can only be approved after the admin has validated the
    // client's submitted documents and payment.
    if (dto.status === BookingStatus.APPROVED && !booking.documentsVerified) {
      throw new BadRequestException(
        'Validate the client documents and payment before approving',
      );
    }

    booking.status = dto.status;
    const saved = await this.bookingRepository.save(booking);

    // Keep the vehicle's availability in sync so booked cars drop out of the
    // public fleet until they're returned or completed.
    const vehicleStatus = VEHICLE_STATUS_FOR_BOOKING[dto.status];
    if (vehicleStatus) {
      await this.vehiclesService.update(booking.vehicleId, {
        status: vehicleStatus,
      });
    }

    return saved;
  }

  async update(id: number, dto: UpdateBookingDto) {
    const booking = await this.findOneOrFail(id);

    const start = new Date(dto.startDate ?? booking.startDate);
    const end = new Date(dto.endDate ?? booking.endDate);
    if (end <= start) {
      throw new BadRequestException('End date must be after start date');
    }

    Object.assign(booking, {
      startDate: dto.startDate ?? booking.startDate,
      endDate: dto.endDate ?? booking.endDate,
      driveType: dto.driveType ?? booking.driveType,
      handover: dto.handover ?? booking.handover,
      location: dto.location ?? booking.location,
      pickupTime: dto.pickupTime ?? booking.pickupTime,
      notes: dto.notes ?? booking.notes,
      paymentStatus: dto.paymentStatus ?? booking.paymentStatus,
      documentsVerified: dto.documentsVerified ?? booking.documentsVerified,
    });

    // Recompute the total (and 50% down-payment) if the dates changed.
    if (dto.startDate || dto.endDate) {
      const days = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );
      booking.totalPrice = days * Number(booking.vehicle.dailyRate);
      booking.downpaymentAmount =
        Math.round((booking.totalPrice / 2) * 100) / 100;
    }

    return this.bookingRepository.save(booking);
  }
}
