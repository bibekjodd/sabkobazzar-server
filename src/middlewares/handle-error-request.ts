import { env } from '@/config/env.config';
import { HttpException } from '@/lib/exceptions';
import { LibsqlError } from '@libsql/client';
import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const handleErrorRequest: ErrorRequestHandler = (err, req, res, next) => {
  let message = err.message || 'Internal Server Error';
  let stack = undefined;
  let statusCode = err.statusCode || 500;

  if (err instanceof Error) {
    message = err.message || message;
    if (env.NODE_ENV === 'development') stack = err.stack;
  }

  if (err instanceof LibsqlError) {
    message = 'Internal server error';
    statusCode = 500;
  }

  if (err instanceof HttpException) {
    message = err.message;
    statusCode = err.statusCode;
  }

  if (err instanceof ZodError) {
    statusCode = 400;
    const issue = err.issues.at(0);
    if (issue) {
      let zodMessage = `${issue.path}: ${issue.message}`;
      if (zodMessage.startsWith(': ')) {
        zodMessage = zodMessage.slice(2);
      }
      message = zodMessage || message;
    }
  }

  return res.status(statusCode).json({ message, stack });
};
