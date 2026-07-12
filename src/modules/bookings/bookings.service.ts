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
import { VehiclesService } from '../vehicles/vehicles.service';
import { VehicleStatus } from '../vehicles/entities/vehicles.entity';

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
        status: Not(BookingStatus.CANCELLED),
        startDate: Between(dto.startDate, dto.endDate),
      },
    });
    if (clash) {
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
      status: BookingStatus.PENDING,
    });

    return this.bookingRepository.save(booking);
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
    if (booking.status === BookingStatus.COMPLETED) {
      throw new BadRequestException('Completed bookings cannot be cancelled');
    }

    booking.status = BookingStatus.CANCELLED;
    return this.bookingRepository.save(booking);
  }
}
