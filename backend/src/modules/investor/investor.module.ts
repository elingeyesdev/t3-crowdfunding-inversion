import { Module } from '@nestjs/common';
import { InvestorController } from './controllers';
import { InvestorService } from './services';
import { InvestorProfileRepository } from './repositories';
import { UsersModule } from '../users/user.module';

@Module({
  imports: [UsersModule],
  controllers: [InvestorController],
  providers: [
    InvestorService,
    InvestorProfileRepository,
  ],
  exports: [InvestorService],
})
export class InvestorModule {}
