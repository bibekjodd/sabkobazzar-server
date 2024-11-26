/* eslint-disable @typescript-eslint/no-empty-object-type */
import { EnvType } from '@/config/env.config';
import { User as UserProfile } from './db/users.schema';

export {};
declare global {
  namespace NodeJS {
    interface ProcessEnv extends EnvType {}
  }
  namespace Express {
    interface User extends UserProfile {}
    interface Request {
      user: UserProfile;
    }
  }
}
