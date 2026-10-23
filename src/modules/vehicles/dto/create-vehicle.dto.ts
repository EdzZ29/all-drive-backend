import { IsString, IsNumber, IsEnum, IsOptional } from 'class-validator';
import { VehicleStatus } from '../entities/vehicles.entity';

export class CreateVehicleDto {
  @IsString()
  brand!: string;

  @IsString()
  model!: string;

  @IsString()
  vehicleType!: string;

  @IsNumber()
  year!: number;

  @IsString()
  color!: string;

  @IsString()
  plateNumber!: string;

  @IsString()
  transmission!: string;

  @IsString()
  fuelType!: string;

  @IsNumber()
  seats!: number;

  @IsNumber()
  dailyRate!: number;

  @IsOptional()
  description?: string;

  @IsEnum(VehicleStatus)
  status!: VehicleStatus;

  @IsOptional()
  @IsString()
  image?: string;
}
