import { Module } from '@nestjs/common';
import { AdminController } from './controllers/admin.controller';
import { SuperAdminController } from './controllers/superadmin.controller';
import { AdminService } from './services/admin.service';
import { AdminRepository } from './repositories/admin.repository';
import { UsersModule } from '../users/user.module';
import { EntrepreneurModule } from '../entrepreneur/entrepreneur.module';
import { RewardTiersModule } from '../reward-tiers/reward-tiers.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [UsersModule, EntrepreneurModule, RewardTiersModule, NotificationsModule],
  controllers: [AdminController, SuperAdminController],
  providers: [AdminService, AdminRepository],
})
export class AdminModule {}
