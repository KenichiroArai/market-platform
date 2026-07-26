/**
 * Phase 2 用の銘柄シード。
 *
 * US / JP の代表銘柄を少数投入し、価格同期ジョブの動作確認を容易にする。
 * 既存ティッカーは upsert で上書きせず、名前等のみ更新する。
 */
import { createPrismaClient } from '../src/index';

const SEED_SYMBOLS = [
  {
    ticker: 'AAPL',
    market: 'US' as const,
    name: 'Apple Inc.',
    currency: 'USD',
    exchange: 'NASDAQ',
  },
  {
    ticker: 'MSFT',
    market: 'US' as const,
    name: 'Microsoft Corporation',
    currency: 'USD',
    exchange: 'NASDAQ',
  },
  {
    ticker: '7203.T',
    market: 'JP' as const,
    name: 'Toyota Motor Corporation',
    currency: 'JPY',
    exchange: 'TSE',
  },
  {
    ticker: '6758.T',
    market: 'JP' as const,
    name: 'Sony Group Corporation',
    currency: 'JPY',
    exchange: 'TSE',
  },
];

async function main(): Promise<void> {
  const prisma = createPrismaClient();

  try {
    for (const row of SEED_SYMBOLS) {
      await prisma.symbol.upsert({
        where: {
          ticker_market: {
            ticker: row.ticker,
            market: row.market,
          },
        },
        create: {
          ...row,
          isActive: true,
        },
        update: {
          name: row.name,
          currency: row.currency,
          exchange: row.exchange,
          isActive: true,
        },
      });
    }

    console.log(`Seeded ${SEED_SYMBOLS.length} symbols`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
