import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { StoreModule } from './modules/store/store.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { ReminderModule } from './modules/reminder/reminder.module';
import { AssetModule } from './modules/asset/asset.module';
import { DbAdminModule } from './modules/db-admin/db-admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.POSTGRES_HOST || 'localhost',
        port: Number(process.env.POSTGRES_PORT) || 5432,
        username: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || 'postgres',
        database: process.env.POSTGRES_DB || 'maintenance_db',
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: String(process.env.DB_SYNC || '').toLowerCase() === 'true',
        // Stabilitas koneksi DB
        retryAttempts: Number(process.env.DB_RETRY_ATTEMPTS || 10),
        retryDelay: Number(process.env.DB_RETRY_DELAY || 3000),
        keepConnectionAlive: true,
        logging: (process.env.DB_LOGGING || 'error').split(',').map(s=>s.trim()).filter(Boolean) as any,
        extra: {
          max: Number(process.env.DB_POOL_MAX || 10),
          idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT || 30000),
          connectionTimeoutMillis: Number(process.env.DB_CONN_TIMEOUT || 10000),
          keepAlive: true,
          statement_timeout: Number(process.env.DB_STMT_TIMEOUT || 8000),
          idle_in_transaction_session_timeout: Number(process.env.DB_IDLE_TX_TIMEOUT || 8000),
        },
      }),
    }),
  AuthModule,
  StoreModule,
  ScheduleModule,
  MaintenanceModule,
  UsersModule,
  ReminderModule,
  AssetModule,
  DbAdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
