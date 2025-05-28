// Load environment variables
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const authRoutes = require("./routes/authRoutes");
const { redisClient } = require("./helpers/redisHelper");
const imageCaptionRoutes = require("./routes/imageCaptionRoutes");

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" })); // Larger limit for content processing
app.use(morgan("dev")); // HTTP request logging

// Routes
app.use("/api/captionize", imageCaptionRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "CocBot API is running" });
});

// Mount route image-caption
app.use("/api/image-caption", imageCaptionRoutes);

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
