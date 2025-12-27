import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Schedule } from '../schedule/schedule.entity';
import { Maintenance } from '../maintenance/maintenance.entity';
import { User } from '../users/user.entity';
import { Store } from '../store/store.entity';
import { ReminderService } from './reminder.service';
import { TelegramService } from '../telegram/telegram.service';
import { ReminderController } from './reminder.controller';
import { MaintenanceModule } from '../maintenance/maintenance.module';

@Module({
  imports: [TypeOrmModule.forFeature([Schedule, Maintenance, User, Store]), MaintenanceModule],
  providers: [ReminderService, TelegramService],
  controllers: [ReminderController],
})
export class ReminderModule {}
