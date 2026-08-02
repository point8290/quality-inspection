import { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Express 4 doesn't catch rejected promises — an async handler that throws would leave the
 * request hanging. Wrapping forwards the rejection to the error middleware instead.
 */
export function asyncRoute(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
