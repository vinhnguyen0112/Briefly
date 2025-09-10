const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const fs = require("fs");
const yaml = require("js-yaml");
const swaggerUi = require("swagger-ui-express");
const { rateLimit } = require("express-rate-limit");
const { metricsMiddleware } = require("./middlewares/metricsMiddleware");
const authRoutes = require("./routes/authRoutes");
const anonRoutes = require("./routes/anonRoutes");
const chatRoutes = require("./routes/chatRoutes");
const noteRoutes = require("./routes/noteRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const queryRoutes = require("./routes/queryRoutes");
const pageRoutes = require("./routes/pageRoutes");
const healthCheckRoutes = require("./routes/healthCheckRoutes");
const metricsRoutes = require("./routes/metricsRoutes");
const { globalErrorHandler } = require("./middlewares/errorMiddleware");

const app = express();
const extensionId = "fnbbiklifmlapflfjcmbjlpklgfafllh";

// cors
let allowedOrigins = [];

if (process.env.NODE_ENV === "test") {
} else if (
  ["production", "development", "development_local"].includes(
    process.env.NODE_ENV
  )
) {
  allowedOrigins.push(`chrome-extension://${extensionId}`);
}

const corsOptionsDelegate = (req, callback) => {
  // Always allow
  if (
    req.path === "/api/health" ||
    req.path === "/status" ||
    req.path === "/metrics" ||
    req.path.startsWith("/api-docs")
  ) {
    return callback(null, { origin: true, credentials: true });
  }

  // Allow all in test env
  if (process.env.NODE_ENV === "test") {
    return callback(null, { origin: true, credentials: true });
  }

  const origin = req.header("Origin");

  // Requests without Origin (e.g. background script, curl, health checks)
  if (!origin) {
    // Check header for extension ID
    const extId = req.header("x-extension-id");
    if (extId === extensionId) {
      return callback(null, { origin: true, credentials: true });
    }

    return callback(new Error("Not allowed by CORS"), { origin: false });
  }

  // Allowed origins
  if (allowedOrigins.includes(origin)) {
    return callback(null, { origin: true, credentials: true });
  }

  return callback(new Error("Not allowed by CORS"), { origin: false });
};

app.use(cors(corsOptionsDelegate));

app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));
app.set("trust proxy", 1);

app.use(metricsMiddleware);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    req.path === "/api/health" ||
    req.path === "/metrics" ||
    req.path === "/status" ||
    req.path === "/api-docs",
});

// enable rate limiting except for test environment
if (process.env.NODE_ENV !== "test") {
  app.use("/api", limiter);
}

// routes
// swagger, only available in development environment
if (
  process.env.NODE_ENV === "development" ||
  process.env.NODE_ENV === "development_local"
) {
  const swaggerDocument = yaml.load(fs.readFileSync("./openapi.yaml", "utf8"));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}
app.use("/api/auth", authRoutes);
app.use("/api/anon", anonRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/query", queryRoutes);
app.use("/api/pages", pageRoutes);
app.use("/status", healthCheckRoutes);
app.use("/api/notes", noteRoutes);

app.use(metricsRoutes);

// health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "CocBot API is running" });
});

// rate limit test
app.get("/api/rate-limit", (req, res) => {
  res.json({ status: "ok", message: "Rate limit test endpoint" });
});

// prometheus metrics endpoint
app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end("metrics_error");
  }
});

// Global error handler
app.use(globalErrorHandler);

module.exports = app;
