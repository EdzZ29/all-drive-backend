import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { ChatSender } from '../entities/chat-message.entity';
import { ChatStatus } from '../entities/chat-conversation.entity';

export const MAX_CHAT_MESSAGE = 2000;

// A message the website adds for the visitor: their own text, or an automatic reply.
export class WebsiteChatMessageDto {
  @IsIn([ChatSender.VISITOR, ChatSender.AUTO])
  sender!: ChatSender.VISITOR | ChatSender.AUTO;

  @IsString()
  @Length(1, MAX_CHAT_MESSAGE)
  body!: string;
}

// Messages are sent together so a question and its automatic answer arrive in order.
class WebsiteChatMessagesDto {
  @ValidateNested({ each: true })
  @Type(() => WebsiteChatMessageDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  messages!: WebsiteChatMessageDto[];
}

export class StartChatDto extends WebsiteChatMessagesDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsString()
  @Length(7, 30)
  contact!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  page?: string;
}

export class AddChatMessagesDto extends WebsiteChatMessagesDto {}

export class ChatPollDto {
  // Only messages newer than this id.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  after?: number;
}

export class AdminReplyDto {
  @IsString()
  @Length(1, MAX_CHAT_MESSAGE)
  body!: string;
}

export class UpdateChatDto {
  @IsEnum(ChatStatus)
  status!: ChatStatus;
}
