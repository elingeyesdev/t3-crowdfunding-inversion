import { Module } from '@nestjs/common';
import { EntrepreneurController } from './controllers';
import { EntrepreneurService } from './services';
import {
  EntrepreneurProfileRepository,
  EntrepreneurCampaignRepository,
} from './repositories';
import { UsersModule } from '../users/user.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [UsersModule, NotificationsModule],
  controllers: [EntrepreneurController],
  providers: [
    EntrepreneurService,
    EntrepreneurProfileRepository,
    EntrepreneurCampaignRepository,
  ],
  exports: [
    EntrepreneurService,
    EntrepreneurProfileRepository,
    EntrepreneurCampaignRepository,
  ],
})
export class EntrepreneurModule {}
