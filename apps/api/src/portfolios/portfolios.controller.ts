/**
 * ポートフォリオ HTTP エンドポイント。
 *
 * すべて JWT 必須。詳細・一覧レスポンスに通貨別集計（totalsByCurrency）を含める。
 */
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
import type { PortfolioDto } from '@market/shared-types';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  AddPortfolioHoldingDto,
  CreatePortfolioDto,
  UpdatePortfolioDto,
  UpdatePortfolioHoldingDto,
} from './portfolios.dto';
import { PortfoliosService } from './portfolios.service';

@ApiTags('portfolios')
@ApiBearerAuth()
@Controller('portfolios')
export class PortfoliosController {
  constructor(private readonly portfoliosService: PortfoliosService) {}

  /** 自分のポートフォリオ一覧。 */
  @Get()
  @ApiOkResponse({ description: 'Portfolio list' })
  list(@CurrentUser() user: AuthenticatedUser): Promise<PortfolioDto[]> {
    return this.portfoliosService.list(user.id);
  }

  /** ポートフォリオ 1 件（holdings + 集計付き）。 */
  @Get(':id')
  @ApiOkResponse({ description: 'Portfolio detail' })
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<PortfolioDto> {
    return this.portfoliosService.getById(user.id, id);
  }

  /** 新規作成。 */
  @Post()
  @ApiOkResponse({ description: 'Created portfolio' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePortfolioDto,
  ): Promise<PortfolioDto> {
    return this.portfoliosService.create(user.id, dto);
  }

  /** 名前の部分更新。 */
  @Patch(':id')
  @ApiOkResponse({ description: 'Updated portfolio' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePortfolioDto,
  ): Promise<PortfolioDto> {
    return this.portfoliosService.update(user.id, id, dto);
  }

  /** 削除。 */
  @Delete(':id')
  @HttpCode(204)
  @ApiOkResponse({ description: 'Deleted portfolio' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.portfoliosService.remove(user.id, id);
  }

  /** 保有を追加。 */
  @Post(':id/holdings')
  @ApiOkResponse({ description: 'Portfolio with added holding' })
  addHolding(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddPortfolioHoldingDto,
  ): Promise<PortfolioDto> {
    return this.portfoliosService.addHolding(user.id, id, dto);
  }

  /** 保有を部分更新。 */
  @Patch(':id/holdings/:holdingId')
  @ApiOkResponse({ description: 'Portfolio with updated holding' })
  updateHolding(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('holdingId') holdingId: string,
    @Body() dto: UpdatePortfolioHoldingDto,
  ): Promise<PortfolioDto> {
    return this.portfoliosService.updateHolding(user.id, id, holdingId, dto);
  }

  /** 保有を削除。 */
  @Delete(':id/holdings/:holdingId')
  @ApiOkResponse({ description: 'Portfolio after holding removal' })
  removeHolding(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('holdingId') holdingId: string,
  ): Promise<PortfolioDto> {
    return this.portfoliosService.removeHolding(user.id, id, holdingId);
  }
}
