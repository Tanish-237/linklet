export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // Indicates whether the error is a predicted operational error (e.g. invalid input) or an unexpected programming error

    Error.captureStackTrace(this, this.constructor);
  }
}
