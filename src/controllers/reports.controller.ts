import { db } from '@/db';
import { auctions } from '@/db/auctions.schema';
import { reports, ResponseReport, selectReportsSnapshot } from '@/db/reports.schema';
import { selectUserSnapshot, users } from '@/db/users.schema';
import { postReportSchema, queryReportsSchema, respondToReportSchema } from '@/dtos/reports.dto';
import { MILLIS } from '@/lib/constants';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException
} from '@/lib/exceptions';
import { encodeCursor } from '@/lib/utils';
import { handleAsync } from '@/middlewares/handle-async';
import { reportRespondedNotification } from '@/services/notifications.service';
import { and, asc, desc, eq, gt, gte, isNotNull, isNull, lt, lte, or, SQL } from 'drizzle-orm';

export const postReport = handleAsync<{ id: string }>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  if (req.user.role === 'admin') throw new ForbiddenException("Admins can't report the auction");

  const auctionId = req.params.id;

  const auctionPromise = db
    .select({ ownerId: auctions.ownerId })
    .from(auctions)
    .where(eq(auctions.id, auctionId))
    .execute()
    .then((res) => res[0]);

  const $24HoursBefore = new Date(Date.now() - MILLIS.DAY).toISOString();
  const reportsPromise = db
    .select({ id: reports.id })
    .from(reports)
    .where(and(eq(reports.userId, req.user.id), gt(reports.createdAt, $24HoursBefore)))
    .limit(10)
    .execute()
    .then((result) => result.length);

  const [auction, totalReportsPastDay] = await Promise.all([auctionPromise, reportsPromise]);

  if (!auction) throw new NotFoundException('Auction does not exist');
  if (totalReportsPastDay >= 10)
    throw new ForbiddenException(
      'You are not allowed to post more than 10 reports within 24 hours'
    );

  if (req.user.id === auction.ownerId)
    throw new ForbiddenException("You can't report your auction by self");

  const data = postReportSchema.parse(req.body);
  await db.insert(reports).values({ ...data, auctionId, userId: req.user.id });

  return res.status(201).json({ message: 'Reported auction successfully' });
});

export const respondToReport = handleAsync<{ id: string }>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  if (req.user.role !== 'admin') throw new ForbiddenException('Only admins can respond to report');

  const reportId = req.params.id;
  const { response } = respondToReportSchema.parse(req.body);

  const [report] = await db
    .select({
      response: reports.response,
      auction: {
        id: auctions.id,
        title: auctions.title
      },
      user: {
        id: users.id,
        name: users.name,
        email: users.email
      }
    })
    .from(reports)
    .where(eq(reports.id, reportId))
    .innerJoin(auctions, eq(reports.auctionId, auctions.id))
    .innerJoin(users, eq(reports.userId, users.id))
    .groupBy(reports.id);

  if (!report) throw new NotFoundException('Report does not exist');
  if (report.response) throw new BadRequestException('Report has already been responded');

  await Promise.all([
    db.update(reports).set({ response }).where(eq(reports.id, reportId)),
    reportRespondedNotification({ auction: report.auction, user: report.user })
  ]);

  return res.json({ message: 'Report responded successfully' });
});

export const queryReports = handleAsync<
  unknown,
  { cursor: string | undefined; reports: ResponseReport[] }
>(async (req, res) => {
  if (req.user?.role !== 'admin')
    throw new ForbiddenException('Only admins can access this resource');

  const query = queryReportsSchema.parse(req.query);

  let cursorCondition: SQL<unknown> | undefined = lt(reports.createdAt, new Date().toISOString());
  if (query.cursor && query.sort === 'asc')
    cursorCondition = or(
      gt(reports.createdAt, query.cursor.value),
      and(eq(reports.createdAt, query.cursor.value), gt(reports.id, query.cursor.value))
    );
  if (query.cursor && query.sort === 'desc')
    cursorCondition = or(
      lt(reports.createdAt, query.cursor.value),
      and(eq(reports.createdAt, query.cursor.value), lt(reports.id, query.cursor.value))
    );

  const result = await db
    .select({ ...selectReportsSnapshot, user: selectUserSnapshot })
    .from(reports)
    .where(
      and(
        cursorCondition,
        query.user ? eq(reports.userId, query.user) : undefined,
        query.auction ? eq(reports.auctionId, query.auction) : undefined,
        query.responded === true ? isNotNull(reports.response) : undefined,
        query.responded === false ? isNull(reports.response) : undefined,
        query.from ? gte(reports.createdAt, query.from) : undefined,
        query.to ? lte(reports.createdAt, query.to) : undefined
      )
    )
    .innerJoin(users, eq(reports.userId, users.id))
    .limit(query.limit)
    .orderBy((t) => {
      if (query.sort === 'asc') return [asc(t.createdAt), asc(t.id)];
      return [desc(t.createdAt), desc(t.id)];
    })
    .groupBy(reports.id);

  let cursor: string | undefined = undefined;
  const lastResult = result[result.length - 1];
  if (lastResult) {
    cursor = encodeCursor({ id: lastResult.id, value: lastResult.createdAt });
  }

  return res.json({ cursor, reports: result });
});
