import { db } from '@/db';
import { auctions } from '@/db/auctions.schema';
import { UnauthorizedException } from '@/lib/exceptions';
import { handleAsync } from '@/middlewares/handle-async';
import { ResponseAuctionsStats } from '@/openapi/stats.doc';
import { and, eq, gte, sql } from 'drizzle-orm';

export const getAuctionsStats = handleAsync<unknown, ResponseAuctionsStats>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const startDate = new Date(currentYear - 1, currentMonth + 1);

  const result = await db
    .select({
      cancelled: sql<number>`cast(sum(${auctions.isCancelled}) as integer)`,
      completed: sql<number>`cast(sum(${auctions.isCompleted}) as integer)`,
      date: sql<string>`strftime('%Y-%m',${auctions.startsAt})`,
      revenue: sql<number>`cast(sum(${auctions.finalBid}) as integer)`
    })
    .from(auctions)
    .groupBy((t) => t.date)
    .where(and(gte(auctions.startsAt, startDate.toISOString()), eq(auctions.ownerId, req.user.id)));

  const finalResult = result.map((resultItem) => ({
    ...resultItem,
    revenue: resultItem.revenue || 0
  }));

  return res.json({ stats: finalResult });
});
