import { getAuctionsStatsSchema } from '@/dtos/stats.dto';
import { z } from 'zod';
import { ZodOpenApiPathsObject } from 'zod-openapi';

const tags = ['Stats'];
const responseAuctionsStats = z.object({
  stats: z.array(
    z.object({
      completed: z.number(),
      cancelled: z.number(),
      date: z.string(),
      revenue: z.number(),
      interests: z.number()
    })
  )
});
export type ResponseAuctionsStats = z.infer<typeof responseAuctionsStats>;

export const statsDoc: ZodOpenApiPathsObject = {
  '/api/stats/auctions': {
    get: {
      tags,
      summary: 'Get auctions stats',
      requestParams: { query: getAuctionsStatsSchema },
      responses: {
        200: {
          summary: 'Auctions stats fetched successfully',
          content: { 'application/json': { schema: responseAuctionsStats } }
        },
        401: { summary: 'User is not authorized' }
      }
    }
  }
};
