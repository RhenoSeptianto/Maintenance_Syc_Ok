import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Maintenance } from './maintenance.entity';
import { Schedule } from '../schedule/schedule.entity';
import { MaintenanceService } from './maintenance.service';
import { AssetModule } from '../asset/asset.module';
import { MaintenanceController } from './maintenance.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Maintenance, Schedule]), AssetModule],
  providers: [MaintenanceService],
  controllers: [MaintenanceController],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
