const crypto = require("crypto");
const { redisHelper } = require("../helpers/redisHelper");
const AnonSession = require("../models/anonSession");

// Generate session ID by hashing fingerprint + IP address
function generateSessionId(fingerprint, ip) {
  return crypto
    .createHash("sha256")
    .update(`${fingerprint}:${ip}`)
    .digest("hex");
}

// Get client IP from request
function getClientIP(req) {
  let ip = req.ip || "";
  if (ip.includes(",")) ip = ip.split(",")[0].trim();
  return ip;
}

async function findOrCreateAnonSession(sessionId) {
  // Find cached anon session
  const cached = await redisHelper.getAnonSession(sessionId);
  if (cached) {
    return { id: sessionId, anon_query_count: cached.anon_query_count || 0 };
  }

  // No cached anon session, check DB
  let session = await AnonSession.getById(sessionId);
  if (!session) {
    // No persited anon session, create new
    session = await AnonSession.create({ id: sessionId, anon_query_count: 0 });
  }

  // Update cache (always happen whether found or not)
  await redisHelper.createAnonSession(sessionId, {
    anon_query_count: session.anon_query_count || 0,
  });

  return { id: sessionId, anon_query_count: session.anon_query_count || 0 };
}

const handleAnonSession = async (req, res, next) => {
  try {
    const { visitorId } = req.body;
    if (!visitorId) {
      return res
        .status(400)
        .json({ success: false, message: "Missing visitorId" });
    }

    const clientIP = getClientIP(req);
    const sessionId = generateSessionId(visitorId, clientIP);

    const data = await findOrCreateAnonSession(sessionId);
    return res.json({ success: true, data });
  } catch (err) {
    console.error("Error in handleAnonSession:", err);
    next(err);
  }
};

module.exports = { handleAnonSession };
