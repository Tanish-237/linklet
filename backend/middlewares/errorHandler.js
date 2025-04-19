export const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  // If headers have already been sent, let the default Express error handler deal with it
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  
  res.status(statusCode).json({
    success: false,
    status: statusCode,
    message: message,
    errors: err.errors || []
  });
}; 