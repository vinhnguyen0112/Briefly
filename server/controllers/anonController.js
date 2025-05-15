const crypto = require("crypto");
const { getAnonSession, setAnonSession } = require("../helpers/redisHelper");

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
    if (!visitorId) {
      return res
        .status(400)
        .json({ success: false, message: "Missing visitorId" });
    }

    // Get IP address (trusts proxy if behind one)
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress;

    const sessionId = generateSessionId(visitorId, ip);

    // Check if session exists in Redis
    let session = await getAnonSession(sessionId);

    if (session) {
      // Session exists, return it
      return res.json({
        anonSessionId: sessionId,
        anon_query_count: session.anon_query_count || 0,
      });
    } else {
      // Create new session
      const newSession = { anon_query_count: 0 };
      await setAnonSession(sessionId, newSession);
      return res.json({
        anonSessionId: sessionId,
        anon_query_count: 0,
      });
    }
  } catch (err) {
    next(err);
  }
};

module.exports = { handleAnonSession };
