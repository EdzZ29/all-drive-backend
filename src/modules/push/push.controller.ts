import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';

import { PushService } from './push.service';
import { SubscribeDto, UnsubscribeDto } from './dto/push-subscription.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';

// Web push for admins: the dashboard's "Enable notifications" toggle uses
// these to register the browser it's running in.
@Roles(UserRole.ADMIN)
@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  // The VAPID public key the browser needs for pushManager.subscribe().
  @Get('public-key')
  publicKey() {
    return this.pushService.getPublicKey();
  }

  @HttpCode(HttpStatus.OK)
  @Post('subscribe')
  subscribe(
    @CurrentUser('id') userId: number,
    @Body() dto: SubscribeDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.pushService.subscribe(userId, dto, userAgent);
  }

  @HttpCode(HttpStatus.OK)
  @Post('unsubscribe')
  unsubscribe(@CurrentUser('id') userId: number, @Body() dto: UnsubscribeDto) {
    return this.pushService.unsubscribe(userId, dto.endpoint);
  }
}
