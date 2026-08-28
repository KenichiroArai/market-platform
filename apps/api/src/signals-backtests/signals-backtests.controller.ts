import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type {
  BacktestRunDto,
  BacktestRunListItemDto,
  DeleteBacktestRunsResponse,
  OptimizeBacktestResponse,
  SignalDefinitionDto,
} from '@market/shared-types';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  BacktestRunSearchQueryDto,
  CreateSignalDefinitionDto,
  OptimizeBacktestDto,
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
  @ApiOkResponse({ description: 'Backtest run list (searchable, lightweight)' })
  listBacktests(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BacktestRunSearchQueryDto,
  ): Promise<BacktestRunListItemDto[]> {
    return this.signalsBacktestsService.listBacktestRuns(user.id, query);
  }

  @Delete('backtests')
  @ApiOkResponse({ description: 'Bulk soft-delete backtest runs matching search query' })
  removeBacktests(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: BacktestRunSearchQueryDto,
  ): Promise<DeleteBacktestRunsResponse> {
    return this.signalsBacktestsService.removeBacktestRuns(user.id, query);
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

  @Post('backtests/optimize')
  @ApiOkResponse({ description: 'Brute-force SMA Cross params (not persisted)' })
  optimizeBacktest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: OptimizeBacktestDto,
  ): Promise<OptimizeBacktestResponse> {
    return this.signalsBacktestsService.optimizeBacktest(user.id, dto);
  }

  @Delete('backtests/:id')
  @HttpCode(204)
  async removeBacktest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.signalsBacktestsService.removeBacktestRun(user.id, id);
  }
}
