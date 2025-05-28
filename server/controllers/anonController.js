const crypto = require("crypto");
const { redisHelper } = require("../helpers/redisHelper");
const Session = require("../models/session");

// Helper to hash fingerprint and IP into a session ID
function generateSessionId(fingerprint, ip) {
  return crypto
    .createHash("sha256")
    .update(`${fingerprint}:${ip}`)
    .digest("hex");
}

const handleAnonSession = async (req, res, next) => {
  try {
    const { visitorId } = req.body;
    console.log("Received visitorId: ", visitorId);

    if (!visitorId) {
      return res.status(400).json({
        success: false,
        message: "Missing visitorId",
      });
    }

    // Determine client IP (basic parsing)
    let clientIP = req.ip;
    if (clientIP && clientIP.includes(",")) {
      clientIP = clientIP.split(",")[0].trim();
    }

    console.log("Client IP address: ", clientIP);

    // Generate session ID
    const sessionId = generateSessionId(visitorId, clientIP);
    console.log("Generated anon session ID:", sessionId);

    // Check in Redis cache
    const redisKey = `anon:${sessionId}`;
    let cachedSession = await redisHelper.getAnonSession(sessionId);
    if (cachedSession) {
      console.log("Anon session found in cache, returning.");
      await redisHelper.refreshAnonSession(sessionId);
      return res.json({
        success: true,
        data: {
          id: sessionId,
          anon_query_count: cachedSession.anon_query_count || 0,
        },
      });
    }

    // Check in db
    const session = await Session.getById(sessionId);
    if (session && !session.user_id) {
      console.log("Anon session found in DB, caching and returning.");

      // Update Redis cache
      await redisHelper.createAnonSession(sessionId, {
        anon_query_count: session.anon_query_count || 0,
      });

      return res.json({
        success: true,
        data: {
          id: redisKey,
          anon_query_count: session.anon_query_count || 0,
        },
      });
    }

    // Session not found -> Create new
    console.log("Anon session not found anywhere, creating new.");
    const sessionData = {
      id: sessionId,
      anon_query_count: 0,
    };
    await Session.create(sessionData);

    // Cache in Redis
    await redisHelper.createAnonSession(sessionId, {
      anon_query_count: 0,
    });

    return res.json({
      success: true,
      data: {
        id: sessionId,
        anon_query_count: 0,
      },
    });
  } catch (err) {
    console.error("Error in handleAnonSession:", err);
    return next(err);
  }
};

module.exports = { handleAnonSession };
