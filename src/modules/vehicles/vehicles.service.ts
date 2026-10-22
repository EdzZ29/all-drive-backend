import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Vehicle } from './entities/vehicles.entity';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
  ) {}

  async create(dto: CreateVehicleDto) {
    // description is required in the table but optional in the form.
    const vehicle = this.vehicleRepository.create({
      ...dto,
      description: dto.description ?? '',
    });
    return this.vehicleRepository.save(vehicle).catch(duplicatePlate);
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

  async update(id: number, dto: UpdateVehicleDto) {
    const vehicle = await this.findOne(id);

    Object.assign(vehicle, dto);

    return this.vehicleRepository.save(vehicle).catch(duplicatePlate);
  }

  async remove(id: number) {
    const vehicle = await this.findOne(id);

    await this.vehicleRepository.remove(vehicle);

    return {
      message: 'Vehicle deleted successfully',
    };
  }
}

// Postgres unique violation on plateNumber -> a clear 409 instead of a 500.
function duplicatePlate(err: unknown): never {
  if ((err as { code?: string }).code === '23505') {
    throw new ConflictException('Another car already has this plate number');
  }
  throw err;
}
