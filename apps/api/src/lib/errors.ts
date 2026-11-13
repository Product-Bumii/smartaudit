import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import type { Logger } from 'pino';

/** Uniform API error: `{ error: { code, message, details? } }`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
    readonly details?: unknown,
  ) {
    super(message ?? code);
  }
}

export const badRequest = (code: string, details?: unknown) => new ApiError(400, code, code, details);
export const unauthorized = (code = 'UNAUTHENTICATED') => new ApiError(401, code);
export const forbidden = (code = 'FORBIDDEN') => new ApiError(403, code);
export const notFound = (code = 'NOT_FOUND') => new ApiError(404, code);
export const conflict = (code: string, details?: unknown) => new ApiError(409, code, code, details);
export const unprocessable = (code: string, details?: unknown) => new ApiError(422, code, code, details);

export const notFoundHandler: RequestHandler = (_req, _res, next) => next(notFound('ROUTE_NOT_FOUND'));

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err, req, res, _next) => {
    if (err instanceof ZodError) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'VALIDATION_ERROR',
          details: err.issues.map((i) => ({ path: i.path.join('.'), code: i.code, message: i.message })),
        },
      });
      return;
    }
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
      return;
    }
    if (err instanceof multer.MulterError) {
      res.status(400).json({ error: { code: `UPLOAD_${err.code}`, message: err.code } });
      return;
    }
    if (err?.type === 'entity.parse.failed') {
      res.status(400).json({ error: { code: 'INVALID_JSON', message: 'INVALID_JSON' } });
      return;
    }
    // Never log request bodies: they may contain personal data.
    logger.error({ err: { name: err?.name, message: err?.message, stack: err?.stack }, path: req.path }, 'unhandled error');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'INTERNAL_ERROR' } });
  };
}
