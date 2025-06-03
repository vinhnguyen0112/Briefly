const { redisHelper } = require("../helpers/redisHelper");
const AnonSession = require("../models/anonSession");
const { generateHash } = require("../helpers/commonHelper");

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
    console.log("Cached anon session found, returning.");
    return { id: sessionId, anon_query_count: cached.anon_query_count || 0 };
  }

  // No cached anon session, check DB
  console.log("No cached anon session found, checking DB.");
  let session = await AnonSession.getById(sessionId);
  if (!session) {
    console.log("No persisted anon session in DB, creating new.");
    // No persited anon session, create new
    await AnonSession.create({ id: sessionId, anon_query_count: 0 });
  }

  const sessionData = {
    anon_query_count: session ? session.anon_query_count : 0,
  };

  // Update cache (always happen whether found or not)
  await redisHelper.createAnonSession(sessionId, sessionData);

  return { id: sessionId, ...sessionData };
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
    const sessionId = generateHash(visitorId, clientIP);

    const data = await findOrCreateAnonSession(sessionId);
    return res.json({ success: true, data });
  } catch (err) {
    console.error("Error in handleAnonSession:", err);
    next(err);
  }
};

module.exports = { handleAnonSession };
