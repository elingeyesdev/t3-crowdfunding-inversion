import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './config/database.module';
import { UsersModule } from './modules/users/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { EntrepreneurModule } from './modules/entrepreneur/entrepreneur.module';
import { InvestorModule } from './modules/investor/investor.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CampaignsModule } from './modules/campaigns/campaign.module';
import { AdminModule } from './modules/admin/admin.module';
import { InvestmentsModule } from './modules/investments/investments.module';
import { RewardTiersModule } from './modules/reward-tiers/reward-tiers.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ChatModule } from './modules/chat/chat.module';
import { AiSupportModule } from './modules/ai-support/ai-support.module';
import { AiCampaignModule } from './modules/ai-campaign/ai-campaign.module';
import { CommentsModule } from './modules/comments/comments.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    UsersModule,
    AuthModule,
    EntrepreneurModule,
    InvestorModule,
    CategoriesModule,
    CampaignsModule,
    AdminModule,
    InvestmentsModule,
    RewardTiersModule,
    NotificationsModule,
    ChatModule,
    AiSupportModule,
    AiCampaignModule,
    CommentsModule,
    ServeStaticModule.forRoot(
      {
        rootPath: join(process.cwd(), 'uploads'),
        serveRoot: '/uploads',
        serveStaticOptions: {
          index: false,
          redirect: false,
        },
      },
      {
        rootPath: join(process.cwd(), '../frontend/dist'),
        serveRoot: '/',
        serveStaticOptions: {
          index: 'index.html',
          redirect: true,
        },
      },
    ),
  ],
})
export class AppModule {}
