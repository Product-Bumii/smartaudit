import pino from 'pino';

/**
 * Structured logs WITHOUT personal data: never emails, codes, tokens or answer texts.
 * Redaction is a safety net; code must not log those values in the first place.
 */
export function createLogger(level: string, name = 'api') {
  return pino({
    name,
    level,
    redact: {
      paths: [
        'req.headers.cookie',
        'req.headers.authorization',
        '*.email',
        '*.token',
        '*.code',
        '*.accessCode',
        'email',
        'token',
      ],
      censor: '[redacted]',
    },
  });
}
