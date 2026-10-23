import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { randomBytes } from 'crypto';

import {
  ChatConversation,
  ChatStatus,
} from './entities/chat-conversation.entity';
import { ChatMessage, ChatSender } from './entities/chat-message.entity';
import {
  AddChatMessagesDto,
  ChatsQueryDto,
  StartChatDto,
  WebsiteChatMessageDto,
} from './dto/chat.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { PushService } from '../push/push.service';
import { User } from '../users/entities/user.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuditActorType } from '../audit-logs/entities/audit-log.entity';
import { likePattern, pageOf } from '../../common/pagination';

// What the website visitor sees: no admin names, no internal ids beyond the message id.
const forVisitor = (m: ChatMessage) => ({
  id: m.id,
  sender: m.sender,
  body: m.body,
  createdAt: m.createdAt,
});

const preview = (text: string) =>
  text.length > 200 ? `${text.slice(0, 199)}…` : text;

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatConversation)
    private readonly conversations: Repository<ChatConversation>,
    @InjectRepository(ChatMessage)
    private readonly messages: Repository<ChatMessage>,
    private readonly notifications: NotificationsService,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly push: PushService,
    private readonly audit: AuditLogsService,
  ) {}

  // ---------- Website (visitor) side, called by the website's server ----------

  async start(dto: StartChatDto) {
    const token = randomBytes(24).toString('base64url');
    const conversation = await this.conversations.save(
      this.conversations.create({
        token,
        name: dto.name.trim(),
        contact: dto.contact.trim(),
        page: dto.page?.trim() || null,
      }),
    );
    const saved = await this.addMessages(conversation, dto.messages);

    const first = dto.messages.find((m) => m.sender === ChatSender.VISITOR);
    if (first) {
      this.notifications
        .notifyNewChat(conversation, `${conversation.name}: ${first.body}`)
        .catch(() => undefined);
      this.audit.record({
        action: 'chat.started',
        entityType: 'chat',
        entityId: conversation.id,
        entityLabel: conversation.name,
        summary: `New chat from the website: "${preview(first.body)}"`,
        actor: { type: AuditActorType.WEBSITE, name: conversation.name },
      });
    }
    return { token, messages: saved.map(forVisitor) };
  }

  async addFromVisitor(token: string, dto: AddChatMessagesDto) {
    const conversation = await this.byToken(token);
    // Writing again reopens a chat the team had closed.
    if (conversation.status === ChatStatus.CLOSED) {
      conversation.status = ChatStatus.OPEN;
    }
    const saved = await this.addMessages(conversation, dto.messages);
    return { messages: saved.map(forVisitor) };
  }

  // The visitor's browser checks for new messages (polling).
  async pollForVisitor(token: string, after = 0) {
    const conversation = await this.byToken(token);
    const messages = await this.messages.find({
      where: { conversationId: conversation.id, id: MoreThan(after) },
      order: { id: 'ASC' },
      take: 200,
    });
    return { status: conversation.status, messages: messages.map(forVisitor) };
  }

  // ---------- Admin side ----------

  // One page of the inbox, plus how many chats each tab has.
  async list(query: ChatsQueryDto) {
    const { page, limit, skip } = pageOf(query);
    const filter = query.filter ?? 'All';
    const like = likePattern(query.q);
    const search = (
      qb: ReturnType<Repository<ChatConversation>['createQueryBuilder']>,
    ) =>
      like
        ? qb.andWhere(
            '(c.name ILIKE :like OR c.contact ILIKE :like OR c.lastMessagePreview ILIKE :like)',
            { like },
          )
        : qb;
    const listQb = search(this.conversations.createQueryBuilder('c'))
      .orderBy('c.lastMessageAt', 'DESC')
      .skip(skip)
      .take(limit);
    if (filter !== 'All')
      listQb.andWhere('c.status = :status', { status: filter });
    const [[items, total], rows] = await Promise.all([
      listQb.getManyAndCount(),
      search(this.conversations.createQueryBuilder('c'))
        .select('c.status', 'status')
        .addSelect('COUNT(*)::int', 'count')
        .groupBy('c.status')
        .getRawMany<{ status: ChatStatus; count: number }>(),
    ]);
    const of = (s: ChatStatus) =>
      Number(rows.find((row) => row.status === s)?.count ?? 0);
    const counts = {
      Open: of(ChatStatus.OPEN),
      Closed: of(ChatStatus.CLOSED),
      All: of(ChatStatus.OPEN) + of(ChatStatus.CLOSED),
    };
    return { items, total, page, limit, counts };
  }

  // Opening a chat marks it read.
  async findOne(id: number) {
    const conversation = await this.byId(id);
    if (conversation.adminUnread > 0) {
      await this.conversations.update(id, { adminUnread: 0 });
      conversation.adminUnread = 0;
    }
    const messages = await this.messages.find({
      where: { conversationId: id },
      order: { id: 'ASC' },
    });
    return { ...conversation, messages };
  }

  async reply(id: number, body: string, adminId: number) {
    const conversation = await this.byId(id);
    const admin = await this.users.findOne({ where: { id: adminId } });
    const message = await this.messages.save(
      this.messages.create({
        conversationId: id,
        sender: ChatSender.ADMIN,
        body: body.trim(),
        authorName: admin?.name ?? null,
      }),
    );
    Object.assign(conversation, {
      adminUnread: 0,
      status: ChatStatus.OPEN,
      lastMessageAt: message.createdAt,
      lastMessagePreview: preview(`You: ${message.body}`),
    });
    await this.conversations.save(conversation);
    this.notifications.emitChat({ conversation, messages: [message] });
    this.audit.record({
      action: 'chat.replied',
      entityType: 'chat',
      entityId: id,
      entityLabel: conversation.name,
      summary: `Replied to ${conversation.name} in chat: "${preview(message.body)}"`,
    });
    return message;
  }

  async setStatus(id: number, status: ChatStatus) {
    const conversation = await this.byId(id);
    conversation.status = status;
    if (status === ChatStatus.CLOSED) conversation.adminUnread = 0;
    const previous = conversation.status;
    const saved = await this.conversations.save(conversation);
    this.notifications.emitChat({ conversation: saved, messages: [] });
    if (previous !== status) {
      this.audit.record({
        action: 'chat.status',
        entityType: 'chat',
        entityId: id,
        entityLabel: saved.name,
        summary: `${status === ChatStatus.CLOSED ? 'Closed' : 'Reopened'} the chat with ${saved.name}`,
      });
    }
    return saved;
  }

  // Hidden everywhere, but kept so it can be restored. The visitor's chat
  // window starts over while it's deleted.
  async remove(id: number) {
    const conversation = await this.byId(id);
    await this.conversations.softDelete(id);
    this.audit.record({
      action: 'chat.deleted',
      entityType: 'chat',
      entityId: id,
      entityLabel: conversation.name,
      summary: `Deleted the chat with ${conversation.name}`,
    });
    return { id, deleted: true };
  }

  async restore(id: number) {
    const conversation = await this.conversations.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!conversation) throw new NotFoundException('Chat not found');
    if (conversation.deletedAt) {
      await this.conversations.restore(id);
      this.audit.record({
        action: 'chat.restored',
        entityType: 'chat',
        entityId: id,
        entityLabel: conversation.name,
        summary: `Restored the chat with ${conversation.name}`,
      });
    }
    return this.byId(id);
  }

  // ---------- Helpers ----------

  // Saves visitor/automatic messages in order, updates the inbox fields and
  // tells the admins (live stream + push for visitor messages).
  private async addMessages(
    conversation: ChatConversation,
    input: WebsiteChatMessageDto[],
  ) {
    const saved: ChatMessage[] = [];
    for (const m of input) {
      saved.push(
        await this.messages.save(
          this.messages.create({
            conversationId: conversation.id,
            sender: m.sender,
            body: m.body.trim(),
          }),
        ),
      );
    }
    const fromVisitor = saved.filter((m) => m.sender === ChatSender.VISITOR);
    const last = saved[saved.length - 1];
    Object.assign(conversation, {
      adminUnread: conversation.adminUnread + fromVisitor.length,
      lastMessageAt: last.createdAt,
      lastMessagePreview: preview(
        (fromVisitor[fromVisitor.length - 1] ?? last).body,
      ),
    });
    const updated = await this.conversations.save(conversation);

    // Never send the token to the dashboards.
    const { token: _token, ...safe } = updated;
    void _token;
    this.notifications.emitChat({
      conversation: safe,
      messages: saved,
    });
    if (fromVisitor.length) {
      void this.push.notifyAdminsOfChat(
        conversation,
        fromVisitor[fromVisitor.length - 1].body,
      );
    }
    return saved;
  }

  private async byToken(token: string) {
    const conversation = await this.conversations.findOne({ where: { token } });
    if (!conversation) throw new NotFoundException('Chat not found');
    return conversation;
  }

  private async byId(id: number) {
    const conversation = await this.conversations.findOne({ where: { id } });
    if (!conversation) throw new NotFoundException('Chat not found');
    return conversation;
  }
}
