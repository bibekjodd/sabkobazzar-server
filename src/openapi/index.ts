import { apiReference } from '@scalar/express-api-reference';
import packageJson from 'package.json';
import { createDocument } from 'zod-openapi';
import { auctionsDoc } from './auctions.doc';
import { authDoc } from './auth.doc';
import { eventsDoc } from './events.doc';
import { feedbacksDoc } from './feedbacks.doc';
import { notificationsDoc } from './notifications.doc';
import { reportsDoc } from './reports.doc';
import { statsDoc } from './stats.doc';
import { usersDoc } from './users.doc';

export const openApiSpecs = createDocument({
  info: {
    title: 'Sabkobazzar Server',
    version: packageJson.version,
    description: 'Api documentation for Sabkobazzar server'
  },
  openapi: '3.1.0',
  paths: {
    '/': {
      get: {
        summary: 'Check server status',
        responses: {
          200: { description: 'Server is healthy and is running fine' }
        }
      }
    },
    '/doc': {
      get: {
        summary: 'Get openapi doc spec',
        responses: { 200: { description: 'Openapi specs doc fetched successfully' } }
      }
    },
    ...authDoc,
    ...usersDoc,
    ...auctionsDoc,
    ...notificationsDoc,
    ...eventsDoc,
    ...statsDoc,
    ...feedbacksDoc,
    ...reportsDoc
  },
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

export const serveApiReference = apiReference({
  spec: { content: openApiSpecs },
  theme: 'kepler',
  defaultHttpClient: { targetKey: 'javascript', clientKey: 'fetch' },
  layout: 'modern',
  darkMode: true
});
