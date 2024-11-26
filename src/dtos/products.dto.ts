import { decodeCursor } from '@/lib/utils';
import { z } from 'zod';
import { imageSchema } from './users.dto';

const categorySchema = z.enum(['electronics', 'realestate', 'arts', 'others']);

export const addProductSchema = z.object({
  title: z.string().trim().max(200, 'Too long title'),
  image: imageSchema.optional(),
  category: categorySchema.default('others'),
  description: z.string().trim().max(1000, 'Too long description'),
  price: z
    .number()
    .min(10_000, 'Price must be at least 10,000')
    .transform((price) => Math.ceil(price))
});

export const updateProductSchema = addProductSchema
  .partial()
  .refine((val) => Object.keys(val).length !== 0, 'Provide at least one property to update');

const priceFilterSchema = z.preprocess((val) => Number(val) || undefined, z.number().optional());
export const queryProductsSchema = z
  .object({
    cursor: z.preprocess(
      (val) => (val ? decodeCursor(val as string) : undefined),
      z
        .object(
          {
            id: z.string(),
            value: z.preprocess((val) => String(val), z.string())
          },
          { message: 'Invalid cursor' }
        )
        .optional()
    ),
    title: z.string().optional(),
    category: z.preprocess((val) => (val === 'all' ? undefined : val), categorySchema.optional()),
    pricegte: priceFilterSchema,
    pricelte: priceFilterSchema,
    limit: z.preprocess((val) => Number(val) || 20, z.number().min(1).max(100).default(20)),
    owner: z.string().optional(),
    interested: z.preprocess((val) => (val ? val === 'true' : undefined), z.boolean().optional()),
    sort: z
      .enum(['title_asc', 'title_desc', 'price_asc', 'price_desc', 'added_at_asc', 'added_at_desc'])
      .default('added_at_desc')
  })
  .refine(({ cursor, sort }) => {
    if (!cursor) return true;
    if ((sort === 'price_asc' || sort === 'price_desc') && isNaN(Number(cursor.value)))
      return false;
    return true;
  }, 'Invalid cursor');
