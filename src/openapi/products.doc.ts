import { responseProductSchema } from '@/db/products.schema';
import { addProductSchema, queryProductsSchema, updateProductSchema } from '@/dtos/products.dto';
import { z } from 'zod';
import { ZodOpenApiPathsObject } from 'zod-openapi';
import 'zod-openapi/extend';

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
          description: 'Fetched products successfully',
          content: {
            'application/json': {
              schema: z.object({
                cursor: z.string().optional(),
                products: z.array(responseProductSchema)
              })
            }
          }
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
          'application/json': { schema: addProductSchema }
        }
      },
      responses: {
        201: {
          description: 'New product added successfully',
          content: { 'application/json': { schema: z.object({ product: responseProductSchema }) } }
        },
        400: { description: 'Invalid request body payload' },
        401: { description: 'User is not authenticated' },
        403: { description: "Admins can't add new product" }
      }
    }
  },
  '/api/products/{id}': {
    get: {
      tags,
      summary: 'Get product details',
      requestParams: {
        path: z.object({ id: z.string() }).openapi({ description: 'Product id' })
      },
      responses: {
        200: {
          description: 'Product details fetched successfully',
          content: { 'application/json': { schema: z.object({ product: responseProductSchema }) } }
        },
        404: { description: 'Product does not exist' }
      }
    },
    put: {
      tags,
      summary: 'Update product details',
      requestParams: {
        path: z.object({ id: z.string() })
      },
      requestBody: { content: { 'application/json': { schema: updateProductSchema } } },
      responses: {
        200: {
          description: 'Product updated successfully',
          content: { 'application/json': { schema: z.object({ product: responseProductSchema }) } }
        },
        400: { description: 'Invalid request body' },
        401: { description: 'User is not authorized' },
        403: {
          description: 'User is not owner of the product or the auction is pending for the product'
        },
        404: { description: 'Product does not exist' }
      }
    }
  },

  '/api/products/:id/interested': {
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
  }
};
