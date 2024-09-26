import { getNotificationsQuerySchema } from '@/dtos/notifications.dto';
import { ZodOpenApiPathsObject } from 'zod-openapi';

const tags = ['Notification'];
export const notificationsDoc: ZodOpenApiPathsObject = {
  '/api/notifications': {
    get: {
      tags,
      summary: 'Fetch notifications of user',
      requestParams: { query: getNotificationsQuerySchema },
      responses: {
        200: { description: 'Notifications fetched successfully' },
        400: { description: 'Invalid request query' },
        401: { description: 'User is not authorized' }
      }
    }
  }
};
