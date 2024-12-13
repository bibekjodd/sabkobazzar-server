import { z } from 'zod';

const imageRegExp = new RegExp(`(https?://.*.(png|gif|webp|jpeg|jpg))`);
export const imageSchema = z
  .string({ invalid_type_error: 'Invalid image url' })
  .trim()
  .regex(imageRegExp, 'invalid image url')
  .max(300, 'Too long image uri');

export const updateProfileSchema = z
  .object({
    name: z
      .string()
      .max(30, 'Too long name')
      .trim()
      .transform((name) => name.split(' ').slice(0, 3).join(' '))
      .optional(),
    image: imageSchema.optional(),
    phone: z
      .number()
      .refine((phone) => phone.toString().length === 10, 'Invalid phone number')
      .optional()
  })
  .refine((data) => Object.keys(data).length !== 0, 'Provide at least one property to update');

export const queryUsersSchema = z.object({
  q: z.string().optional(),
  limit: z.preprocess((val) => Number(val) || undefined, z.number().min(1).max(20).default(20)),
  page: z.preprocess((val) => Number(val) || undefined, z.number().min(1).default(1))
});

export const verifyUserSchema = z.object({
  otp: z.string({ required_error: 'Invalid otp' }).length(6, 'Invalid otp')
});

export const updatePasswordSchema = z.object({
  oldPassword: z.string({ required_error: 'Old password is required' }),
  newPassword: z
    .string({ required_error: 'New password is required' })
    .min(6, 'Password must be at least 6 characters')
    .max(20, "Passwords can't exceed 20 characters")
});

export const forgotPasswordSchema = z.object({ email: z.string().email() });
export const resetPasswordSchema = z.object({
  email: z.string().email(),
  otp: z.string({ required_error: 'Invalid otp' }).length(6, 'Invalid otp'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(20, "Password can't exceed 20 characters")
});
