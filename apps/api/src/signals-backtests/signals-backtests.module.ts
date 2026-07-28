import { Module } from '@nestjs/common';
import { MarketDataModule } from '../market-data/market-data.module';
import { PrismaModule } from '../prisma.module';
import { SignalsBacktestsController } from './signals-backtests.controller';
import { SignalsBacktestsService } from './signals-backtests.service';

@Module({
  imports: [PrismaModule, MarketDataModule],
  controllers: [SignalsBacktestsController],
  providers: [SignalsBacktestsService],
})
export class SignalsBacktestsModule {}
