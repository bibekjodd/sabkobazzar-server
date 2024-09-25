import { createDocument, ZodOpenApiPathsObject } from 'zod-openapi';
import { auctionsDoc } from './auctions.doc';
import { bidsDoc } from './bids.doc';
import { participantsDoc } from './participants.doc';
import { productsDoc } from './products.doc';
import { usersDoc } from './users.doc';

export const openApiSpecs = createDocument({
  info: {
    title: 'Sabkobazzar Server',
    version: '1.0.0',
    description: 'Api documentation for Sabkobazzar server'
  },
  openapi: '3.0.0',
  paths: Object.assign(
    {
      '/': {
        get: {
          summary: 'Check server status',
          responses: {
            200: { description: 'Server is healthy and is running fine' }
          }
        }
      }
    } satisfies ZodOpenApiPathsObject,
    usersDoc,
    productsDoc,
    auctionsDoc,
    participantsDoc,
    bidsDoc
  )
});
