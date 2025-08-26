const mysql = require("mysql2/promise");
const metricsService = require("../services/metricsService");
const { dbQueryDurationSeconds, dbQueriesTotal } = require("../utils/metrics");
const path = require("path");
const fs = require("fs");

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
  const startTime = Date.now();
  const operation = extractOperation(query);
  const table = extractTable(query);

  try {
    connection = await getConnection();

    metricsService.setActiveDbConnections(pool.pool._allConnections.length);

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

    const duration = (Date.now() - startTime) / 1000;
    metricsService.recordDbQuery(operation, table, "success", duration);

    return rowsOrOkPacket;
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    metricsService.recordDbQuery(operation, table, "error", duration);

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
 * Extract operation type from SQL query
 * @param {string} query - The SQL query
 * @returns {string} The operation type
 */
function extractOperation(query) {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.startsWith("select")) return "SELECT";
  if (trimmed.startsWith("insert")) return "INSERT";
  if (trimmed.startsWith("update")) return "UPDATE";
  if (trimmed.startsWith("delete")) return "DELETE";
  if (trimmed.startsWith("create")) return "CREATE";
  if (trimmed.startsWith("drop")) return "DROP";
  if (trimmed.startsWith("alter")) return "ALTER";
  return "OTHER";
}

/**
 * Extract table name from SQL query
 * @param {string} query - The SQL query
 * @returns {string} The table name
 */
function extractTable(query) {
  const trimmed = query.trim().toLowerCase();

  const patterns = [
    /(?:from|into|update|join)\s+`?(\w+)`?/i,
    /(?:table)\s+`?(\w+)`?/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return "unknown";
}

/**
 * Load SQLs from the input file
 * @param {String} filename
 * @returns {String}
 */
function loadSql(filename) {
  const filePath = path.join(process.cwd(), "sql", filename);
  return fs.readFileSync(filePath, "utf-8");
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
  loadSql,
  getConnection,
  executeQuery,
  closePool,
};

module.exports = dbHelper;
