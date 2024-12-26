import { db } from '@/db';
import { auctions } from '@/db/auctions.schema';
import { interests } from '@/db/interests.schema';
import { getAuctionsStatsSchema } from '@/dtos/stats.dto';
import { BadRequestException, UnauthorizedException } from '@/lib/exceptions';
import { handleAsync } from '@/middlewares/handle-async';
import { ResponseAuctionsStats } from '@/openapi/stats.doc';
import { and, count, eq, gte, sql, sum } from 'drizzle-orm';

export const getAuctionsStats = handleAsync<unknown, ResponseAuctionsStats>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();

  const query = getAuctionsStatsSchema.parse(req.query);
  if (req.user.role !== 'admin' && query.user)
    throw new BadRequestException('You are not allowed to access this resource');

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const startDate = new Date(currentYear - 1, currentMonth + 1);

  const interestsResultPromise = db
    .select({
      interests: count(interests.auctionId),
      date: sql<string>`strftime('%Y-%m',${interests.createdAt})`
    })
    .from(auctions)
    .leftJoin(
      interests,
      and(
        eq(auctions.id, interests.auctionId),
        query.user ? eq(auctions.ownerId, query.user) : undefined,
        req.user.role === 'user' ? eq(auctions.ownerId, req.user.id) : undefined,
        gte(interests.createdAt, startDate.toISOString())
      )
    )
    .groupBy((t) => t.date)
    .execute();

  const auctionsResultPromise = db
    .select({
      cancelled: sum(eq(auctions.status, 'cancelled')),
      completed: sum(eq(auctions.status, 'completed')),
      date: sql<string>`strftime('%Y-%m',${auctions.startsAt})`,
      revenue: sum(auctions.finalBid)
    })
    .from(auctions)
    .groupBy((t) => t.date)
    .where(
      and(
        gte(auctions.startsAt, startDate.toISOString()),
        query.user ? eq(auctions.ownerId, query.user) : undefined,
        req.user.role === 'user' ? eq(auctions.ownerId, req.user.id) : undefined
      )
    )
    .execute();

  const [interestsResult, auctionsResult] = await Promise.all([
    interestsResultPromise,
    auctionsResultPromise
  ]);

  const finalResult: ResponseAuctionsStats['stats'] = [];

  for (let i = 0; i < 12; i++) {
    const currentMonthDate = new Date();
    currentMonthDate.setMonth(currentMonthDate.getMonth() - i);
    const currentMonthDateString = currentMonthDate.toISOString().slice(0, 7);

    const auctionsResultItem = auctionsResult.find(
      (resultItem) => resultItem.date === currentMonthDateString
    );
    const interestsResultItem = interestsResult.find(
      (resultItem) => resultItem.date === currentMonthDateString
    );
    finalResult.push({
      date: currentMonthDateString,
      cancelled: Number(auctionsResultItem?.cancelled) || 0,
      completed: Number(auctionsResultItem?.completed) || 0,
      revenue: Number(auctionsResultItem?.revenue) || 0,
      interests: interestsResultItem?.interests || 0
    });
  }

  return res.json({ stats: finalResult });
});
