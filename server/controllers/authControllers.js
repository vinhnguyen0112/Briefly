const { redisHelper } = require("../helpers/redisHelper");
const authHelper = require("../helpers/authHelper");
const User = require("../models/user");
const Session = require("../models/session");
const { v4: uuidv4 } = require("uuid");

// Persist new user in db if not found
const handleUserPersistence = async (userId, name) => {
  let user = await User.getById(userId);
  if (!user) {
    console.log(`User ${userId} not found. Creating new user.`);
    await User.create({ id: userId, name });
  }
};

const handleSessionPromotionOrCreation = async (
  userId,
  promotedAnonSessionId = null
) => {
  let currentSessionId; // Returning this

  if (promotedAnonSessionId) {
    console.log("Starting promotion flow");
    // Find session in db
    const session = await Session.getById(promotedAnonSessionId);

    // If found
    if (session) {
      // Reference session to user
      await Session.update(promotedAnonSessionId, { user_id: userId });
      // Remove anon session & replace with auth session in Redis
      await redisHelper.deleteAnonSession(promotedAnonSessionId);
      await redisHelper.createSession(promotedAnonSessionId, {
        user_id: userId,
      });
      currentSessionId = promotedAnonSessionId;
    }
    // If not found, create new session
    else {
      const newSessionId = uuidv4();
      await Session.create(newSessionId, {
        user_id: userId,
      });
      currentSessionId = await redisHelper.createSession(newSessionId, {
        user_id: userId,
      });
    }
  }
  // If not promotion flow, simply create new session
  else {
    const newSessionId = uuidv4();
    await Session.create(newSessionId, {
      user_id: userId,
    });
    currentSessionId = await redisHelper.createSession(newSessionId, {
      user_id: userId,
    });
  }

  return currentSessionId;
};

// Authenticate with Google
const authenticateWithGoogle = async (req, res, next) => {
  try {
    const idToken = authHelper.extractAuthToken(req);
    const { userId, name } = await authHelper.verifyGoogleToken(idToken);
    const promotedAnonSessionId = authHelper.extractAnonSessionId(req);

    await handleUserPersistence(userId, name);
    const currentSessionId = await handleSessionPromotionOrCreation(
      userId,
      promotedAnonSessionId
    );

    return res.json({
      success: true,
      data: { id: currentSessionId },
    });
  } catch (error) {
    console.error("Error during Google authentication:", error);
    return next(error);
  }
};

// Authenticate with Facebook
const authenticateWithFacebook = async (req, res, next) => {
  try {
    const accessToken = authHelper.extractAuthToken(req);
    const { userId, name } = await authHelper.verifyFacebookToken(accessToken);
    const promotedAnonSessionId = authHelper.extractAnonSessionId(req);

    await handleUserPersistence(userId, name);
    const currentSessionId = await handleSessionPromotionOrCreation(
      userId,
      promotedAnonSessionId
    );

    return res.json({
      success: true,
      data: { id: currentSessionId },
    });
  } catch (error) {
    console.error("Error during Facebook authentication:", error);
    return next(error);
  }
};

// Sign user out by deleting their session
const signOut = async (req, res, next) => {
  try {
    const sessionId = authHelper.extractAuthToken(req); // Extract sessionID

    // Remove from db
    await Session.delete(sessionId);

    // Remove from Redis
    await redisHelper.deleteSession(sessionId);

    return res.json({
      success: true,
      message: "Session deleted",
    });
  } catch (err) {
    console.error("Error during sign out:", err);
    return next(err);
  }
};

module.exports = { authenticateWithGoogle, authenticateWithFacebook, signOut };
