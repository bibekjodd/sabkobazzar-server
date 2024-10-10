import { fetchBidsQuerySchema, placeBidSchema } from '@/dtos/bids.dto';
import { responseBidSchema } from '@/schemas/bids.schema';
import { z } from 'zod';
import { ZodOpenApiPathsObject } from 'zod-openapi';
import 'zod-openapi/extend';

const tags = ['Bid'];
export const bidsDoc: ZodOpenApiPathsObject = {
  '/api/bids/{id}': {
    get: {
      tags,
      summary: 'Fetch bids of an auction',
      requestParams: {
        path: z.object({ id: z.string() }).openapi({ description: 'Auction id' }),
        query: fetchBidsQuerySchema
      },
      responses: {
        200: {
          description: 'Bids list fetched successfully',
          content: {
            'application/json': { schema: z.object({ bids: z.array(responseBidSchema) }) }
          }
        },
        400: { description: 'Invalid request query' }
      }
    },
    put: {
      tags,
      summary: 'Place a bid',
      requestParams: {
        path: z.object({ id: z.string() }).openapi({ description: 'Auction id' })
      },
      requestBody: { content: { 'application/json': { schema: placeBidSchema } } },
      responses: {
        200: {
          description: 'Bid placed successfully',
          content: { 'application/json': { schema: z.object({ bid: responseBidSchema }) } }
        },
        400: { description: 'Invalid amount sent for bid or auction has not started' },
        401: { description: 'User is not authenticated' },
        403: { description: "Admins can't place the bid" }
      }
    }
  },

  '/api/bids/{id}/snapshot': {
    get: {
      tags,
      summary: 'Get current bids snapshot',
      requestParams: {
        path: z.object({ id: z.string() }).openapi({ description: 'Auction id' })
      },
      responses: {
        200: { description: 'Bids snapshot fetched successfully' }
      }
    }
  }
};
