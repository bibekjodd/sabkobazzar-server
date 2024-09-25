import { z } from 'zod';
import { ZodOpenApiPathsObject } from 'zod-openapi';
import 'zod-openapi/extend';

const tags = ['Parcticipant'];
export const participantsDoc: ZodOpenApiPathsObject = {
  '/api/participants/{id}/join': {
    put: {
      tags,
      summary: 'Join auction',
      requestParams: {
        path: z.object({ id: z.string() }).openapi({ description: 'Auction id' })
      },
      responses: {
        200: { description: 'Joined auction successfully' },
        400: { description: 'Auction is already cancelled or completed' },
        401: { description: 'User is not authenticated' },
        403: { description: "Admins can't join the auction" },
        404: { description: 'Auction does not exist' }
      }
    }
  },
  '/api/participants/{id}/leave': {
    put: {
      tags,
      summary: 'Leave auction',
      requestParams: {
        path: z.object({ id: z.string() }).openapi({ description: 'Auction id' })
      },
      responses: {
        200: { description: 'Left auction successfully' },
        400: { description: 'Auction is already cancelled or completed' },
        401: { description: 'User is not authenticated' },
        403: { description: "Aucton can't be left if there is only 6 hours to start" },
        404: { description: 'Auction does not exist' }
      }
    }
  },
  '/api/participants/{userId}/kick/{auctionId}': {
    put: {
      tags,
      summary: 'Kick participant from the auction',
      requestParams: {
        path: z.object({
          userId: z.string(),
          auctionId: z.string()
        })
      },
      responses: {
        200: { description: 'Kicked participant successfully' }
      }
    }
  }
};
