import { db } from '@/db';
import { auctions } from '@/db/auctions.schema';
import { UnauthorizedException } from '@/lib/exceptions';
import { handleAsync } from '@/middlewares/handle-async';
import { ResponseAuctionsStats } from '@/openapi/stats.doc';
import { and, eq, gte, sql, sum } from 'drizzle-orm';

export const getAuctionsStats = handleAsync<unknown, ResponseAuctionsStats>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const startDate = new Date(currentYear - 1, currentMonth + 1);

  const result = await db
    .select({
      cancelled: sum(eq(auctions.status, 'cancelled')),
      completed: sum(eq(auctions.status, 'completed')),
      date: sql<string>`strftime('%Y-%m',${auctions.startsAt})`,
      revenue: sum(auctions.finalBid)
    })
    .from(auctions)
    .groupBy((t) => t.date)
    .where(and(gte(auctions.startsAt, startDate.toISOString()), eq(auctions.ownerId, req.user.id)));

  const finalResult = result.map((resultItem) => ({
    ...resultItem,
    cancelled: Number(resultItem.cancelled) || 0,
    completed: Number(resultItem.completed) || 0,
    revenue: Number(resultItem.revenue) || 0
  }));

  return res.json({ stats: finalResult });
});
