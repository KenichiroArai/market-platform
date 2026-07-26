/**
 * 認証不要エンドポイントを示すメタデータ用定数・デコレータ。
 *
 * グローバル JwtAuthGuard がこのキーを見て、@Public() 付きハンドラをスキップする。
 */
import { SetMetadata } from '@nestjs/common';

/** Reflector が読むメタデータキー。 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * 認証を免除する。
 * health / register / login など、未ログインで叩ける API に付与する。
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
