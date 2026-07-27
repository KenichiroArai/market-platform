/**
 * ウォッチリスト HTTP エンドポイント。
 *
 * すべて JWT 必須（グローバル Guard）。操作対象は CurrentUser の所有分のみ。
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
import type { WatchlistDto } from '@market/shared-types';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  AddWatchlistItemDto,
  CreateWatchlistDto,
  UpdateWatchlistDto,
} from './watchlists.dto';
import { WatchlistsService } from './watchlists.service';

@ApiTags('watchlists')
@ApiBearerAuth()
@Controller('watchlists')
export class WatchlistsController {
  constructor(private readonly watchlistsService: WatchlistsService) {}

  /** 自分のウォッチリスト一覧。 */
  @Get()
  @ApiOkResponse({ description: 'Watchlist list' })
  list(@CurrentUser() user: AuthenticatedUser): Promise<WatchlistDto[]> {
    return this.watchlistsService.list(user.id);
  }

  /** ウォッチリスト 1 件（items 付き）。 */
  @Get(':id')
  @ApiOkResponse({ description: 'Watchlist detail' })
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<WatchlistDto> {
    return this.watchlistsService.getById(user.id, id);
  }

  /** 新規作成。 */
  @Post()
  @ApiOkResponse({ description: 'Created watchlist' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWatchlistDto,
  ): Promise<WatchlistDto> {
    return this.watchlistsService.create(user.id, dto);
  }

  /** 名前の部分更新。 */
  @Patch(':id')
  @ApiOkResponse({ description: 'Updated watchlist' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateWatchlistDto,
  ): Promise<WatchlistDto> {
    return this.watchlistsService.update(user.id, id, dto);
  }

  /** 削除。 */
  @Delete(':id')
  @HttpCode(204)
  @ApiOkResponse({ description: 'Deleted watchlist' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.watchlistsService.remove(user.id, id);
  }

  /** 銘柄を追加。 */
  @Post(':id/items')
  @ApiOkResponse({ description: 'Watchlist with added item' })
  addItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddWatchlistItemDto,
  ): Promise<WatchlistDto> {
    return this.watchlistsService.addItem(user.id, id, dto);
  }

  /** 銘柄行を削除。 */
  @Delete(':id/items/:itemId')
  @ApiOkResponse({ description: 'Watchlist after item removal' })
  removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ): Promise<WatchlistDto> {
    return this.watchlistsService.removeItem(user.id, id, itemId);
  }
}
