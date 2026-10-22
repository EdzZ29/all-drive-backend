import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { Public } from '../auth/decorators/public.decorator';
import { WebsiteKeyGuard } from '../auth/guards/website-key.guard';
import { BookingsService } from '../bookings/bookings.service';
import { CreateBookingDto } from '../bookings/dto/create-booking.dto';
import { TrackBookingDto } from '../bookings/dto/track-booking.dto';
import { InquiriesService } from '../inquiries/inquiries.service';
import { CreateInquiryDto } from '../inquiries/dto/create-inquiry.dto';
import { ChatService } from '../chat/chat.service';
import {
  AddChatMessagesDto,
  ChatPollDto,
  StartChatDto,
} from '../chat/dto/chat.dto';

// Chat tokens are 32 URL-safe characters (randomBytes(24) in base64url).
function chatToken(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) {
    throw new NotFoundException('Chat not found');
  }
  return token;
}

// Intake from the public website (alldrive-website). Customers have no
// accounts: the website's server forwards each booking, inquiry and chat
// message here with the shared WEBSITE_API_KEY, and they appear live on the
// admin dashboard.
@Public()
@UseGuards(WebsiteKeyGuard)
@Controller('website')
export class WebsiteController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly inquiriesService: InquiriesService,
    private readonly chatService: ChatService,
  ) {}

  @Post('bookings')
  createBooking(@Body() dto: CreateBookingDto) {
    return this.bookingsService.createFromWebsite(dto);
  }

  // "Track my booking": booking code + the customer's email or mobile number.
  @Post('bookings/track')
  @HttpCode(200)
  trackBooking(@Body() dto: TrackBookingDto) {
    return this.bookingsService.track(dto.reference, dto.contact);
  }

  @Post('inquiries')
  createInquiry(@Body() dto: CreateInquiryDto) {
    return this.inquiriesService.createFromWebsite(dto);
  }

  // Live chat: start a conversation (returns the visitor's token).
  @Post('chats')
  startChat(@Body() dto: StartChatDto) {
    return this.chatService.start(dto);
  }

  @Post('chats/:token/messages')
  addChatMessages(
    @Param('token') token: string,
    @Body() dto: AddChatMessagesDto,
  ) {
    return this.chatService.addFromVisitor(chatToken(token), dto);
  }

  // The visitor's browser checks for replies.
  @Get('chats/:token')
  pollChat(@Param('token') token: string, @Query() query: ChatPollDto) {
    return this.chatService.pollForVisitor(chatToken(token), query.after);
  }
}
