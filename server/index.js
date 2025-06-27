const dotenv = require("dotenv");

switch (process.env.NODE_ENV) {
  case "test":
    dotenv.config({ path: ".env.test" });
    console.log("Using test env");
    break;
  case "development":
    dotenv.config({ path: ".env" });
    console.log("Using dev env");
    break;
  case "production":
    dotenv.config({ path: ".env.production" });
    console.log("Using prod env");
    break;
}

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const authRoutes = require("./routes/authRoutes");
const captionRoutes = require("./routes/captionRoutes");
const anonRoutes = require("./routes/anonRoutes");
const chatRoutes = require("./routes/chatRoutes");
const { redisCluster } = require("./helpers/redisHelper");
const dbHelper = require("./helpers/dbHelper");
const {
  extractClientIp,
  extractVisitorId,
} = require("./middlewares/commonMiddlewares");
const { bulkInsertChats } = require("./controllers/testController");

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" })); // Larger limit for content processing
app.use(morgan("dev")); // HTTP request logging

// Trust proxy (for testing with Postman)
app.set("trust proxy", true);

// Connect to redis cluster
redisCluster
  .connect()
  .then(() => console.log("Redis connected successfully!"))
  .catch((err) => {
    console.error("Failed to connect to Redis:", err);
    process.exit(1);
  });

dbHelper.getConnection().then(() => {
  console.log("MariaDB connected successfully!");
});

app.post("/api/test", bulkInsertChats);

// Routes
// Extract client IP and visitor ID for all routes
app.use("/api", extractClientIp, extractVisitorId);
app.use("/api/auth", authRoutes);
app.use("/api/captionize", captionRoutes);
app.use("/api/anon", anonRoutes);
app.use("/api/chats", chatRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "CocBot API is running" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === "production" ? "Server error" : err.message,
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`CocBot server running on port ${PORT}`);
});

module.exports = app;
