module.exports = [
  /**
   * Caches all files in this directory for one year.
   *
   * @param {import('express').Request} req - The Express request object.
   * @param {import('express').Response} res - The Express response object.
   * @param {import('express').NextFunction} next - The next middleware function.
   * @returns {void}
   */
  function cacheOneYear(_, res, next) {
    res.setHeader("Cache-Control", "public, max-age=31536000");
    return next();
  },
];
