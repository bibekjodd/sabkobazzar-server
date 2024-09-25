import { env } from '@/config/env.config';
import Pusher from 'pusher';

export const pusher = new Pusher({
  appId: '1870591',
  key: env.PUSHER_KEY,
  secret: env.PUSHER_SECRET,
  cluster: 'ap2',
  useTLS: true
});
