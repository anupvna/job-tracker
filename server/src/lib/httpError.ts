export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static notFound(message = 'Resource not found') {
    return new HttpError(404, 'NOT_FOUND', message);
  }

  static badRequest(message: string, details?: HttpError['details']) {
    return new HttpError(400, 'VALIDATION_ERROR', message, details);
  }
}
