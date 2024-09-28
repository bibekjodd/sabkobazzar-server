import { z } from 'zod';

export const sendMessageSchema = z
  .object({
    text: z.string().max(200, 'Too long message').trim().optional(),
    emoji: z.string().emoji('Invalid emoji sent').optional()
  })
  .refine((data) => Object.keys(data).length !== 0, 'Provide emoji or text to send message');
export type SendMessageSchema = z.infer<typeof sendMessageSchema>;
