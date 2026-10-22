import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

import { ChatConversation } from './chat-conversation.entity';

export enum ChatSender {
  // The website visitor.
  VISITOR = 'visitor',
  // An admin replying from the dashboard.
  ADMIN = 'admin',
  // An automatic reply written by the website (greeting, quick answers).
  AUTO = 'auto',
}

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'int' })
  conversationId!: number;

  @ManyToOne(() => ChatConversation, (c) => c.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation!: ChatConversation;

  @Column({ type: 'enum', enum: ChatSender })
  sender!: ChatSender;

  @Column({ type: 'text' })
  body!: string;

  // The admin who wrote it (admin messages only). Shown to admins, not visitors.
  @Column({ type: 'varchar', length: 100, nullable: true })
  authorName!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
