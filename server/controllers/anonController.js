const crypto = require("crypto");
const { redisHelper } = require("../helpers/redisHelper");

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
      return res
        .status(400)
        .json({ success: false, message: "Missing visitorId" });
    }

    // Handle client IP (No proxy handling yet)
    let clientIP = req.ip;
    if (clientIP && clientIP.includes(",")) {
      clientIP = clientIP.split(",")[0].trim();
    }

    console.log("Client IP address: ", clientIP);

    const sessionId = generateSessionId(visitorId, clientIP);

    console.log("Created anonymous session ID: ", sessionId);

    // Check if session exists in Redis
    let session = await redisHelper.getAnonSession(sessionId);

    if (session) {
      // Session exists, refresh & return it
      console.log("Anonymous session found");
      console.log(session);
      await redisHelper.refreshAnonSession();
      return res.json({
        anon_session_id: sessionId,
        anon_query_count: session.anon_query_count || 0,
      });
    } else {
      // Create new session
      console.log("Anonymous session not found, creating new one");
      const sessionData = {
        anon_query_count: 0,
        client_ip: clientIP,
        visistor_id: visitorId,
      };
      await redisHelper.setAnonSession(sessionId, sessionData);
      return res.json({
        anon_session_id: sessionId,
        ...sessionData,
      });
    }
  } catch (err) {
    next(err);
  }
};

module.exports = { handleAnonSession };
