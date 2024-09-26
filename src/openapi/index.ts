import { createDocument, ZodOpenApiPathsObject } from 'zod-openapi';
import { auctionsDoc } from './auctions.doc';
import { authDoc } from './auth.doc';
import { bidsDoc } from './bids.doc';
import { notificationsDoc } from './notifications.doc';
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
    authDoc,
    usersDoc,
    productsDoc,
    auctionsDoc,
    participantsDoc,
    bidsDoc,
    notificationsDoc
  ),
  components: {
    securitySchemes: {
      googleOAuth2: {
        type: 'oauth2',
        flows: {
          authorizationCode: {
            authorizationUrl: '/api/auth/login/google',
            tokenUrl: '/api/auth/callback/google',
            scopes: {
              openid: 'Grants access to user profile and email'
            }
          }
        }
      }
    }
  }
});
