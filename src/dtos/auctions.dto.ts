import { z } from 'zod';
import { imageSchema } from './users.dto';

export const registerAuctionSchema = z.object({
  title: z.string().trim().max(200, 'Too long title'),
  description: z.string().trim().max(500, 'Too long description').optional(),
  isInviteOnly: z.boolean().default(false),
  banner: imageSchema.optional(),
  lot: z.number().min(1).max(10, "Lot can't exceed 10"),
  condition: z.enum(['new', 'first-class', 'repairable']),
  startsAt: z
    .string({ required_error: 'Auction start time is required' })
    .datetime()
    .refine((startsAt) => {
      const date = new Date(startsAt);
      if (date.getTime() < Date.now() + 24 * 60 * 60 * 1000) {
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
  minBid: z.number().min(10_000, 'Minimum bid for the auction must be at least Rs. 10,000'),
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

export const getUpcomingAuctionsQuerySchema = z.object({
  cursor: z
    .string()
    .datetime()
    .default(() => new Date().toISOString()),
  limit: z.preprocess((val) => Number(val) || 20, z.number().min(1).max(20)).default(20),
  owner: z.string().optional(),
  product: z.string().optional()
});
