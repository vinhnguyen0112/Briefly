// app.js
require("dotenv").config({
  path: process.env.NODE_ENV === "test" ? ".env.test" : ".env",
});

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const authRoutes = require("./routes/authRoutes");
const captionRoutes = require("./routes/captionRoutes");
const anonRoutes = require("./routes/anonRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}
app.set("trust proxy", true);

app.use("/api/auth", authRoutes);
app.use("/api/captionize", captionRoutes);
app.use("/api/anon", anonRoutes);
app.use("/api/feedback", feedbackRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "CocBot API is running" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === "production" ? "Server error" : err.message,
  });
});

module.exports = app;
