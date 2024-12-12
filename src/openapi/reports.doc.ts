import { responseReportSchema } from '@/db/reports.schema';
import { postReportSchema, queryReportsSchema } from '@/dtos/reports.dto';
import { z } from 'zod';
import { ZodOpenApiPathsObject } from 'zod-openapi';

const tags = ['Report'];

export const reportsDoc: ZodOpenApiPathsObject = {
  '/api/reports/:id': {
    post: {
      tags,
      summary: 'Report an auction',
      requestParams: {
        path: z.object({ id: z.string() })
      },
      requestBody: { content: { 'application/json': { schema: postReportSchema } } },
      responses: {
        201: { description: 'Report posted successfully' },
        401: { description: 'User is not authorized' },
        403: { description: "Admins can't post the report" }
      }
    },
    put: {
      tags,
      summary: 'Acknowledge report',
      requestParams: { path: z.object({ id: z.string() }) },
      responses: {
        200: { description: 'Report acknowledged successfully' },
        400: { description: 'Report is already responded' },
        401: { description: 'User is not authroized' },
        403: { description: 'Only admins can respond to report' }
      }
    }
  },
  '/api/reports': {
    get: {
      tags,
      summary: 'Fetch reports',
      requestParams: {
        query: queryReportsSchema
      },
      responses: {
        200: {
          description: 'Reports fetched successfully',
          content: {
            'application/json': {
              schema: z.object({
                cursor: z.string().optional(),
                reports: responseReportSchema
              })
            }
          }
        }
      }
    }
  }
};
