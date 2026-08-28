/**
 * 指標セット HTTP エンドポイント。
 *
 * すべて JWT 必須（グローバル Guard）。操作対象は CurrentUser の所有分のみ。
 */
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { IndicatorSetDto } from '@market/shared-types';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateIndicatorSetDto, UpdateIndicatorSetDto } from './indicator-sets.dto';
import { IndicatorSetsService } from './indicator-sets.service';

@ApiTags('indicator-sets')
@ApiBearerAuth()
@Controller('indicator-sets')
export class IndicatorSetsController {
  constructor(private readonly indicatorSetsService: IndicatorSetsService) {}

  /** 自分の指標セット一覧。 */
  @Get()
  @ApiOkResponse({ description: 'Indicator set list' })
  list(@CurrentUser() user: AuthenticatedUser): Promise<IndicatorSetDto[]> {
    return this.indicatorSetsService.list(user.id);
  }

  /** 新規作成。 */
  @Post()
  @ApiOkResponse({ description: 'Created indicator set' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateIndicatorSetDto,
  ): Promise<IndicatorSetDto> {
    return this.indicatorSetsService.create(user.id, dto);
  }

  /** 更新（上書き）。 */
  @Patch(':id')
  @ApiOkResponse({ description: 'Updated indicator set' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateIndicatorSetDto,
  ): Promise<IndicatorSetDto> {
    return this.indicatorSetsService.update(user.id, id, dto);
  }

  /** 削除。 */
  @Delete(':id')
  @HttpCode(204)
  @ApiOkResponse({ description: 'Deleted indicator set' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.indicatorSetsService.remove(user.id, id);
  }
}
