import { responseAuctionSchema } from '@/db/auctions.schema';
import { responseBidSchema } from '@/db/bids.schema';
import { responseUserSchema } from '@/db/users.schema';
import {
  cancelAuctionSchema,
  getBidsQuerySchema,
  joinAutionSchema,
  placeBidSchema,
  queryAuctionsSchema,
  registerAuctionSchema,
  searchInviteUsersSchema
} from '@/dtos/auctions.dto';
import { z } from 'zod';
import { ZodOpenApiPathsObject } from 'zod-openapi';
import 'zod-openapi/extend';

const tags = ['Auction'];
export const auctionsDoc: ZodOpenApiPathsObject = {
  '/api/auctions/{id}': {
    get: {
      tags,
      summary: 'Get auctions details',
      requestParams: { path: z.object({ id: z.string() }).openapi({ description: 'Auction id' }) },
      responses: {
        200: {
          description: 'Auction details fetched successfully',
          content: { 'application/json': { schema: z.object({ auction: responseAuctionSchema }) } }
        },
        404: { description: 'Auction does not exist' }
      }
    }
  },
  '/api/auctions': {
    post: {
      tags,
      summary: 'Register for an auction',
      requestParams: {
        path: z.object({ id: z.string().openapi({ description: 'auctionId id' }) })
      },
      requestBody: {
        content: {
          'application/json': { schema: registerAuctionSchema }
        }
      },
      responses: {
        201: {
          description: 'Auction registered successfully',
          content: { 'application/json': { schema: z.object({ auction: responseAuctionSchema }) } }
        },
        400: { description: 'Invalid request body payload' },
        401: { description: 'User is not authenticated' },
        403: {
          description: 'User is either admin or already has 5 pending auctions'
        }
      }
    },
    get: {
      tags,
      summary: 'Fetch auctions',
      requestParams: {
        query: queryAuctionsSchema
      },
      responses: {
        200: {
          description: 'Upcoming auctions list fetched successfully',
          content: {
            'application/json': {
              schema: z.object({
                cursor: z.string().optional(),
                auctions: z.array(responseAuctionSchema)
              })
            }
          }
        },
        400: { description: 'Invalid request query' }
      }
    }
  },

  '/api/auctions/{id}/cancel': {
    put: {
      tags,
      summary: 'Cancel auction',
      requestParams: {
        path: z.object({ id: z.string() }).openapi({ description: 'Auction id' })
      },
      requestBody: {
        content: { 'application/json': { schema: cancelAuctionSchema } }
      },
      responses: {
        200: { description: 'Auction cancelled successfully' },
        400: { description: 'Auction is already cancelled or completed' },
        401: { description: 'User is not authenticated' },
        403: { description: 'User is not admin or Auction owner to cancel the auction' },
        404: { description: 'Auction does not exist' }
      }
    }
  },

  '/api/auctions/{id}/participants': {
    get: {
      tags,
      summary: 'Fetch participants list of the auction',
      requestParams: {
        path: z.object({ id: z.string() })
      },
      responses: {
        200: {
          description: 'Participants list fetched successfully',
          content: {
            'application/json': { schema: z.object({ participants: z.array(responseUserSchema) }) }
          }
        }
      }
    }
  },
  '/api/auctions/{id}/join': {
    put: {
      tags,
      summary: 'Join auction',
      requestParams: {
        path: z.object({ id: z.string() }).openapi({ description: 'Auction id' })
      },
      requestBody: { content: { 'application/json': { schema: joinAutionSchema } } },
      responses: {
        200: {
          description: 'User can join the auction and is ready to checkout',
          content: { 'application/json': { schema: z.object({ checkoutSessionId: z.string() }) } }
        },
        400: { description: 'Auction is already cancelled or completed' },
        401: { description: 'User is not authenticated' },
        403: { description: "Admins can't join the auction" },
        404: { description: 'Auction does not exist' }
      }
    }
  },
  '/api/auctions/{auctionId}/invite/{userId}': {
    put: {
      summary: 'Invite user to the auction',
      tags,
      requestParams: {
        path: z.object({ userId: z.string(), auctionId: z.string() })
      },
      responses: {
        200: { description: 'User invited successfully' },
        400: { description: 'Auction is already cancelled or completed or started' },
        401: { description: 'User is not authorized' },
        403: {
          description:
            'User is not the host of the auction or more than 50 users are already invited'
        },
        404: { description: 'Auction or user does not exist' }
      }
    }
  },

  '/api/auctions/{id}/search-invite': {
    get: {
      tags,
      summary: 'Search users for invitation to auction',
      requestParams: {
        path: z.object({ id: z.string() }),
        query: searchInviteUsersSchema
      },
      responses: {
        200: {
          description: 'Users list fetched successfully',
          content: {
            'application/json': {
              schema: z.object({
                users: z.array(
                  responseUserSchema.extend({
                    status: z.enum(['invited', 'joined', 'rejected', 'kicked']).nullable()
                  })
                )
              })
            }
          }
        },
        400: { description: 'Invalid request query' },
        401: { description: 'User is not authorized' }
      }
    }
  },

  '/api/auctions/{id}/leave': {
    put: {
      tags,
      summary: 'Leave auction',
      requestParams: {
        path: z.object({ id: z.string() }).openapi({ description: 'Auction id' })
      },
      responses: {
        200: { description: 'Left auction successfully' },
        400: { description: 'Auction is already cancelled or completed' },
        401: { description: 'User is not authenticated' },
        403: { description: "Aucton can't be left if there is only 6 hours to start" },
        404: { description: 'Auction does not exist' }
      }
    }
  },
  '/api/auctions/{auctionId}/kick/{userId}': {
    put: {
      tags,
      summary: 'Kick participant from the auction',
      requestParams: {
        path: z.object({
          userId: z.string(),
          auctionId: z.string()
        })
      },
      responses: {
        200: { description: 'Kicked participant successfully' }
      }
    }
  },

  '/api/auctions/{id}/bids': {
    get: {
      tags,
      summary: 'Fetch bids of an auction',
      requestParams: {
        path: z.object({ id: z.string() }).openapi({ description: 'Auction id' }),
        query: getBidsQuerySchema
      },
      responses: {
        200: {
          description: 'Bids list fetched successfully',
          content: {
            'application/json': {
              schema: z.object({ cursor: z.string().optional(), bids: z.array(responseBidSchema) })
            }
          }
        },
        400: { description: 'Invalid request query' }
      }
    },
    post: {
      tags,
      summary: 'Place a bid',
      requestParams: {
        path: z.object({ id: z.string() }).openapi({ description: 'Auction id' })
      },
      requestBody: { content: { 'application/json': { schema: placeBidSchema } } },
      responses: {
        201: {
          description: 'Bid placed successfully',
          content: { 'application/json': { schema: z.object({ bid: responseBidSchema }) } }
        },
        400: { description: 'Invalid amount sent for bid or auction has not started' },
        401: { description: 'User is not authenticated' },
        403: { description: "Admins can't place the bid" }
      }
    }
  },

  '/api/auctions/{id}/bids-snapshot': {
    get: {
      tags,
      summary: 'Get current bids snapshot',
      requestParams: {
        path: z.object({ id: z.string() }).openapi({ description: 'Auction id' })
      },
      responses: {
        200: {
          description: 'Bids snapshot fetched successfully',
          content: {
            'application/json': { schema: z.object({ bids: z.array(responseBidSchema) }) }
          }
        }
      }
    }
  },

  '/api/auctions/{id}/interested': {
    post: {
      tags,
      summary: 'Set Auction as interested',
      requestParams: {
        path: z.object({ id: z.string() })
      },
      responses: {
        201: { description: 'Auction set as interested successfully' },
        401: { description: 'User is not authorized' },
        404: { description: 'Auction does not exist' }
      }
    },
    delete: {
      tags,
      summary: 'Unset Auction from interested',
      requestParams: {
        path: z.object({ id: z.string() })
      },
      responses: {
        200: { description: 'Auction unset from interested successfully' },
        401: { description: 'User is not authorized' },
        404: { description: 'Auction does not exist is is already unset interested' }
      }
    }
  }
};
