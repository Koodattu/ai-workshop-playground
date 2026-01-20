/**
 * AI Workshop Backend Server
 * Main entry point for the Express application
 */

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const config = require("./config");
const routes = require("./routes");
const { errorHandler, AppError } = require("./middleware/errorHandler");

const app = express();

// ============================================
// Middleware Configuration
// ============================================

// CORS configuration
const corsOptions = {
  origin: config.frontendUrl,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "X-Admin-Secret"],
  exposedHeaders: ["X-RateLimit-Limit", "X-RateLimit-Remaining"],
  credentials: true,
};
app.use(cors(corsOptions));

// Body parsers
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Request logging (development only)
if (config.nodeEnv === "development") {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// ============================================
// Routes
// ============================================

// Mount API routes
app.use("/api", routes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    name: "AI Workshop Backend",
    version: "1.0.0",
    status: "running",
  });
});

// 404 handler for undefined routes
app.use((req, res, next) => {
  next(new AppError(`Route ${req.method} ${req.path} not found`, 404));
});

// ============================================
// Error Handling
// ============================================

// Global error handler (must be last)
app.use(errorHandler);

// ============================================
// Database Connection & Server Start
// ============================================

const startServer = async () => {
  try {
    // Connect to MongoDB
    console.log("Connecting to MongoDB...");
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("✓ MongoDB connected successfully");

    // Start Express server
    app.listen(config.port, () => {
      console.log(`✓ Server running on port ${config.port}`);
      console.log(`  Environment: ${config.nodeEnv}`);
      console.log(`  Frontend URL: ${config.frontendUrl}`);
    });
  } catch (error) {
    console.error("✗ Failed to start server:", error.message);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Promise Rejection:", err.message);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err.message);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  await mongoose.connection.close();
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;
