import { MILLIS } from '@/lib/constants';
import { decodeCursor, formatPrice } from '@/lib/utils';
import { z } from 'zod';
import { imageSchema } from './users.dto';

export const registerAuctionSchema = z.object({
  title: z.string().trim().max(200, 'Too long title'),
  description: z.string().trim().max(1000, 'Too long description').optional(),
  productTitle: z.string().trim().max(200, 'Too long product title'),
  category: z.enum(['arts', 'electronics', 'realestate', 'others']).optional(),
  brand: z.string().max(50, 'Too long brand title').optional(),
  banner: imageSchema.optional(),
  productImages: z.array(imageSchema).max(3, 'Max 3 product images are allowed').optional(),
  lot: z.number().min(1).max(10, "Lot can't exceed 10"),
  condition: z.enum(['new', 'first-class', 'repairable']),
  isInviteOnly: z.boolean().default(false),
  startsAt: z
    .string({ required_error: 'Auction start time is required' })
    .datetime()
    .refine((startsAt) => {
      const date = new Date(startsAt);
      if (date.getTime() < Date.now() + MILLIS.DAY) {
        return false;
      }

      if (date.getMinutes() % 15 !== 0) {
        return false;
      }

      return true;
    }, 'The starting time of auction must be fall on 15 minutes interval starting the hour clock and should not be less than 24 hours from now')
    .transform((startsAt) => {
      const date = new Date(startsAt);
      date.setSeconds(0);
      date.setMilliseconds(0);
      return date.toISOString();
    }),
  minBid: z
    .number()
    .min(10_000, `Minimum bid for the auction must be at least ${formatPrice(10000, true)}`),
  minBidders: z
    .number()
    .min(2, 'Bidders must be at least 2')
    .max(100, "Bidders can't be more than 100")
    .default(2),
  maxBidders: z
    .number()
    .min(2, 'Bidders must be at least 2')
    .max(100, "Bidders can't be more than 100")
    .default(10)
});

export const queryAuctionsSchema = z
  .object({
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
    title: z.string().optional(),
    limit: z.preprocess((val) => Number(val) || undefined, z.number().min(1).max(100)).default(20),
    category: z.enum(['arts', 'electronics', 'realestate', 'others']).optional(),
    owner: z.string().optional(),
    sort: z
      .enum(['title_asc', 'title_desc', 'starts_at_asc', 'starts_at_desc', 'bid_asc', 'bid_desc'])
      .default('starts_at_desc'),
    condition: z.preprocess(
      (val) => (val === 'all' ? undefined : val),
      z.enum(['new', 'first-class', 'repairable']).optional()
    ),
    status: z.preprocess(
      (val) => (val === 'all' ? undefined : val),
      z.enum(['pending', 'live', 'completed', 'cancelled']).optional()
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
    inviteOnly: z.preprocess((val) => (val ? val === 'true' : undefined), z.boolean().optional()),
    unbidded: z.preprocess(
      (val) => (val === 'true' ? true : val === 'false' ? false : undefined),
      z.boolean().optional()
    )
  })
  .refine(({ cursor, sort }) => {
    if (!cursor?.value) return true;
    if ((sort === 'bid_asc' || sort === 'bid_desc') && isNaN(Number(cursor.value))) return false;
    return true;
  }, 'Invalid cursor');

export const cancelAuctionSchema = z.object({ cancelReason: z.string().optional() });

export const placeBidSchema = z.object({
  amount: z
    .number()
    .positive()
    .transform((val) => Math.round(val))
});

export const getBidsQuerySchema = z.object({
  cursor: z.preprocess(
    (val) => (val ? decodeCursor(val as string) : undefined),
    z
      .object(
        {
          value: z.string().datetime({ message: 'Invalid cursor' }),
          id: z.string()
        },
        { message: 'Invalid cursor' }
      )
      .optional()
  ),
  limit: z.preprocess((val) => Number(val) || undefined, z.number().min(1).max(100).default(20)),
  sort: z.enum(['asc', 'desc']).default('desc')
});

export const searchInviteUsersSchema = z.object({
  q: z.string().optional(),
  limit: z.preprocess((val) => Number(val) || undefined, z.number().min(1).max(100).default(20)),
  page: z.preprocess((val) => Number(val) || undefined, z.number().min(1).default(1))
});
