/* eslint-disable @typescript-eslint/no-unsafe-call */
import { IsDateString, IsInt } from 'class-validator';

export class CreateBookingDto {
  @IsInt()
  vehicleId!: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
