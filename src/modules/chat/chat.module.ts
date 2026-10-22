import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatConversation } from './entities/chat-conversation.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatConversation, ChatMessage, User]),
    NotificationsModule,
    PushModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
  // The website controller uses it for the visitor side.
  exports: [ChatService],
})
export class ChatModule {}
