const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const authRoutes = require("./routes/authRoutes");
const captionRoutes = require("./routes/captionRoutes");
const anonRoutes = require("./routes/anonRoutes");
const chatRoutes = require("./routes/chatRoutes");
const testRoutes = require("./routes/testRoutes");
const { ERROR_CODES } = require("./errors");
const AppError = require("./models/appError");
const {
  extractClientIp,
  extractVisitorId,
} = require("./middlewares/commonMiddlewares");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));
app.set("trust proxy", true);

// routes
app.use("/api", extractClientIp, extractVisitorId);
app.use("/api/test", testRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/captionize", captionRoutes);
app.use("/api/anon", anonRoutes);
app.use("/api/chats", chatRoutes);

// health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "CocBot API is running" });
});

// error handler
app.use((err, req, res, next) => {
  console.error(err);
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

module.exports = app;
