require("dotenv").config();

const app = require("./app");
const { redisHelper } = require("./helpers/redisHelper");
const dbHelper = require("./helpers/dbHelper");

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await redisHelper.client.connect();
    console.log("Redis connected successfully!");

    await dbHelper.getConnection();
    console.log("MariaDB connected successfully!");

    app.listen(PORT, () => {
      console.log(`CocBot server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Startup error", err);
    process.exit(1);
  }
}

startServer();

module.exports = { startServer };
