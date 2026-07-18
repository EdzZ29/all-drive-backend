import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UploadsModule } from './modules/uploads/uploads.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SettingsService } from './modules/settings/settings.service';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { AuditLogsController } from './modules/audit-logs/audit-logs.controller';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { DashboardService } from './modules/dashboard/dashboard.service';
import { ReportsModule } from './modules/reports/reports.module';
import { ReportsController } from './modules/reports/reports.controller';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { MaintenanceController } from './modules/maintenance/maintenance.controller';
import { PromosModule } from './modules/promos/promos.module';
import { PromosService } from './modules/promos/promos.service';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { ReviewsController } from './modules/reviews/reviews.controller';
import { DriversModule } from './modules/drivers/drivers.module';
import { DriversService } from './modules/drivers/drivers.service';
import { PaymentsModule } from './modules/payments/payments.module';
import { PaymentsController } from './modules/payments/payments.controller';
import { BookingsModule } from './modules/bookings/bookings.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { UsersModule } from './modules/users/users.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ClientsController } from './modules/clients/clients.controller';
import { ClientsService } from './modules/clients/clients.service';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: parseInt(config.get<string>('DB_PORT', '3000'), 10),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    ClientsModule,
    VehiclesModule,
    UsersModule,
    BookingsModule,
    PaymentsModule,
    DriversModule,
    ReviewsModule,
    PromosModule,
    MaintenanceModule,
    NotificationsModule,
    ReportsModule,
    DashboardModule,
    AuditLogsModule,
    SettingsModule,
    UploadsModule,
  ],
  controllers: [
    AppController,
    ClientsController,
    PaymentsController,
    ReviewsController,
    MaintenanceController,
    ReportsController,
    AuditLogsController,
  ],
  providers: [
    AppService,
    ClientsService,
    DriversService,
    PromosService,
    DashboardService,
    SettingsService,
  ],
})
export class AppModule {}
