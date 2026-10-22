import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { DriveType } from '../entities/booking.entity';

// A booking request from the public website's booking form. The website
// validates and prices it on its server first, then forwards it here.
export class CreateBookingDto {
  // The website's reference (also used in its emails/SMS). Generated here if
  // missing.
  @IsOptional()
  @Matches(/^AD-\d{4}-[A-Z0-9]{4}$/, { message: 'Invalid booking reference' })
  reference?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(7)
  @MaxLength(30)
  contact!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  email?: string;

  @IsString()
  @MaxLength(200)
  address!: string;

  @IsString()
  @MaxLength(200)
  work!: string;

  @IsString()
  @MaxLength(120)
  destination!: string;

  @IsString()
  @MaxLength(60)
  zone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  specificPlace?: string;

  // Local Philippine date & time from the form, e.g. "2026-10-21T10:00".
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, {
    message: 'pickup must look like 2026-10-21T10:00',
  })
  pickup!: string;

  @IsInt()
  @Min(1)
  @Max(60)
  days!: number;

  @IsEnum(DriveType)
  driveType!: DriveType;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(70)
  yearsDriving?: number;

  @IsString()
  @MaxLength(20)
  carCategory!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  carModel?: string;

  @IsString()
  @MaxLength(120)
  carLabel!: string;

  @IsString()
  @MaxLength(500)
  purpose!: string;

  // Omitted when the rate is on request.
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedTotal?: number;

  @IsString()
  @MaxLength(120)
  estimateText!: string;
}
