import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { User, UserRole } from '../users/entities/user.entity';

// Ensures at least one admin account exists so the system is usable on a fresh
// database. Credentials come from ADMIN_EMAIL / ADMIN_PASSWORD env vars.
@Injectable()
export class AdminSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    const existingAdmin = await this.userRepository.findOne({
      where: { role: UserRole.ADMIN },
    });
    if (existingAdmin) return;

    const email = (
      this.config.get<string>('ADMIN_EMAIL') ?? 'admin@alldrive.com'
    ).toLowerCase();
    const password = this.config.get<string>('ADMIN_PASSWORD') ?? 'admin1234';

    const admin = this.userRepository.create({
      name: 'Administrator',
      email,
      password: await bcrypt.hash(password, 10),
      role: UserRole.ADMIN,
    });
    await this.userRepository.save(admin);

    this.logger.log(`Seeded default admin account: ${email}`);
  }
}
