const mysql = require("mysql2/promise");
const {
  dbQueriesTotal,
  dbQueryErrorsTotal,
  dbQueryDurationSeconds,
} = require("../utils/metrics");

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT,
  user: process.env.MYSQL_USERNAME,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE || "capstone",
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
});

/**
 * Get a connection from the pool
 * @returns {Promise<mysql.Connection>} A promise that resolves to a MySQL connection
 */
async function getConnection() {
  try {
    const connection = await pool.getConnection();
    return connection;
  } catch (error) {
    console.error("Error connecting to MySQL:", error.message);
    throw error;
  }
}

/**
 * Execute a query with parameters
 * @param {string} query - The SQL query to execute
 * @param {Array} params - The parameters for the query
 * @returns {Promise<Object>} The OkPacket object or rows.
 */
async function executeQuery(query, params = []) {
  let connection;
  try {
    connection = await getConnection();

    console.log(`Executing query: ${query}`);

    if (params.length > 0) {
      const MAX_LEN = 100; // max chars per param before truncating
      const safeParams = params.map((p) => {
        const str = String(p);
        return str.length > MAX_LEN
          ? str.slice(0, MAX_LEN) + `... [truncated, length=${str.length}]`
          : str;
      });
      console.log("Params:", safeParams);
    }

    const operation = inferOperationFromQuery(query);
    const endTimer = dbQueryDurationSeconds.startTimer({ operation });
    dbQueriesTotal.inc({ operation });
    const [rowsOrOkPacket] = await connection.execute(query, params);
    endTimer();
    console.log("Query result: ", rowsOrOkPacket);
    // console.log("Query result:", rowsOrOkPacket);

    return rowsOrOkPacket;
  } catch (error) {
    try {
      const operation = inferOperationFromQuery(query);
      dbQueryErrorsTotal.inc({ operation });
    } catch (_) {}
    console.error("Error executing query:", error);
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

function inferOperationFromQuery(query) {
  const q = String(query || "")
    .trim()
    .toUpperCase();
  if (q.startsWith("SELECT")) return "select";
  if (q.startsWith("INSERT")) return "insert";
  if (q.startsWith("UPDATE")) return "update";
  if (q.startsWith("DELETE")) return "delete";
  if (q.startsWith("REPLACE")) return "replace";
  if (q.startsWith("WITH")) return "select";
  return "other";
}

/**
 * Close the connection pool
 */
async function closePool() {
  try {
    await pool.end();
    console.log("MySQL connection pool closed");
  } catch (error) {
    console.error("Error closing MySQL connection pool:", error.message);
  }
}

const dbHelper = {
  getConnection,
  executeQuery,
  closePool,
};

module.exports = dbHelper;
