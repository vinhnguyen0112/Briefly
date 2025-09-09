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
let allowNoOrigin = false;

if (process.env.NODE_ENV === "test") {
  allowedOrigins.push("*");
  allowNoOrigin = true;
} else if (
  ["production", "development", "development_local"].includes(
    process.env.NODE_ENV
  )
) {
  allowedOrigins.push(`chrome-extension://${extensionId}`);
}

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// fallback for requests send from background script
app.use((req, res, next) => {
  if (allowNoOrigin) next();
  if (!req.headers.origin) {
    const extId = req.headers["x-extension-id"];
    if (extId === extensionId) {
      return next();
    } else {
      return res.status(403).json({ error: "Not allowed by CORS" });
    }
  }
  next();
});

app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));
app.set("trust proxy", 1);

app.use(metricsMiddleware);

// swagger, only available in development environment
if (
  process.env.NODE_ENV === "development" ||
  process.env.NODE_ENV === "development_local"
) {
  const swaggerDocument = yaml.load(fs.readFileSync("./openapi.yaml", "utf8"));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    req.path === "/api/health" ||
    req.path === "/metrics" ||
    req.path === "/status",
});

// enable rate limiting except for test environment
if (process.env.NODE_ENV !== "test") {
  app.use("/api", limiter);
}

// routes
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
