import { Injectable, NotFoundException } from '@nestjs/common';
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
    const vehicle = this.vehicleRepository.create(dto);
    return this.vehicleRepository.save(vehicle);
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

    return this.vehicleRepository.save(vehicle);
  }

  async remove(id: number) {
    const vehicle = await this.findOne(id);

    await this.vehicleRepository.remove(vehicle);

    return {
      message: 'Vehicle deleted successfully',
    };
  }
}
