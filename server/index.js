// Load environment variables
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const imageCaptionRoutes = require("./routes/imageCaptionRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const dbHelper = require("./helpers/dbHelper");

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" })); // Larger limit for content processing
app.use(morgan("dev")); // HTTP request logging

// Connect to MariaDB
dbHelper.getConnection().then(() => {
  console.log("MariaDB connected successfully!");
});

// Routes
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
