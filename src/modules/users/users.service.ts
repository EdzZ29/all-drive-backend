import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User, UserRole } from './entities/user.entity';

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
  ) {}

  async create(data: CreateUserData) {
    const existing = await this.userRepository.findOne({
      where: { email: data.email },
    });

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
    return this.userRepository.save(user);
  }

  // Deactivated admins can't sign in, and their open sessions end right away.
  async setActive(id: number, isActive: boolean, actingUserId: number) {
    if (id === actingUserId) {
      throw new BadRequestException("You can't deactivate your own account");
    }
    const user = await this.findOne(id);
    user.isActive = isActive;
    const saved = await this.userRepository.save(user);
    if (!isActive) await this.bumpTokenVersion(id);
    return saved;
  }

  // Bumping tokenVersion invalidates every JWT previously issued to this user.
  async bumpTokenVersion(id: number) {
    await this.userRepository.increment({ id }, 'tokenVersion', 1);
  }
}
