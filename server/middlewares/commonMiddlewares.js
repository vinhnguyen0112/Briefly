const cleanDeep = require("clean-deep");
const { Schema } = require("yup");
const AppError = require("../models/appError");
const { ERROR_CODES } = require("../errors");

/**
 * Express middleware to extract the client's IP address.
 * Sets req.clientIp to the detected IP.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */
function extractClientIp(req, res, next) {
  let ip = req.ip || "";
  if (ip.includes(",")) ip = ip.split(",")[0].trim();
  req.clientIp = ip;
  return next();
}

/**
 * Express middleware to extract the visitor ID from the request headers.
 * Sets req.visitorId to the value of the "visitor" header.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */
function extractVisitorId(req, res, next) {
  const visitorId = req.headers["visitor"];
  req.visitorId = visitorId;
  return next();
}

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

module.exports = { extractClientIp, extractVisitorId, validateAndSanitizeBody };
