import { responseFeedbackSchema } from '@/db/feedbacks.schema';
import { postFeedbackSchema, queryFeedbacksSchema } from '@/dtos/feedbacks.dto';
import { z } from 'zod';
import { ZodOpenApiPathsObject } from 'zod-openapi';

const tags = ['Feedback'];

export const feedbacksDoc: ZodOpenApiPathsObject = {
  '/api/feedbacks': {
    post: {
      tags,
      summary: 'Post a feedback',
      requestBody: {
        content: { 'application/json': { schema: postFeedbackSchema } }
      },
      responses: {
        201: { description: 'Feedback posted successfully' },
        401: { description: 'User is not authorized' },
        403: { description: "User is admin and can't post feedback" }
      }
    },
    get: {
      tags,
      summary: 'Fetch feedbacks',
      requestParams: { query: queryFeedbacksSchema },
      responses: {
        200: {
          description: 'Feedbacks fetched successfully',
          content: {
            'application/json': {
              schema: z.object({
                feedbacks: z.array(responseFeedbackSchema),
                cursor: z.string().optional()
              })
            }
          }
        }
      }
    }
  }
};
