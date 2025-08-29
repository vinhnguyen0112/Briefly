const cleanDeep = require("clean-deep");
const { Schema } = require("yup");
const AppError = require("../models/appError");
const { ERROR_CODES } = require("../errors");

/**
 * Returns a middleware that first validate the request body
 * by stripping off unknown keys and remove null or undefined values
 * @param {Schema} schema 'yup' schema
 */
function validateAndSanitizeBody(schema) {
  return async (req, res, next) => {
    try {
      req.body = await schema.validate(req.body, { stripUnknown: true });
      req.body = cleanDeep(req.body);
      next();
    } catch (err) {
      next(new AppError(ERROR_CODES.INVALID_INPUT, err.message));
    }
  };
}

module.exports = { validateAndSanitizeBody };
