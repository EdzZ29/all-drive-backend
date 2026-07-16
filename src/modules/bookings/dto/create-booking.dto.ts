/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

import {
  DriveType,
  HandoverMethod,
  PaymentMethod,
} from '../entities/booking.entity';

// Philippine driver's license format, e.g. N02-12-345678.
const LICENSE_REGEX = /^[A-Za-z]\d{2}-\d{2}-\d{6}$/;

export class CreateBookingDto {
  @IsInt()
  vehicleId!: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsEnum(DriveType)
  driveType!: DriveType;

  @IsEnum(HandoverMethod)
  handover!: HandoverMethod;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  pickupTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  contactPhone?: string;

  // --- Requirements / documents ---
  @IsOptional()
  @IsString()
  @MaxLength(60)
  idType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  idImage?: string;

  @IsOptional()
  @Matches(LICENSE_REGEX, {
    message: 'License number must look like N02-12-345678',
  })
  licenseNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  licenseImage?: string;

  // --- Payment ---
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  downpaymentProof?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
