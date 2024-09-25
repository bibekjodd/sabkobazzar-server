import { z } from 'zod';

const imageRegExp = new RegExp(`(https?://.*.(png|gif|webp|jpeg|jpg))`);
export const imageSchema = z
  .string({ invalid_type_error: 'Invalid image url' })
  .trim()
  .regex(imageRegExp, 'invalid image url')
  .max(300, 'Too long image uri');

export const updateProfileSchema = z
  .object({
    name: z.string().max(30, 'Too long name').optional(),
    image: imageSchema.optional(),
    phone: z
      .number()
      .refine((phone) => phone.toString().length === 10)
      .optional()
  })
  .refine((data) => Object.keys(data).length !== 0, 'Provide at least one property to update');

export const queryUsersSchema = z.object({
  q: z.string().optional(),
  limit: z.preprocess((val) => Number(val) || undefined, z.number().min(1).max(20).default(20)),
  page: z.preprocess((val) => Number(val) || 1, z.number().min(1).default(1))
});
