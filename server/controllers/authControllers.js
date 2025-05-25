const {
  verifyGoogleIdToken,
  extractTokenFromHeader,
} = require("../helpers/authHelper");
const { redisHelper } = require("../helpers/redisHelper");
const User = require("../models/user");
const Session = require("../models/session");
const { v4: uuidv4 } = require("uuid");

const FACEBOOK_TOKEN_DEBUG_URL = "https://graph.facebook.com/debug_token";

// Authenticate ID token to create user session
const authenticateWithGoogle = async (req, res, next) => {
  try {
    const idToken = extractTokenFromHeader(req); // Extract token from header

    // Verify ID token and extract user info
    const userId = await verifyGoogleIdToken(idToken);

    // Persist user in MySQL
    const userData = {
      id: userId,
      name: "Nguyen The Vinh",
    };
    let user = await User.getById(userId);
    if (!user) {
      await User.create(userData);
    } else {
      await User.update(userId, userData);
    }

    // Create session in MySQL
    const sessionId = uuidv4();
    await Session.create(sessionId, userId);

    // Cache session in Redis
    await redisHelper.createSession(sessionId, userId);

    return res.json({
      success: true,
      data: {
        id: sessionId,
      },
    });
  } catch (error) {
    console.error("Error during Google authentication:", error);
    return next(error);
  }
};

// Authenticate access token to create user session
const authenticateWithFacebook = async (req, res, next) => {
  try {
    const accessToken = extractTokenFromHeader(req); // Extract token from header

    // Verify access token
    const url = new URL(FACEBOOK_TOKEN_DEBUG_URL);
    url.searchParams.append("input_token", accessToken);
    url.searchParams.append(
      "access_token",
      `${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_APP_SECRET}`
    );

    const response = await fetch(url.href);
    if (!response.ok) {
      throw new Error("Failed to verify access token");
    }
    const data = await response.json();
    if (!data || data.data.error) {
      throw new Error("Invalid access token");
    }

    console.log("Response from Facebook token debug:", data);

    // Persist user in MySQL
    const userId = data.data.user_id || uuidv4();
    const userData = {
      id: userId,
      name: "",
    };
    let user = await User.getById(userId);
    if (!user) {
      await User.create(userData);
    } else {
      await User.update(userId, userData);
    }

    // Create session in MySQL
    const sessionId = uuidv4();
    await Session.create(sessionId, userId);

    // Cache session in Redis
    await redisHelper.createSession(sessionId, userId);

    return res.json({
      success: true,
      data: {
        id: sessionId,
      },
    });
  } catch (error) {
    console.error("Error during Facebook authentication:", error);
    return next(error);
  }
};

// Sign user out by deleting their session
const signOut = async (req, res, next) => {
  try {
    const sessionId = extractTokenFromHeader(req); // Extract token from header

    // Remove from MySQL
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
