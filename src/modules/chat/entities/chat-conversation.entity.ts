import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  DeleteDateColumn,
} from 'typeorm';

import { ChatMessage } from './chat-message.entity';

export enum ChatStatus {
  OPEN = 'Open',
  CLOSED = 'Closed',
}

// A live chat started from the website's chat bubble. Visitors have no
// account: the website keeps the conversation's secret token in their browser
// and sends it with every message (through the website's server).
@Entity('chat_conversations')
export class ChatConversation {
  @PrimaryGeneratedColumn()
  id!: number;

  // Secret that identifies the visitor's browser. Never sent to admins.
  @Column({ type: 'varchar', length: 64, unique: true, select: false })
  token!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  // Mobile number, so the team can call or text if the visitor leaves.
  @Column({ type: 'varchar', length: 30 })
  contact!: string;

  // Website page the chat was started on, e.g. "/fleet/toyota-vios".
  @Column({ type: 'varchar', length: 120, nullable: true })
  page!: string | null;

  @Column({ type: 'enum', enum: ChatStatus, default: ChatStatus.OPEN })
  status!: ChatStatus;

  // Visitor messages the admins haven't opened yet.
  @Column({ type: 'int', default: 0 })
  adminUnread!: number;

  // For sorting the inbox and showing the latest line without loading messages.
  @Column({ type: 'timestamp', default: () => 'now()' })
  lastMessageAt!: Date;

  @Column({ type: 'varchar', length: 200, default: '' })
  lastMessagePreview!: string;

  @OneToMany(() => ChatMessage, (m) => m.conversation)
  messages!: ChatMessage[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Set when deleted from the dashboard (hidden everywhere; can be restored).
  @DeleteDateColumn()
  deletedAt!: Date | null;
}
