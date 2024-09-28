import { sendMessageSchema } from '@/dtos/events.dto';
import { z } from 'zod';
import { ZodOpenApiPathsObject } from 'zod-openapi';

const tags = ['Events'];

export const eventsDoc: ZodOpenApiPathsObject = {
  '/api/events/auctions/{id}/join': {
    put: {
      tags,
      summary: 'Notify other participants when user joins live auction',
      requestParams: {
        path: z.object({ id: z.string() })
      },
      responses: {
        200: { description: 'Notified successfully' },
        401: { description: 'User is not authorized' },
        403: { description: 'User does not belong to the auction' }
      }
    }
  },
  '/api/events/auctions/{id}/leave': {
    put: {
      tags,
      summary: 'Notify other participants when user leaves the auction',
      requestParams: {
        path: z.object({ id: z.string() })
      },
      responses: {
        200: { description: 'Notified successfully' },
        401: { description: 'User is not authorized' },
        403: { description: 'User does not belong tot he auction' }
      }
    }
  },
  '/api/events/auctions/{id}/message': {
    put: {
      tags,
      summary: 'Send message or emoji on the live auction',
      requestParams: {
        path: z.object({ id: z.string() })
      },
      requestBody: {
        content: { 'application/json': { schema: sendMessageSchema } }
      },
      responses: {
        200: { description: 'Message sent successfully' },
        401: { description: 'User is not authorized' },
        400: { description: 'Invalid request body' },
        403: { description: 'User does not belong tot he auction' }
      }
    }
  }
};
