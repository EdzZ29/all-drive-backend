import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { Availability } from '../catalog.constants';

const MAX_RATE = 1_000_000;

// Daily self-drive rate per zone in whole pesos. Every zone is required; null
// means "rate on request".
export class RatesDto {
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(0)
  @Max(MAX_RATE)
  butuan!: number | null;

  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(0)
  @Max(MAX_RATE)
  caraga!: number | null;

  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(0)
  @Max(MAX_RATE)
  'cdo-davao'!: number | null;

  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(0)
  @Max(MAX_RATE)
  outside!: number | null;
}

export class UpdateClassDto {
  @ValidateNested()
  @Type(() => RatesDto)
  rates!: RatesDto;
}

export class PhotoDto {
  // An uploaded image: https (e.g. Supabase Storage) or this backend's /uploads.
  @IsString()
  @MaxLength(500)
  @Matches(/^(https:\/\/[^\s]+|\/uploads\/[\w.-]+)$/, {
    message: 'url must be an https URL or an /uploads/ path',
  })
  url!: string;

  // Color or variant name shown on the website, e.g. "White".
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  label!: string;

  // Swatch color, e.g. "#f2f2f2".
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must look like #f2f2f2' })
  color!: string;
}

// Changes to one car model. Omitted fields stay as they are.
export class UpdateModelDto {
  @IsOptional()
  @IsEnum(Availability)
  availability?: Availability;

  // Own rates, or null to go back to the website's built-in rates.
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @ValidateNested()
  @Type(() => RatesDto)
  rates?: RatesDto | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => PhotoDto)
  photos?: PhotoDto[];
}

export class UpdateSettingsDto {
  // Driver fee per day, or null to go back to the website's built-in fee.
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  @Min(0)
  @Max(MAX_RATE)
  driverRate!: number | null;
}
