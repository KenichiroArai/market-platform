/**
 * Prisma Watchlist / WatchlistItem 行を共有 DTO に変換するヘルパー。
 */
import {
  createWatchlistDto,
  createWatchlistItemDto,
  type WatchlistDto,
  type WatchlistItemDto,
} from '@market/shared-types';
import { toSymbolDto, type SymbolRow } from '../market-data/market-data.mapper';

/** Prisma WatchlistItem + Symbol の最小形。 */
export type WatchlistItemRow = {
  id: string;
  watchlistId: string;
  symbolId: string;
  createdAt: Date;
  updatedAt: Date;
  symbol: SymbolRow;
};

/** Prisma Watchlist + items の最小形。 */
export type WatchlistRow = {
  id: string;
  userId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  items: WatchlistItemRow[];
};

/** WatchlistItem 行を DTO に変換する。 */
export function toWatchlistItemDto(row: WatchlistItemRow): WatchlistItemDto {
  return createWatchlistItemDto({
    id: row.id,
    watchlistId: row.watchlistId,
    symbolId: row.symbolId,
    symbol: toSymbolDto(row.symbol),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

/** Watchlist 行を DTO に変換する。 */
export function toWatchlistDto(row: WatchlistRow): WatchlistDto {
  return createWatchlistDto({
    id: row.id,
    userId: row.userId,
    name: row.name,
    items: row.items.map(toWatchlistItemDto),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}
