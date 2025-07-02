// Load environment variables
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const authRoutes = require("./routes/authRoutes");
const captionRoutes = require("./routes/captionRoutes");
const anonRoutes = require("./routes/anonRoutes");
const { redisCluster } = require("./helpers/redisHelper");
const feedbackRoutes = require("./routes/feedbackRoutes");
const dbHelper = require("./helpers/dbHelper");

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" })); // Larger limit for content processing
app.use(morgan("dev")); // HTTP request logging

// Trust proxy (testing purpose for now)
app.set("trust proxy", true);

// Connect to redis cluster
redisCluster
  .connect()
  .then(() => console.log("Redis connected successfully!"))
  .catch((err) => {
    console.error("Failed to connect to Redis:", err);
    process.exit(1);
  });

// Connect to MariaDB
dbHelper.getConnection().then(() => {
  console.log("MariaDB connected successfully!");
});

// Routes
app.use("/api/auth", authRoutes);
// app.use("/api/captionize", captionRoutes);
app.use("/api/anon", anonRoutes);
// app.use("/api/captionize", imageCaptionRoutes);
app.use("/api/feedback", feedbackRoutes);

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
