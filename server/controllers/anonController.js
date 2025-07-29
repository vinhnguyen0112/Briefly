const { redisHelper } = require("../helpers/redisHelper");
const AnonSession = require("../models/anonSession");
const commonHelper = require("../helpers/commonHelper");
const AppError = require("../models/appError");
const { ERROR_CODES } = require("../errors");

/**
 * Retrieves an anonymous session from cache or database, or creates a new one if not found.
 * @param {String} sessionId - The unique session identifier.
 * @returns {Promise<Object>} The session data object.
 */
async function findOrCreateAnonSession(sessionId) {
  // Try to get session from cache
  const cached = await redisHelper.getSession(sessionId, "anon");
  if (cached) {
    console.log(`Cache hit for sessionId: ${sessionId}`);
    return { id: sessionId, anon_query_count: cached.anon_query_count || 0 };
  }

  // Try to get session from DB
  console.log(`Cache miss. Checking DB for sessionId: ${sessionId}`);
  let session = await AnonSession.getById(sessionId);

  // If not found in DB, create new session
  if (!session) {
    console.log(
      `No session in DB. Creating new session for sessionId: ${sessionId}`
    );
    await AnonSession.create({ id: sessionId, anon_query_count: 0 });
    session = { anon_query_count: 0 };
  }

  const sessionData = {
    anon_query_count: session.anon_query_count,
  };

  // Always update cache
  await redisHelper.createSession(
    {
      id: sessionId,
      ...sessionData,
    },
    "anon"
  );

  return { id: sessionId, ...sessionData };
}

/**
 * Express handler for managing anonymous sessions.
 * Validates request, generates session ID, and returns session data.
 * @param {Object} req -
 * @param {Object} res -
 * @param {Function} next -
 * @returns {void}
 */
const handleAnonSession = async (req, res, next) => {
  try {
    const { visitorId, clientIp } = req;

    if (!visitorId) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Visitor Id not found");
    }

    if (!clientIp) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Client IP not found");
    }

    const sessionId = commonHelper.generateHash(visitorId, clientIp);
    const data = await findOrCreateAnonSession(sessionId);

    return res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

module.exports = { handleAnonSession };
