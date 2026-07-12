import {
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
      role: data.role ?? UserRole.CLIENT,
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

  // Bumping tokenVersion invalidates every JWT previously issued to this user.
  async bumpTokenVersion(id: number) {
    await this.userRepository.increment({ id }, 'tokenVersion', 1);
  }
}
