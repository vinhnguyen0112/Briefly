const mysql = require("mysql2/promise");

// Create a connection pool
// const pool = mysql.createPool(
//   process.env.NODE_ENV === "development"
//     ? {
//         host: process.env.MYSQL_HOST,
//         port: process.env.MYSQL_PORT,
//         user: process.env.MYSQL_USERNAME,
//         password: process.env.MYSQL_PASSWORD,
//         database: process.env.MYSQL_DB,
//         waitForConnections: true,
//         connectionLimit: 5,
//         queueLimit: 0,
//       }
//     : {
//         host: process.env.MYSQL_HOST,
//         port: process.env.MYSQL_PORT,
//         user: process.env.MYSQL_USERNAME,
//         password: process.env.MYSQL_PASSWORD,
//         database: process.env.MYSQL_DB || "test",
//         waitForConnections: true,
//         connectionLimit: 5,
//         queueLimit: 0,
//       }
// );

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT,
  user: process.env.MYSQL_USERNAME,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DB,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
});

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
 * @returns {Promise<Object>} The OkPacket object or rows.
 */
async function executeQuery(query, params = []) {
  let connection;
  try {
    connection = await getConnection();

    console.log(`Executing query: ${query}`);
    if (params.length > 0) console.log(`Params: ${[...params]}`);

    const [rowsOrOkPacket] = await connection.execute(query, params);
    console.log("Query result: ", rowsOrOkPacket);

    return rowsOrOkPacket;
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
