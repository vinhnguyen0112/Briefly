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
const testRoutes = require("./routes/testRoutes");
const { redisCluster } = require("./helpers/redisHelper");
const dbHelper = require("./helpers/dbHelper");
const {
  extractClientIp,
  extractVisitorId,
} = require("./middlewares/commonMiddlewares");
const { ERROR_CODES } = require("./errors");
const AppError = require("./models/appError");
const commonHelper = require("./helpers/commonHelper");

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" })); // Larger limit for content processing
app.use(morgan("dev")); // HTTP request logging

// Trust proxy (for testing with Postman)
app.set("trust proxy", true);

// Routes
// Extract client IP and visitor ID for all routes
app.use("/api", extractClientIp, extractVisitorId);
app.use("/api/test", testRoutes);
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
  console.error(err); // For logging purpose
  if (err instanceof AppError) {
    return res.status(err.status).json({
      success: false,
      error: {
        code: err.code || 400,
        message: err.message,
      },
    });
  }

  return res.status(500).json({
    success: false,
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message:
        process.env.NODE_ENV === "production" ? "Server error" : err.message,
    },
  });
});

async function startServer() {
  try {
    await redisCluster.connect();
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

// Start the server
app.listen(PORT, () => {
  console.log(`CocBot server running on port ${PORT}`);
});

module.exports = app;
