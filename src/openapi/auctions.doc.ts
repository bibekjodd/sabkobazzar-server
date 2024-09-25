import { getUpcomingAuctionsQuerySchema, registerAuctionSchema } from '@/dtos/auctions.dto';
import { z } from 'zod';
import { ZodOpenApiPathsObject } from 'zod-openapi';
import 'zod-openapi/extend';

const tags = ['Auction'];

export const auctionsDoc: ZodOpenApiPathsObject = {
  '/api/auctions/{id}': {
    post: {
      tags,
      summary: 'Register for an auction',
      requestParams: {
        path: z.object({ id: z.string().openapi({ description: 'Product id' }) })
      },
      requestBody: {
        content: {
          'application/json': { schema: registerAuctionSchema }
        }
      },
      responses: {
        201: { description: 'Auction registered successfully' },
        400: { description: 'Invalid request body payload' },
        401: { description: 'User is not authenticated' },
        403: {
          description:
            'User is either admin or trying to register the auction to the products not owned by self or already has 5 pending auctions'
        }
      }
    },
    get: {
      tags,
      summary: 'Get auctions details',
      requestParams: { path: z.object({ id: z.string() }).openapi({ description: 'Auction id' }) },
      responses: {
        200: { description: 'Auctiond details fetched successfully' },
        404: { description: 'Auction does not exist' }
      }
    }
  },
  '/api/auctions/upcoming': {
    get: {
      tags,
      summary: 'Fetch the upcoming auctions list',
      requestParams: {
        query: getUpcomingAuctionsQuerySchema
      },
      responses: {
        200: { description: 'Upcoming auctions list fetched successfully' },
        400: { description: 'Invalid request query' }
      }
    }
  },
  '/api/auctions/recent': {
    get: {
      tags,
      summary: 'Fetch the recent auctions list',
      responses: {
        200: { description: 'Upcoming auctions list fetched successfully' }
      }
    }
  },
  '/api/auctions/{id}/cancel': {
    put: {
      tags,
      summary: 'Cancel auction',
      requestParams: {
        path: z.object({ id: z.string() }).openapi({ description: 'Auction id' })
      },
      responses: {
        200: { description: 'Auction cancelled successfully' },
        400: { description: 'Auction is already cancelled or finished' },
        401: { description: 'User is not authenticated' },
        403: { description: 'User is not admin or product owner to cancel the auction' },
        404: { description: 'Auction does not exist' }
      }
    }
  }
};
