import { Module } from '@nestjs/common';
import { RewardTierController } from './controllers/reward-tier.controller';
import { RewardTierService } from './services/reward-tier.service';
import { RewardTierRepository } from './repositories/reward-tier.repository';

@Module({
  controllers: [RewardTierController],
  providers: [RewardTierService, RewardTierRepository],
  exports: [RewardTierService, RewardTierRepository],
})
export class RewardTiersModule {}
