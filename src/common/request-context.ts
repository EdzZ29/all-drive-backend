import { AsyncLocalStorage } from 'async_hooks';
import type { NextFunction, Request, Response } from 'express';

// The request being handled, available anywhere in the code that runs for it
// (services don't have to pass it around). The activity log uses it to know
// which admin did something: the auth guard puts the admin on request.user.
const storage = new AsyncLocalStorage<Request>();

export function requestContextMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  storage.run(req, next);
}

export const currentRequest = () => storage.getStore();
