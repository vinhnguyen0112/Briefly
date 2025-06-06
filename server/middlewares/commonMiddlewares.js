function extractClientIp(req, res, next) {
  let ip = req.ip || "";
  if (ip.includes(",")) ip = ip.split(",")[0].trim();
  req.clientIp = ip;
  return next();
}

function extractVisitorId(req, res, next) {
  const visitorId = req.headers["visitor"];
  req.visitorId = visitorId;
  return next();
}

module.exports = { extractClientIp, extractVisitorId };
