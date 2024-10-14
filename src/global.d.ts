import { EnvType } from '@/config/env.config';
import Pusher from 'pusher';
import { User as UserProfile } from './schemas/users.schema';

export {};
declare global {
  namespace NodeJS {
    interface ProcessEnv extends EnvType {
      //
    }
  }
  namespace Express {
    interface User extends UserProfile {}
    interface Request {
      user: UserProfile;
    }
  }

  var __PUSHER__: Pusher | undefined;
}
