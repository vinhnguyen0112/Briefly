const dotenv = require("dotenv");

let envPath = ".env";

switch (process.env.NODE_ENV) {
  case "test":
    envPath = ".env.test";
    break;
  case "development_local":
    envPath = ".env.local";
    break;
}

dotenv.config({ path: envPath });

const app = require("./app");
const { redisHelper } = require("./helpers/redisHelper");
const dbHelper = require("./helpers/dbHelper");
const { getClient: getChromaClient } = require("./clients/chromaClient");
const { getClient: getQdrantClient } = require("./clients/qdrantClient");
const { initializeCollection } = require("./services/responseCachingService");

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await redisHelper.client.connect();
    console.log("Redis connected successfully!");

    await dbHelper.getConnection();
    console.log("MariaDB connected successfully!");

    initializeCollection();

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
