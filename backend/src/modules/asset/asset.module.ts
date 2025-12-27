import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asset } from './asset.entity';
import { AssetHistory } from './asset-history.entity';
import { Store } from '../store/store.entity';
import { AssetService } from './asset.service';
import { AssetController } from './asset.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Asset, AssetHistory, Store])],
  providers: [AssetService],
  controllers: [AssetController],
  exports: [AssetService, TypeOrmModule],
})
export class AssetModule {}
