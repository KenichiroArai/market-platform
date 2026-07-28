import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { BacktestRunDto, SignalDefinitionDto } from '@market/shared-types';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  CreateSignalDefinitionDto,
  RunBacktestDto,
  UpdateSignalDefinitionDto,
} from './signals-backtests.dto';
import { SignalsBacktestsService } from './signals-backtests.service';

@ApiTags('signals-backtests')
@ApiBearerAuth()
@Controller()
export class SignalsBacktestsController {
  constructor(private readonly signalsBacktestsService: SignalsBacktestsService) {}

  @Get('signals')
  @ApiOkResponse({ description: 'Signal definition list' })
  listSignals(@CurrentUser() user: AuthenticatedUser): Promise<SignalDefinitionDto[]> {
    return this.signalsBacktestsService.listSignalDefinitions(user.id);
  }

  @Get('signals/:id')
  @ApiOkResponse({ description: 'Signal definition detail' })
  getSignal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<SignalDefinitionDto> {
    return this.signalsBacktestsService.getSignalDefinition(user.id, id);
  }

  @Post('signals')
  @ApiOkResponse({ description: 'Created signal definition' })
  createSignal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSignalDefinitionDto,
  ): Promise<SignalDefinitionDto> {
    return this.signalsBacktestsService.createSignalDefinition(user.id, dto);
  }

  @Patch('signals/:id')
  @ApiOkResponse({ description: 'Updated signal definition' })
  updateSignal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSignalDefinitionDto,
  ): Promise<SignalDefinitionDto> {
    return this.signalsBacktestsService.updateSignalDefinition(user.id, id, dto);
  }

  @Delete('signals/:id')
  @HttpCode(204)
  async removeSignal(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.signalsBacktestsService.removeSignalDefinition(user.id, id);
  }

  @Get('backtests')
  @ApiOkResponse({ description: 'Backtest run list' })
  listBacktests(@CurrentUser() user: AuthenticatedUser): Promise<BacktestRunDto[]> {
    return this.signalsBacktestsService.listBacktestRuns(user.id);
  }

  @Get('backtests/:id')
  @ApiOkResponse({ description: 'Backtest run detail' })
  getBacktest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<BacktestRunDto> {
    return this.signalsBacktestsService.getBacktestRun(user.id, id);
  }

  @Post('backtests/run')
  @ApiOkResponse({ description: 'Execute backtest and persist result' })
  runBacktest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RunBacktestDto,
  ): Promise<BacktestRunDto> {
    return this.signalsBacktestsService.runBacktest(user.id, dto);
  }
}
