import { Module } from '@nestjs/common';
import { CampaignService } from './services';
import { CampaignRepository } from './repositories';
import { EntrepreneurCampaignsController, PublicCampaignController, CampaignAnalyticsController } from './controllers';

@Module({
  controllers: [EntrepreneurCampaignsController, PublicCampaignController, CampaignAnalyticsController],
  providers: [CampaignService, CampaignRepository],
  exports: [CampaignService],
})
export class CampaignsModule {}
