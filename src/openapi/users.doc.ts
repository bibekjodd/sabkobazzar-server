import { updateProfileSchema } from '@/dtos/users.dto';
import { ZodOpenApiPathsObject } from 'zod-openapi';
import 'zod-openapi/extend';

const tags = ['User'];
export const usersDoc: ZodOpenApiPathsObject = {
  '/api/users/profile': {
    get: {
      tags,
      summary: 'Fetch profile',
      responses: {
        200: {
          description: 'User profile fetched successfully'
        },
        401: {
          description: 'User is not authenticated'
        }
      }
    },
    put: {
      tags,
      summary: 'Update Profile',
      requestBody: {
        content: {
          'application/json': {
            schema: updateProfileSchema.openapi({
              example: {}
            })
          }
        }
      },
      responses: {
        200: { description: 'Profile updated successfully' },
        400: { description: 'Invalid request body payload' },
        401: { description: 'User is not authenticated' }
      }
    }
  }
};
