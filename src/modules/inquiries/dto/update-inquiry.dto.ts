/* eslint-disable @typescript-eslint/no-unsafe-call */
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { InquiryStatus } from '../entities/inquiry.entity';

// Admin follow-up on an inquiry.
export class UpdateInquiryDto {
  @IsOptional()
  @IsEnum(InquiryStatus)
  status?: InquiryStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
