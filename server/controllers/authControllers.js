const { redisHelper } = require("../helpers/redisHelper");
const authHelper = require("../helpers/authHelper");
const User = require("../models/user");
const Session = require("../models/session");
const { v4: uuidv4 } = require("uuid");

// Persist new user in db if not found
const handleUserPersistence = async (userId, name) => {
  const user = await User.getById(userId);
  if (!user) {
    console.log(`User ${userId} not found. Creating new user.`);
    await User.create({ id: userId, name });
  }
};

const handleSessionCreation = async (userId) => {
  const authSessionId = uuidv4();
  await Session.create({
    id: authSessionId,
    user_id: userId,
  });

  // TODO: QA history re-assign for promotion flow

  await redisHelper.createSession(authSessionId, { user_id: userId });

  console.log("Created new auth session:", authSessionId);
  return authSessionId;
};

// Authenticate with Google
const authenticateWithGoogle = async (req, res, next) => {
  try {
    const idToken = authHelper.extractAuthToken(req);
    const { userId, name } = await authHelper.verifyGoogleToken(idToken);

    // TODO: Unused for now,
    const promotedAnonSessionId = authHelper.extractAnonSessionId(req);

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
    const accessToken = authHelper.extractAuthToken(req);
    const { userId, name } = await authHelper.verifyFacebookToken(accessToken);
    const promotedAnonSessionId = authHelper.extractAnonSessionId(req);

    await handleUserPersistence(userId, name);
    const sessionId = await handleSessionCreation(
      userId,
      promotedAnonSessionId
    );

    return res.json({ success: true, data: { id: sessionId } });
  } catch (error) {
    console.error("Error during Facebook authentication:", error);
    return next(error);
  }
};

// Sign user out by deleting *only* their auth session
const signOut = async (req, res, next) => {
  try {
    const sessionId = authHelper.extractAuthToken(req);
    await Session.delete(sessionId);
    await redisHelper.deleteSession(sessionId);

    return res.json({ success: true, message: "Session deleted" });
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
