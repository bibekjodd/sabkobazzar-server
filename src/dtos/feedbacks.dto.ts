import { decodeCursor } from '@/lib/utils';
import { z } from 'zod';

export const postFeedbackSchema = z.object({
  rating: z.number().min(1).max(5),
  text: z.string().trim().max(200, 'Too long feedback text')
});

export const queryFeedbacksSchema = z.object({
  cursor: z.preprocess(
    (val) => (val ? decodeCursor(val as string) : undefined),
    z
      .object(
        {
          id: z.string(),
          value: z.preprocess((val) => String(val || ''), z.string())
        },
        { message: 'Invalid cursor' }
      )
      .optional()
  ),
  sort: z.enum(['asc', 'desc']).default('desc'),
  rating: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number().min(1).max(5).optional()
  ),
  from: z
    .union([
      z
        .string()
        .date()
        .transform((val) => new Date(val).toISOString()),
      z.string().datetime()
    ])
    .optional(),
  to: z
    .union([
      z
        .string()
        .date()
        .transform((val) => {
          const to = new Date(val);
          to.setDate(to.getDate() + 1);
          return to.toISOString();
        }),
      z.string().datetime()
    ])
    .optional(),
  limit: z.preprocess(
    (val) => (val ? Number(val) : undefined),
    z.number().min(1).max(100).default(20)
  )
});
