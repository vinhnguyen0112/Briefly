const dbHelper = require("../helpers/dbHelper");

exports.createSession = async (sessionData) => {
  const { session_id, user_id, expires_at } = sessionData;
  const query =
    "INSERT INTO session (session_id, user_id, expires_at) VALUES (?, ?, ?)";
  await dbHelper.executeQuery(query, [session_id, user_id, expires_at]);
};

exports.getSessionById = async (session_id) => {
  const query = "SELECT * FROM session WHERE session_id = ?";
  const rows = await dbHelper.executeQuery(query, [session_id]);
  return rows[0];
};

exports.updateSession = async (session_id, updates) => {
  const query = "UPDATE session SET expires_at = ? WHERE session_id = ?";
  await dbHelper.executeQuery(query, [updates.expires_at, session_id]);
};

exports.deleteSession = async (session_id) => {
  const query = "DELETE FROM session WHERE session_id = ?";
  await dbHelper.executeQuery(query, [session_id]);
};
