import { Module } from '@nestjs/common';
import { InvestmentsController } from './controllers/investments.controller';
import { InvestmentsService } from './services/investments.service';
import { InvestmentsRepository } from './repositories/investments.repository';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [InvestmentsController],
  providers: [InvestmentsService, InvestmentsRepository],
  exports: [InvestmentsService],
})
export class InvestmentsModule {}
