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

  const { rating, text } = postFeedbackSchema.parse(req.body);
  await db.insert(feedbacks).values({ rating, text, userId: req.user.id });

  return res.status(201).json({ message: 'Feedback posted successfully' });
});

export const getFeedbacks = handleAsync<
  unknown,
  { feedbacks: ResponseFeedback[]; cursor: string | undefined }
>(async (req, res) => {
  if (!req.user) throw new UnauthorizedException();
  if (req.user.role !== 'admin') throw new ForbiddenException('Only admins can access feedbacks');

  const { sort, cursor, from, rating, to, limit } = queryFeedbacksSchema.parse(req.query);

  let cursorCondition: SQL<unknown> | undefined = lt(feedbacks.createdAt, new Date().toISOString());
  if (cursor && sort === 'asc')
    cursorCondition = or(
      gt(feedbacks.createdAt, cursor.value),
      and(eq(feedbacks.createdAt, cursor.value), gt(feedbacks.id, cursor.id))
    );
  if (cursor && sort === 'desc')
    cursorCondition = or(
      lt(feedbacks.createdAt, cursor.value),
      and(eq(feedbacks.createdAt, cursor.value), lt(feedbacks.id, cursor.id))
    );

  const result = await db
    .select({ ...selectFeedbacksSnapshot, user: selectUserSnapshot })
    .from(feedbacks)
    .innerJoin(users, eq(feedbacks.userId, users.id))
    .where(
      and(
        cursorCondition,
        rating ? eq(feedbacks.rating, rating) : undefined,
        from ? gte(feedbacks.createdAt, from) : undefined,
        to ? lte(feedbacks.createdAt, to) : undefined
      )
    )
    .limit(limit)
    .orderBy((t) => {
      if (sort === 'asc') return [asc(t.createdAt), asc(t.id)];
      return [desc(t.createdAt), desc(t.id)];
    })
    .groupBy(feedbacks.id);

  const lastResult = result[result.length - 1];
  let cursorResponse: string | undefined = undefined;
  if (lastResult) {
    cursorResponse = encodeCursor({ id: lastResult.id, value: lastResult.createdAt });
  }

  return res.json({
    cursor: cursorResponse,
    feedbacks: result
  });
});
