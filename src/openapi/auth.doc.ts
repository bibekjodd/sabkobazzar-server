import { selectUserSchema } from '@/db/users.schema';
import { loginUserSchema, registerUserSchema } from '@/dtos/auth.dto';
import { forgotPasswordSchema, resetPasswordSchema, updatePasswordSchema } from '@/dtos/users.dto';
import { z } from 'zod';
import { ZodOpenApiPathsObject } from 'zod-openapi';

const tags = ['Auth'];

export const authDoc: ZodOpenApiPathsObject = {
  '/api/auth/register': {
    post: {
      tags,
      summary: 'Register with credentials',
      requestBody: { content: { 'application/json': { schema: registerUserSchema } } },
      responses: {
        201: {
          description: 'Registered account successfully',
          content: {
            'application/json': {
              schema: z.object({ user: selectUserSchema.omit({ password: true }) })
            }
          }
        },
        400: { description: 'Invalid register data or user with same email already exists' }
      }
    }
  },
  '/api/auth/login': {
    post: {
      tags,
      summary: 'Login with credentials',
      requestBody: { content: { 'application/json': { schema: loginUserSchema } } },
      responses: {
        200: {
          description: 'Logged in successfully',
          content: {
            'application/json': {
              schema: z.object({ user: selectUserSchema.omit({ password: true }) })
            }
          }
        },
        400: { description: 'Invalid login credentials' }
      }
    }
  },
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
  },
  '/api/auth/password': {
    put: {
      tags,
      summary: 'Update password',
      requestBody: { content: { 'application/json': { schema: updatePasswordSchema } } },
      responses: {
        200: { description: 'Password updated successfully' },
        400: { description: 'Invalid password provided or user is logged from social account' },
        401: { description: 'User is not authorized' }
      }
    }
  },
  '/api/auth/password/forgot': {
    put: {
      tags,
      summary: 'Forgot password',
      requestBody: { content: { 'application/json': { schema: forgotPasswordSchema } } },
      responses: {
        200: { description: 'Password reset otp sent to mail' },
        400: {
          description:
            'User with the given email does not exist or user is logged in from social account or otp is already sent to mail'
        }
      }
    }
  },
  '/api/auth/password/reset': {
    put: {
      tags,
      summary: 'Reset password',
      requestBody: { content: { 'application/json': { schema: resetPasswordSchema } } },
      responses: {
        200: { description: 'Password reset successfully' },
        400: {
          description:
            'User with the provided email does not exist or otp invalid or user is logged in from social account'
        }
      }
    }
  }
};
