const { OAuth2Client } = require("google-auth-library");

const client = new OAuth2Client();

// Verify google ID token
const verifyGoogleIdToken = async (token) => {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
    });
    const payload = ticket.getPayload();

    console.log("Payload: ", payload);

    const userId = payload["sub"];
    return userId;
  } catch (error) {
    throw error;
  }
};

// Helper function to extract token from Authorization header
const extractTokenFromHeader = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }
  const token = authHeader.split(" ")[1];
  console.log("Extracted token: ", token);
  return token;
};

module.exports = { verifyGoogleIdToken, extractTokenFromHeader };
