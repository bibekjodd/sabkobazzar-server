import { queryInterestsSchema } from '@/dtos/interests.dto';
import { responseProductSchema } from '@/schemas/products.schema';
import { z } from 'zod';
import { ZodOpenApiPathsObject } from 'zod-openapi';

const tags = ['Interests'];
export const interestsDoc: ZodOpenApiPathsObject = {
  '/api/interests/{id}': {
    post: {
      tags,
      summary: 'Set product as interested',
      requestParams: {
        path: z.object({ id: z.string() })
      },
      responses: {
        201: { description: 'Product set as interested successfully' },
        401: { description: 'User is not authorized' },
        404: { description: 'Product does not exist' }
      }
    },
    delete: {
      tags,
      summary: 'Unset product from interested',
      requestParams: {
        path: z.object({ id: z.string() })
      },
      responses: {
        200: { description: 'Product unset from interested successfully' },
        401: { description: 'User is not authorized' },
        404: { description: 'Product does not exist is is already unset interested' }
      }
    }
  },
  '/api/interests': {
    get: {
      tags,
      summary: 'Fetch the interested products list',
      requestParams: {
        query: queryInterestsSchema
      },
      responses: {
        200: {
          description: 'Fetch interested products list successfully',
          content: {
            'application/json': { schema: z.object({ interests: z.array(responseProductSchema) }) }
          }
        },
        400: { description: 'Invalid request query' },
        401: { description: 'User is not authorized' }
      }
    }
  }
};
