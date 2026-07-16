/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  BookingStatus,
  DriveType,
  HandoverMethod,
  PaymentStatus,
} from '../entities/booking.entity';

// Admin-only edits to a booking: reschedule, change the handover
// time/place/method, or leave notes. Status is changed via its own endpoint.
export class UpdateBookingDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(DriveType)
  driveType?: DriveType;

  @IsOptional()
  @IsEnum(HandoverMethod)
  handover?: HandoverMethod;

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
  notes?: string;

  // Admin validation controls.
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsBoolean()
  documentsVerified?: boolean;
}

export class UpdateBookingStatusDto {
  @IsEnum(BookingStatus)
  status!: BookingStatus;
}
