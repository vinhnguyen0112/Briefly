const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const fs = require("fs");
const yaml = require("js-yaml");
const swaggerUi = require("swagger-ui-express");

const authRoutes = require("./routes/authRoutes");
const anonRoutes = require("./routes/anonRoutes");
const chatRoutes = require("./routes/chatRoutes");
const testRoutes = require("./routes/testRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");
const queryRoutes = require("./routes/queryRoutes");
const pageRoutes = require("./routes/pageRoutes");
const healthCheckRoutes = require("./routes/healthCheckRoutes");
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

// swagger
const swaggerDocument = yaml.load(fs.readFileSync("./openapi.yaml", "utf8"));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// routes
app.use("/api", extractClientIp, extractVisitorId);
app.use("/api/test", testRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/anon", anonRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/query", queryRoutes);
app.use("/api/pages", pageRoutes);
app.use("/status", healthCheckRoutes);

// health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "CocBot API is running" });
});

// Global error handler
app.use(globalErrorHandler);

module.exports = app;
