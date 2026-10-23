import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User, UserRole } from './entities/user.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

interface CreateUserData {
  name: string;
  email: string;
  password: string; // already hashed
  phone?: string;
  role?: UserRole;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly audit: AuditLogsService,
  ) {}

  async create(data: CreateUserData) {
    // Deleted admins keep their email, so they can be restored.
    const existing = await this.userRepository.findOne({
      where: { email: data.email },
      withDeleted: true,
    });

    if (existing?.deletedAt) {
      throw new ConflictException(
        'An admin with this email was deleted. Restore them from the Activity log instead.',
      );
    }
    if (existing) throw new ConflictException('Email already registered');

    const user = this.userRepository.create({
      ...data,
      role: data.role ?? UserRole.ADMIN,
    });

    return this.userRepository.save(user);
  }

  findAll() {
    return this.userRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: number) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  findByEmail(email: string) {
    return this.userRepository.findOne({ where: { email } });
  }

  // Includes the password column, which is excluded from default selects.
  findByEmailWithPassword(email: string) {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  findByIdWithPassword(id: number) {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id })
      .getOne();
  }

  async setPassword(id: number, passwordHash: string) {
    await this.userRepository.update({ id }, { password: passwordHash });
  }

  async updateProfile(id: number, data: { name?: string; phone?: string }) {
    const user = await this.findOne(id);
    if (data.name !== undefined) user.name = data.name.trim();
    if (data.phone !== undefined) user.phone = data.phone.trim();
    const saved = await this.userRepository.save(user);
    this.audit.forgetName(id);
    this.audit.record({
      action: 'account.profile',
      entityType: 'account',
      entityId: id,
      entityLabel: saved.name,
      summary: `${saved.name} updated their profile`,
    });
    return saved;
  }

  // Deactivated admins can't sign in, and their open sessions end right away.
  async setActive(id: number, isActive: boolean, actingUserId: number) {
    if (id === actingUserId) {
      throw new BadRequestException("You can't deactivate your own account");
    }
    const user = await this.findOne(id);
    if (!isActive) await this.assertAnotherActiveAdmin(id);
    user.isActive = isActive;
    const saved = await this.userRepository.save(user);
    if (!isActive) await this.bumpTokenVersion(id);
    this.audit.record({
      action: isActive ? 'admin.activated' : 'admin.deactivated',
      entityType: 'admin',
      entityId: id,
      entityLabel: saved.name,
      summary: `${isActive ? 'Turned on' : 'Turned off'} the account of ${saved.name}`,
    });
    return saved;
  }

  // Deleted admins can't sign in and their sessions end, but the account is kept
  // (with its history) so it can be restored.
  async remove(id: number, actingUserId: number) {
    if (id === actingUserId) {
      throw new BadRequestException("You can't delete your own account");
    }
    const user = await this.findOne(id);
    if (user.isActive) await this.assertAnotherActiveAdmin(id);
    await this.userRepository.softDelete(id);
    await this.bumpTokenVersion(id);
    this.audit.record({
      action: 'admin.deleted',
      entityType: 'admin',
      entityId: id,
      entityLabel: user.name,
      summary: `Deleted the admin account of ${user.name} (${user.email})`,
    });
    return { id, deleted: true };
  }

  async restore(id: number) {
    const user = await this.userRepository.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.deletedAt) {
      await this.userRepository.restore(id);
      this.audit.record({
        action: 'admin.restored',
        entityType: 'admin',
        entityId: id,
        entityLabel: user.name,
        summary: `Restored the admin account of ${user.name}`,
      });
    }
    return this.findOne(id);
  }

  // Someone must always be able to sign in.
  private async assertAnotherActiveAdmin(exceptId: number) {
    const others = await this.userRepository
      .createQueryBuilder('u')
      .where('u.isActive = true AND u.id != :id', { id: exceptId })
      .getCount();
    if (others === 0) {
      throw new BadRequestException('Keep at least one active admin account');
    }
  }

  // Bumping tokenVersion invalidates every JWT previously issued to this user.
  async bumpTokenVersion(id: number) {
    await this.userRepository.increment({ id }, 'tokenVersion', 1);
  }
}
