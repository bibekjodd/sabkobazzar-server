import { z } from 'zod';
import { imageSchema } from './users.dto';

const categorySchema = z.enum(['electronics', 'realestate', 'art', 'others']);

export const addProductSchema = z.object({
  title: z.string().max(200, 'Too long title'),
  image: imageSchema.optional(),
  category: categorySchema.default('others'),
  description: z.string().max(1000, 'Too long description'),
  price: z
    .number()
    .min(10_000, 'Price must be at least 10,000')
    .transform((price) => Math.ceil(price))
});

export const updateProductSchema = addProductSchema
  .partial()
  .refine((val) => Object.keys(val).length !== 0, 'Provide at least one property to update');

const priceFilterSchema = z.preprocess((val) => Number(val) || undefined, z.number().optional());
export const queryProductsSchema = z.object({
  title: z.string().optional(),
  category: categorySchema.optional(),
  pricegte: priceFilterSchema,
  pricelte: priceFilterSchema,
  limit: z.preprocess((val) => Number(val) || 20, z.number().min(1).max(100).default(20)),
  cursor: z
    .string()
    .datetime()
    .default(() => new Date().toISOString()),
  owner: z.string().optional(),
  interested: z.preprocess((val) => (val ? val === 'true' : undefined), z.boolean().optional())
});
