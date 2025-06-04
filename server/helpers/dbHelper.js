const mysql = require("mysql2/promise");

// Create a connection pool
const pool = mysql.createPool(
  process.env.LOCAL_DEV === "true"
    ? {
        host: process.env.LOCAL_MYSQL_HOST,
        port: process.env.LOCAL_MYSQL_PORT,
        user: process.env.LOCAL_MYSQL_USERNAME,
        password: process.env.LOCAL_MYSQL_PASSWORD,
        database: process.env.LOCAL_MYSQL_DB,
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
      }
    : {
        host: process.env.MYSQL_HOST,
        port: process.env.MYSQL_PORT,
        user: process.env.MYSQL_USERNAME,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DB || "test",
        waitForConnections: true,
        connectionLimit: 5,
        queueLimit: 0,
      }
);

/**
 * Get a connection from the pool
 * @returns {Promise} A promise that resolves to a MySQL connection
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
 * @returns {Promise} The result of the query
 */
async function executeQuery(query, params = []) {
  let connection;
  try {
    connection = await getConnection();

    console.log("Query params: ", params);
    console.log("Executing query: ");
    console.log(query);

    const [rows] = await connection.execute(query, params);
    return rows;
  } catch (error) {
    console.error("Error executing query:", error.message);
    throw error;
  } finally {
    if (connection) connection.release();
  }
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
