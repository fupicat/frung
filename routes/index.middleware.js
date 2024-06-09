/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
module.exports = function viewCounter(req, res, next) {
  req.plugins.store.set("views", (req.plugins.store.get("views") || 0) + 1);
  return next();
};
