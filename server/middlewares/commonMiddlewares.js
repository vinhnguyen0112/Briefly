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

module.exports = { extractClientIp, extractVisitorId };
