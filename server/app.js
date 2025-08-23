const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const fs = require("fs");
const yaml = require("js-yaml");
const swaggerUi = require("swagger-ui-express");
<<<<<<< Updated upstream
const { register, httpRequestsTotal, httpRequestDurationSeconds } = require("./utils/metrics");
=======
const { metricsMiddleware } = require("./middlewares/metricsMiddleware");
>>>>>>> Stashed changes

const authRoutes = require("./routes/authRoutes");
const anonRoutes = require("./routes/anonRoutes");
const chatRoutes = require("./routes/chatRoutes");
const noteRoutes = require("./routes/noteRoutes");
const testRoutes = require("./routes/testRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const queryRoutes = require("./routes/queryRoutes");
const pageRoutes = require("./routes/pageRoutes");
const pageSummaryRoutes = require("./routes/pageSummaryRoutes");
const healthCheckRoutes = require("./routes/healthCheckRoutes");
const metricsRoutes = require("./routes/metricsRoutes");
const {
  extractClientIp,
  extractVisitorId,
} = require("./middlewares/commonMiddlewares");
const { globalErrorHandler } = require("./middlewares/errorMiddleware");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));
app.set("trust proxy", true);

<<<<<<< Updated upstream
// HTTP metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  const route = req.route?.path || req.path || "unknown";
  
  res.on("finish", () => {
    const duration = (Date.now() - start) / 1000;
    const status = res.statusCode.toString();
    
    httpRequestsTotal.inc({
      method: req.method,
      route,
      status,
    });
    
    httpRequestDurationSeconds.observe(
      {
        method: req.method,
        route,
      },
      duration
    );
  });
  
  next();
});
=======
app.use(metricsMiddleware);
>>>>>>> Stashed changes

// swagger, only available in development environment
if (
  process.env.NODE_ENV === "development" ||
  process.env.NODE_ENV === "development_local"
) {
  const swaggerDocument = yaml.load(fs.readFileSync("./openapi.yaml", "utf8"));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

// routes
app.use("/api", extractClientIp, extractVisitorId);
app.use("/api/test", testRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/anon", anonRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/query", queryRoutes);
app.use("/api/pages", pageRoutes);
app.use("/api/page-summaries", pageSummaryRoutes);
app.use("/status", healthCheckRoutes);
app.use("/api/notes", noteRoutes);

app.use(metricsRoutes);

// health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "CocBot API is running" });
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
