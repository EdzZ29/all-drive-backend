import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import {
  BookingStatus,
  DriveType,
  HandoverMethod,
  PaymentMethod,
  PaymentStatus,
} from '../entities/booking.entity';

// Admin edits to a booking after talking to the customer: reschedule, assign a
// fleet vehicle, set the final price, record payment, or leave notes. Status
// is changed via its own endpoint. Send null to clear a nullable field.
export class UpdateBookingDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  days?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  pickupTime?: string;

  @IsOptional()
  @IsEnum(DriveType)
  driveType?: DriveType;

  // A fleet vehicle id, or null to unassign.
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsInt()
  vehicleId?: number | null;

  @IsOptional()
  @IsEnum(HandoverMethod)
  handover?: HandoverMethod;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsNumber()
  @Min(0)
  totalPrice?: number | null;

  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod | null;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  // The customer's email, e.g. one they gave by phone. Empty string clears it.
  @ValidateIf((_o, v) => v !== undefined && v !== '')
  @IsEmail()
  @MaxLength(120)
  customerEmail?: string;
}

export class UpdateBookingStatusDto {
  @IsEnum(BookingStatus)
  status!: BookingStatus;
}
