// These are all template code

const mariadb = require("mariadb");

// Create a connection pool
const pool = mariadb.createPool({
  host: "your-database-host", // Replace with your database host
  user: "your-username", // Replace with your database username
  password: "your-password", // Replace with your database password
  database: "your-database-name", // Replace with your database name
  connectionLimit: 5, // Adjust based on your needs
});

/**
 * Get a connection from the pool
 * @returns {Promise} A promise that resolves to a MariaDB connection
 */
async function getConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("MariaDB connection established");
    return connection;
  } catch (error) {
    console.error("Error connecting to MariaDB:", error.message);
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
    const result = await connection.query(query, params);
    return result;
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
    console.log("MariaDB connection pool closed");
  } catch (error) {
    console.error("Error closing MariaDB connection pool:", error.message);
  }
}

module.exports = {
  getConnection,
  executeQuery,
  closePool,
};
