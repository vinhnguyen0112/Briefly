const { redisHelper } = require("../helpers/redisHelper");
const authHelper = require("../helpers/authHelper");
const User = require("../models/user");
const Session = require("../models/session");
const { v4: uuidv4 } = require("uuid");
const commonHelper = require("../helpers/commonHelper");
const { ERROR_CODES } = require("../errors");
const AppError = require("../models/appError");

/**
 * Ensures a user exists in the database, creating one if not found.
 * If no name is provided, generates a random name.
 * @param {String} userId The user's ID
 * @param {String} [name] The user's name.
 * @returns {Promise<void>}
 */
const handleUserPersistence = async (userId, name) => {
  const user = await User.getById(userId);
  if (!user) {
    if (!name) name = commonHelper.generateName();
    await User.create({ id: userId, name });
  }
};

/**
 * Creates a new authenticated session for a user, stores it in database and cache.
 * @param {String} userId The user's ID
 * @returns {Promise<String>} The new session ID.
 */
const handleSessionCreation = async (userId) => {
  const authSessionId = uuidv4();
  await Session.create({
    id: authSessionId,
    user_id: userId,
  });
  await redisHelper.createSession(authSessionId, { user_id: userId });
  return authSessionId;
};

/**
 * Express handler for authenticating a user with Google.
 * Verifies the Google ID token, persists the user, creates a session, and returns the session ID.
 * @param {Object} req Express request object.
 * @param {Object} res Express response object.
 * @param {Function} next Express next middleware function.
 * @returns {Promise<void>}
 */
const authenticateWithGoogle = async (req, res, next) => {
  try {
    const idToken = authHelper.extractFromAuthHeader(req);
    if (!idToken) {
      throw new AppError(ERROR_CODES.INVALID_INPUT, "Missing Google ID token");
    }
    const { userId, name } = await authHelper.verifyGoogleToken(idToken);
    if (!userId) {
      throw new AppError(ERROR_CODES.UNAUTHORIZED, "Invalid Google token", 401);
    }
    await handleUserPersistence(userId, name);
    const sessionId = await handleSessionCreation(userId);
    res.json({ success: true, data: { id: sessionId } });
  } catch (err) {
    next(err);
  }
};

/**
 * Express handler for authenticating a user with Facebook.
 * Verifies the Facebook access token, persists the user, creates a session, and returns the session ID.
 * @param {Object} req Express request object.
 * @param {Object} res Express response object.
 * @param {Function} next Express next middleware function.
 * @returns {Promise<void>}
 */
const authenticateWithFacebook = async (req, res, next) => {
  try {
    const accessToken = authHelper.extractFromAuthHeader(req);
    if (!accessToken) {
      throw new AppError(
        ERROR_CODES.INVALID_INPUT,
        "Missing Facebook access token"
      );
    }
    const { userId, name } = await authHelper.verifyFacebookToken(accessToken);
    if (!userId) {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        "Invalid Facebook token",
        401
      );
    }
    await handleUserPersistence(userId, name);
    const sessionId = await handleSessionCreation(userId);
    res.json({ success: true, data: { id: sessionId } });
  } catch (err) {
    next(err);
  }
};

/**
 * Express handler for signing a user out.
 * Deletes the session from both the database and cache.
 * @param {Object} req Express request object.
 * @param {Object} res Express response object.
 * @param {Function} next Express next middleware function.
 * @returns {Promise<void>}
 */
const signOut = async (req, res, next) => {
  try {
    const { sessionType } = req;
    const { id } = req.session || {};
    if (sessionType !== "auth" || !id) {
      throw new AppError(
        ERROR_CODES.UNAUTHORIZED,
        "Unknown or invalid session type.",
        401
      );
    }
    await Session.delete(id);
    await redisHelper.deleteSession(id);
    res.json({
      success: true,
      message: "Session deleted",
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  authenticateWithGoogle,
  authenticateWithFacebook,
  signOut,
};
