const { OAuth2Client, auth } = require("google-auth-library");

const client = new OAuth2Client();

// Verify google ID token
const verifyGoogleToken = async (token) => {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
    });
    const payload = ticket.getPayload();

    console.log("Payload: ", payload);

    return { userId: payload["sub"], name: payload["name"] || "" };
  } catch (error) {
    throw error;
  }
};

const verifyFacebookToken = async (token) => {
  const url = new URL(process.env.FACEBOOK_TOKEN_DEBUG_URL);
  url.searchParams.append("input_token", token);
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
  return {
    userId: data.data.user_id,
    name: data.data.name || "",
  };
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

module.exports = {
  verifyGoogleToken,
  verifyFacebookToken,
  extractTokenFromHeader,
};
