import { responesUserSchema } from '@/schemas/users.schema';
import { z } from 'zod';
import { ZodOpenApiPathsObject } from 'zod-openapi';
import 'zod-openapi/extend';

const tags = ['Parcticipant'];
export const participantsDoc: ZodOpenApiPathsObject = {
  '/api/participants/{id}': {
    get: {
      tags,
      summary: 'Fetch participants list of the auction',
      requestParams: {
        path: z.object({ id: z.string() })
      },
      responses: {
        200: {
          description: 'Participants list fetched successfully',
          content: {
            'application/json': { schema: z.object({ participants: z.array(responesUserSchema) }) }
          }
        }
      }
    }
  },
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
  '/api/participants/{userId}/invite/{auctionId}': {
    put: {
      summary: 'Invite user to the auction',
      tags,
      requestParams: {
        path: z.object({ userId: z.string(), auctionId: z.string() })
      },
      responses: {
        200: { description: 'User invited successfully' },
        400: { description: 'Auction is already cancelled or finished or started' },
        401: { description: 'User is not authorized' },
        403: {
          description:
            'User is not the host of the auction or more than 50 users are already invited'
        },
        404: { description: 'Auction or user does not exist' }
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
