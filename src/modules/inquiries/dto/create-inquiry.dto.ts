import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

// An inquiry from the public website's contact form.
export class CreateInquiryDto {
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
  @MinLength(1)
  @MaxLength(60)
  topic!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  page?: string;
}
