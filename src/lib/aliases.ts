import { users } from '@/schemas/users.schema';
import { alias } from 'drizzle-orm/sqlite-core';

export const participants = alias(users, 'participants');

export const selectParticipantSnapshot = {
  id: participants.id,
  name: participants.name,
  email: participants.email,
  role: participants.role,
  image: participants.image,
  phone: participants.phone,
  lastOnline: participants.lastOnline
};
