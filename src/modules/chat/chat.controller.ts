import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';

import { ChatService } from './chat.service';
import { AdminReplyDto, UpdateChatDto } from './dto/chat.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../users/entities/user.entity';

// Admin inbox for the website's live chat. Visitors' messages arrive through
// WebsiteController (/website/chats); new ones are streamed live on
// /notifications/stream as "chat" events.
@Roles(UserRole.ADMIN)
@Controller('chats')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  findAll() {
    return this.chat.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.chat.findOne(id);
  }

  @Post(':id/messages')
  reply(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminReplyDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.chat.reply(id, dto.body, adminId);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateChatDto) {
    return this.chat.setStatus(id, dto.status);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.chat.remove(id);
  }
}
