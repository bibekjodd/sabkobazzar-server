import { decodeCursor } from '@/lib/utils';
import { z } from 'zod';
import { imageSchema } from './users.dto';

export const postReportSchema = z.object({
  title: z.string().min(10, 'Too short report title').trim().max(100, 'Too long report title'),
  text: z.string().trim().max(1000, 'Too long report description').optional(),
  images: z.array(imageSchema).max(3, "Can't post more than 3 images").optional()
});

export const respondToReportSchema = z.object({
  response: z.string().trim().max(1000, 'Too long response message')
});

export const queryReportsSchema = z.object({
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
  ),
  user: z.string().optional(),
  auction: z.string().optional(),
  responded: z.preprocess(
    (val) => (val === 'true' ? true : val === 'false' ? false : undefined),
    z.boolean().optional()
  )
});
