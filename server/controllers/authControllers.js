const {
  verifyGoogleIdToken,
  extractTokenFromHeader,
} = require("../helpers/authHelper");
const { createSession, deleteSession } = require("../helpers/redisHelper");

const FACEBOOK_TOKEN_DEBUG_URL = "https://graph.facebook.com/debug_token";

// Authenticate ID token to create user session
const authenticateWithGoogle = async (req, res, next) => {
  try {
    const idToken = extractTokenFromHeader(req); // Extract token from header

    // Verify ID token
    const userId = await verifyGoogleIdToken(idToken);

    // Create session on server-side
    const sessionId = await createSession({ userId });
    return res.json({
      success: true,
      sessionId,
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

    console.log(data.data);

    // Create session on server-side
    const sessionId = await createSession({ userId: data.data.user_id });
    return res.json({
      success: true,
      sessionId,
    });
  } catch (err) {
    console.error("Error during Facebook authentication:", err);
    return next(err);
  }
};

// Sign user out by deleting their session
const signOut = async (req, res, next) => {
  try {
    const sessionId = extractTokenFromHeader(req); // Extract token from header

    const success = await deleteSession(sessionId);
    return res.json({
      success,
      message: success ? "Session deleted" : "Invalid session Id",
    });
  } catch (err) {
    console.error("Error during sign out:", err);
    return next(err);
  }
};

module.exports = { authenticateWithGoogle, authenticateWithFacebook, signOut };
