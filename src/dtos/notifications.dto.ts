import { z } from 'zod';

export const getNotificationsQuerySchema = z.object({
  cursor: z
    .string()
    .datetime()
    .default(() => new Date().toISOString()),
  limit: z.preprocess((val) => Number(val) || undefined, z.number().min(1).max(100).default(20))
});
