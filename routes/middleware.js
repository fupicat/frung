/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
module.exports = function loggerMiddleware(req, res, next) {
  // Renders a pretty log message to the console on every request.
  console.log(
    "\x1b[34m%s\x1b[0m %s \x1b[90m<< %s\x1b[0m",
    req.method,
    req.path,
    req.filePath,
  );
  return next();
};
