import { db } from '@/db';
import { feedbacks, ResponseFeedback, selectFeedbacksSnapshot } from '@/db/feedbacks.schema';
import { selectUserSnapshot, users } from '@/db/users.schema';
import { postFeedbackSchema, queryFeedbacksSchema } from '@/dtos/feedbacks.dto';
import { ForbiddenException, UnauthorizedException } from '@/lib/exceptions';
import { encodeCursor } from '@/lib/utils';
import { handleAsync } from '@/middlewares/handle-async';
import { and, asc, desc, eq, gt, gte, lt, lte, or, SQL } from 'drizzle-orm';

export const postFeedback = handleAsync(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  if (req.user.role === 'admin') throw new ForbiddenException("Admins can't post feedback");

  const data = postFeedbackSchema.parse(req.body);
  await db.insert(feedbacks).values({ ...data, userId: req.user.id });

  return res.status(201).json({ message: 'Feedback posted successfully' });
});

export const getFeedbacks = handleAsync<
  unknown,
  { feedbacks: ResponseFeedback[]; cursor: string | undefined }
>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  if (req.user.role !== 'admin') throw new ForbiddenException('Only admins can access feedbacks');

  const query = queryFeedbacksSchema.parse(req.query);

  let cursorCondition: SQL<unknown> | undefined = lt(feedbacks.createdAt, new Date().toISOString());
  if (query.cursor && query.sort === 'asc')
    cursorCondition = or(
      gt(feedbacks.createdAt, query.cursor.value),
      and(eq(feedbacks.createdAt, query.cursor.value), gt(feedbacks.id, query.cursor.id))
    );
  if (query.cursor && query.sort === 'desc')
    cursorCondition = or(
      lt(feedbacks.createdAt, query.cursor.value),
      and(eq(feedbacks.createdAt, query.cursor.value), lt(feedbacks.id, query.cursor.id))
    );

  const result = await db
    .select({ ...selectFeedbacksSnapshot, user: selectUserSnapshot })
    .from(feedbacks)
    .innerJoin(users, eq(feedbacks.userId, users.id))
    .where(
      and(
        cursorCondition,
        query.rating ? eq(feedbacks.rating, query.rating) : undefined,
        query.from ? gte(feedbacks.createdAt, query.from) : undefined,
        query.to ? lte(feedbacks.createdAt, query.to) : undefined
      )
    )
    .limit(query.limit)
    .orderBy((t) => {
      if (query.sort === 'asc') return [asc(t.createdAt), asc(t.id)];
      return [desc(t.createdAt), desc(t.id)];
    })
    .groupBy(feedbacks.id);

  const lastResult = result[result.length - 1];
  let cursor: string | undefined = undefined;
  if (lastResult) {
    cursor = encodeCursor({ id: lastResult.id, value: lastResult.createdAt });
  }

  return res.json({
    cursor,
    feedbacks: result
  });
});
