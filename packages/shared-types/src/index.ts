/**
 * 共有型・DTO・ヘルパーの公開入口。
 *
 * NestJS（api）と Next.js（web）が同じ契約でヘルス・エラー・認証・市場データを扱えるようにする。
 * Python（analysis）とは OpenAPI / JSON で同期し、このパッケージには依存させない。
 */

export * from './health';
export * from './errors';
export * from './auth';
export * from './market';