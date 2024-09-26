import { ZodOpenApiPathsObject } from 'zod-openapi';

const tags = ['Auth'];
export const authDoc: ZodOpenApiPathsObject = {
  '/api/auth/login/google': {
    get: {
      tags,
      summary: 'Login with google',
      description: 'User the authorize button above for login',
      responses: {
        302: { description: 'Redirect to Google for authentication' },
        401: { description: 'Authentication failed' }
      }
    }
  },
  '/api/auth/logout': {
    post: {
      tags,
      summary: 'Logout',
      responses: {
        200: { description: 'Logged out successfully' },
        401: { description: 'Unauthorized - Already logged out' }
      }
    }
  }
};
