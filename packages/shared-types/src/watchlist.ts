/**
 * ウォッチリスト API の共有 DTO。
 *
 * ユーザーが複数の名前付きリストを持ち、各リストは銘柄参照（WatchlistItem）を含む。
 */

import { isSymbolDto, type SymbolDto } from './market';

/** ウォッチリスト内の銘柄行。 */
export interface WatchlistItemDto {
  id: string;
  watchlistId: string;
  symbolId: string;
  symbol: SymbolDto;
  createdAt: string;
  updatedAt: string;
}

/** ウォッチリスト本体。詳細取得時は items を含む。 */
export interface WatchlistDto {
  id: string;
  userId: string;
  name: string;
  items: WatchlistItemDto[];
  createdAt: string;
  updatedAt: string;
}

/** ウォッチリスト作成リクエスト。 */
export interface CreateWatchlistRequest {
  name: string;
}

/** ウォッチリスト更新リクエスト（部分更新）。 */
export interface UpdateWatchlistRequest {
  name?: string;
}

/** ウォッチリストへ銘柄を追加するリクエスト。 */
export interface AddWatchlistItemRequest {
  symbolId: string;
}

/** WatchlistItemDto を組み立てるファクトリ。 */
export function createWatchlistItemDto(input: WatchlistItemDto): WatchlistItemDto {
  return {
    id: input.id,
    watchlistId: input.watchlistId,
    symbolId: input.symbolId,
    symbol: input.symbol,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

/** WatchlistDto を組み立てるファクトリ。 */
export function createWatchlistDto(input: WatchlistDto): WatchlistDto {
  return {
    id: input.id,
    userId: input.userId,
    name: input.name,
    items: input.items,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

/** 未知の JSON が WatchlistItemDto として妥当かを判定する。 */
export function isWatchlistItemDto(value: unknown): value is WatchlistItemDto {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.watchlistId === 'string' &&
    typeof record.symbolId === 'string' &&
    isSymbolDto(record.symbol) &&
    typeof record.createdAt === 'string' &&
    typeof record.updatedAt === 'string'
  );
}

/** 未知の JSON が WatchlistDto として妥当かを判定する。 */
export function isWatchlistDto(value: unknown): value is WatchlistDto {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    typeof record.userId !== 'string' ||
    typeof record.name !== 'string' ||
    !Array.isArray(record.items) ||
    typeof record.createdAt !== 'string' ||
    typeof record.updatedAt !== 'string'
  ) {
    return false;
  }

  return record.items.every((item) => isWatchlistItemDto(item));
}
