const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const morgan = require("morgan");
const { createClient } = require("redis");

const authRoutes = require("./routes/authRoutes");
const { RedisStore } = require("connect-redis");
const { redisClient } = require("./services/redisService");
const session = require("express-session");
// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  session({
    store: new RedisStore({
      client: redisClient,
    }),
    secret: process.env.SESSION_STORE_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    },
  })
);

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" })); // Larger limit for content processing
app.use(morgan("dev")); // HTTP request logging

// // Auth0 config
// const config = {
//   authRequired: false,
//   auth0Logout: true,
//   secret: process.env.AUTH0_SECRET,
//   baseURL: process.env.BASE_URL || `http://localhost:${PORT}`,
//   clientID: process.env.AUTH0_CLIENT_ID,
//   issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
//   routes: {
//     login: false, // Custom login route
//     callback: "/api/auth/callback",
//   },
// };

// // Auth middleware
// app.use(auth(config));

// Import routes
// const queryRoutes = require("./routes/query");
// const userRoutes = require("./routes/user");

// Routes
app.use("/api/auth", authRoutes);
// app.use("/api/query", queryRoutes);
// app.use("/api/user", userRoutes);

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
