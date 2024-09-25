import { createProductSchema, queryProductsSchema } from '@/dtos/products.dto';
import { ZodOpenApiPathsObject } from 'zod-openapi';

const tags = ['Product'];
export const productsDoc: ZodOpenApiPathsObject = {
  '/api/products': {
    get: {
      tags,
      summary: 'Fetch products',
      description: 'Provide different query params to apply filter',
      requestParams: {
        query: queryProductsSchema
      },
      responses: {
        200: {
          description: 'Fetched products successfully'
        },
        400: {
          description: 'Invalid query filters'
        }
      }
    },
    post: {
      tags,
      summary: 'Add new product',
      requestBody: {
        content: {
          'application/json': { schema: createProductSchema }
        }
      },
      responses: {
        201: { description: 'New product added successfully' },
        400: { description: 'Invalid request body payload' },
        401: { description: 'User is not authenticated' },
        403: { description: "Admins can't add new product" }
      }
    }
  }
};
