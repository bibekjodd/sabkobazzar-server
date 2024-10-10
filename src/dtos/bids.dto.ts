import { z } from 'zod';

export const placeBidSchema = z.object({
  amount: z
    .number()
    .positive()
    .transform((val) => Math.round(val))
});

export const fetchBidsQuerySchema = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.preprocess((val) => Number(val) || 20, z.number().min(1).max(50)),
  order: z.enum(['asc', 'desc']).default('desc')
});
