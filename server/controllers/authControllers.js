const { redisHelper } = require("../helpers/redisHelper");
const authHelper = require("../helpers/authHelper");
const User = require("../models/user");
const Session = require("../models/session");
const { v4: uuidv4 } = require("uuid");
const commonHelper = require("../helpers/commonHelper");
const Chat = require("../models/chat");

// Persist new user in db if not found
const handleUserPersistence = async (userId, name) => {
  const user = await User.getById(userId);
  if (!user) {
    console.log(`User ${userId} not found. Creating new user.`);
    if (!name) name = commonHelper.generateName();
    await User.create({ id: userId, name });
  }
};

const handleSessionCreation = async (userId) => {
  const authSessionId = uuidv4();
  await Session.create({
    id: authSessionId,
    user_id: userId,
  });

  await redisHelper.createSession(authSessionId, { user_id: userId });

  console.log("Created new auth session:", authSessionId);
  return authSessionId;
};

// Authenticate with Google
const authenticateWithGoogle = async (req, res, next) => {
  try {
    console.log("Request origin in Google auth request: ", req.origin);
    const idToken = authHelper.extractFromAuthHeader(req);
    const { userId, name } = await authHelper.verifyGoogleToken(idToken);

    // Unused for now,
    const promotedAnonSessionId = authHelper.extractFromPromotionHeader(req);

    await handleUserPersistence(userId, name);
    const sessionId = await handleSessionCreation(userId);

    return res.json({ success: true, data: { id: sessionId } });
  } catch (error) {
    console.error("Error during Google authentication:", error);
    return next(error);
  }
};

// Authenticate with Facebook
const authenticateWithFacebook = async (req, res, next) => {
  try {
    const accessToken = authHelper.extractFromAuthHeader(req);
    const { userId, name } = await authHelper.verifyFacebookToken(accessToken);
    const promotedAnonSessionId = authHelper.extractFromPromotionHeader(req);

    await handleUserPersistence(userId, name);

    const sessionId = await handleSessionCreation(userId);

    return res.json({ success: true, data: { id: sessionId } });
  } catch (error) {
    console.error("Error during Facebook authentication:", error);
    return next(error);
  }
};

// Sign user out
const signOut = async (req, res, next) => {
  try {
    const { sessionType } = req;
    const { id } = req.session;

    // If auth session was not passed in request, reject
    if (sessionType !== "auth") {
      return res.status(400).json({
        success: false,
        message: "Unknown or invalid session type.",
      });
    }

    // Remove from DB and Redis
    await Session.delete(id);
    await redisHelper.deleteSession(id);

    return res.json({
      success: true,
      message: "Session deleted",
    });
  } catch (err) {
    console.error("Error during sign out:", err);
    return next(err);
  }
};

module.exports = {
  authenticateWithGoogle,
  authenticateWithFacebook,
  signOut,
};
