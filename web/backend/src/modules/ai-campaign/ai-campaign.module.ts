import { Module } from '@nestjs/common';
import { AiCampaignController } from './ai-campaign.controller';
import { AiCampaignService } from './ai-campaign.service';

@Module({
  controllers: [AiCampaignController],
  providers: [AiCampaignService],
})
export class AiCampaignModule {}
