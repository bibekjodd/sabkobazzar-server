import { env } from '@/config/env.config';

export const devConsole = (...args: string[]) => {
  if (env.NODE_ENV !== 'production') {
    console.log(args.join(' '));
  }
};

export const sessionOptions: CookieSessionInterfaces.CookieSessionOptions = {
  name: 'session',
  keys: [env.SESSION_SECRET],
  maxAge: 365 * 24 * 60 * 60 * 1000,
  httpOnly: true,
  secure: env.NODE_ENV !== 'production' ? false : true,
  sameSite: env.NODE_ENV !== 'production' ? 'lax' : 'none'
};

export const formatDate = (value: string | Date | number) => {
  const date = new Date(value);
  const month = date.toLocaleString('default', { month: 'long' });
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return `${month} ${day}, ${hours % 12 || 12}${minutes !== 0 ? `:${minutes}` : ''}${hours > 12 ? 'pm' : 'am'}`;
};
