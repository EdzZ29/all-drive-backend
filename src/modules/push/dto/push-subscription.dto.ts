import { Type } from 'class-transformer';
import {
  IsDefined,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class PushKeysDto {
  @IsString()
  @MaxLength(255)
  p256dh!: string;

  @IsString()
  @MaxLength(255)
  auth!: string;
}

// The browser's PushSubscription, as returned by subscription.toJSON().
export class SubscribeDto {
  // Push services are always HTTPS.
  @IsUrl({ protocols: ['https'], require_protocol: true, require_tld: true })
  @MaxLength(2048)
  endpoint!: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;

  // Part of toJSON(); accepted so the whole object can be sent, but unused.
  @IsOptional()
  @IsNumber()
  expirationTime?: number | null;
}

export class UnsubscribeDto {
  @IsString()
  @MaxLength(2048)
  endpoint!: string;
}
