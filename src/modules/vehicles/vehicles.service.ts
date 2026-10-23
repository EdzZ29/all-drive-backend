import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Vehicle, VehicleStatus } from './entities/vehicles.entity';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

const label = (v: Pick<Vehicle, 'brand' | 'model' | 'plateNumber'>) =>
  `${v.brand} ${v.model} (${v.plateNumber})`;

// Fields worth naming in the activity log when an admin edits a unit.
const LOGGED_FIELDS: [keyof Vehicle, string][] = [
  ['status', 'availability'],
  ['dailyRate', 'daily rate'],
  ['plateNumber', 'plate'],
  ['brand', 'brand'],
  ['model', 'model'],
  ['year', 'year'],
  ['color', 'color'],
  ['seats', 'seats'],
  ['transmission', 'transmission'],
  ['fuelType', 'fuel'],
  ['vehicleType', 'type'],
];

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    @InjectRepository(Booking)
    private readonly bookings: Repository<Booking>,
    private readonly audit: AuditLogsService,
  ) {}

  async create(dto: CreateVehicleDto) {
    // description is required in the table but optional in the form.
    const vehicle = this.vehicleRepository.create({
      ...dto,
      description: dto.description ?? '',
    });
    const saved = await this.vehicleRepository
      .save(vehicle)
      .catch(duplicatePlate);
    this.audit.record({
      action: 'vehicle.created',
      entityType: 'vehicle',
      entityId: saved.id,
      entityLabel: label(saved),
      summary: `Added unit ${label(saved)}, ${saved.status}`,
    });
    return saved;
  }

  async findAll() {
    return this.vehicleRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findOne(id: number) {
    const vehicle = await this.vehicleRepository.findOne({
      where: { id },
    });

    if (!vehicle) throw new NotFoundException('Vehicle not found');

    return vehicle;
  }

  // An admin edited the unit.
  async update(id: number, dto: UpdateVehicleDto) {
    const vehicle = await this.findOne(id);
    const before = { ...vehicle };

    Object.assign(vehicle, dto);

    const saved = await this.vehicleRepository
      .save(vehicle)
      .catch(duplicatePlate);
    const parts = LOGGED_FIELDS.filter(
      ([key]) => String(before[key] ?? '') !== String(saved[key] ?? ''),
    ).map(
      ([key, name]) =>
        `${name} ${String(before[key] ?? '')} → ${String(saved[key] ?? '')}`,
    );
    if (before.description !== saved.description) parts.push('notes edited');
    if (before.image !== saved.image) parts.push('photo changed');
    if (parts.length) {
      this.audit.record({
        action: 'vehicle.updated',
        entityType: 'vehicle',
        entityId: saved.id,
        entityLabel: label(saved),
        summary: `Updated unit ${label(saved)}: ${parts.join('; ')}`,
      });
    }
    return saved;
  }

  // Booked/Available when a booking takes or frees the car (logged with the
  // booking, not as a unit edit).
  async setStatus(id: number, status: VehicleStatus) {
    await this.findOne(id);
    await this.vehicleRepository.update(id, { status });
  }

  // Hidden everywhere, but kept so it can be restored. A car still on a
  // pending or confirmed booking can't be deleted.
  async remove(id: number) {
    const vehicle = await this.findOne(id);
    const active = await this.bookings.find({
      select: { id: true, reference: true },
      where: {
        vehicleId: id,
        status: In([BookingStatus.PENDING, BookingStatus.APPROVED]),
      },
      take: 3,
    });
    if (active.length) {
      throw new BadRequestException(
        `This car is assigned to ${active.map((b) => b.reference).join(', ')}. Assign another car (or none) to ${active.length > 1 ? 'those bookings' : 'that booking'} first.`,
      );
    }
    await this.vehicleRepository.softDelete(id);
    this.audit.record({
      action: 'vehicle.deleted',
      entityType: 'vehicle',
      entityId: id,
      entityLabel: label(vehicle),
      summary: `Deleted unit ${label(vehicle)}`,
    });
    return { id, deleted: true };
  }

  async restore(id: number) {
    const vehicle = await this.vehicleRepository.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (vehicle.deletedAt) {
      await this.vehicleRepository.restore(id);
      this.audit.record({
        action: 'vehicle.restored',
        entityType: 'vehicle',
        entityId: id,
        entityLabel: label(vehicle),
        summary: `Restored unit ${label(vehicle)}`,
      });
    }
    return this.findOne(id);
  }
}

// Postgres unique violation on plateNumber -> a clear 409 instead of a 500.
function duplicatePlate(err: unknown): never {
  if ((err as { code?: string }).code === '23505') {
    throw new ConflictException(
      'Another car already has this plate number (it may be a deleted car: restore it from the Activity log).',
    );
  }
  throw err;
}
