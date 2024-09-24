import { EnvType } from '@/config/env.config';
import Pusher from 'pusher';
import { User as TUser } from './schemas/users.schema';

export {};
declare global {
  namespace NodeJS {
    interface ProcessEnv extends EnvType {
      //
    }
  }
  namespace Express {
    interface User extends TUser {}
    interface Request {
      user: TUser;
    }
  }

  var __PUSHER__: Pusher | undefined;
}
