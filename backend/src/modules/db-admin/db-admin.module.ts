import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Store } from '../store/store.entity';
import { Asset } from '../asset/asset.entity';
import { AssetHistory } from '../asset/asset-history.entity';
import { Schedule } from '../schedule/schedule.entity';
import { Maintenance } from '../maintenance/maintenance.entity';
import { AssetModule } from '../asset/asset.module';
import { DbAdminController } from './db-admin.controller';
import { DbAdminService } from './db-admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Store, Asset, AssetHistory, Schedule, Maintenance]), AssetModule],
  controllers: [DbAdminController],
  providers: [DbAdminService],
})
export class DbAdminModule {}
