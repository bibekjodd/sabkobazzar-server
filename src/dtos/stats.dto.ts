import { z } from 'zod';

export const getAuctionsStatsSchema = z.object({
  user: z.string().optional()
});
