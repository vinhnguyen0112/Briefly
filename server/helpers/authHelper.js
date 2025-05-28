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

module.exports = { verifyGoogleIdToken };
