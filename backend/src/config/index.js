/**
 * Configuration module
 * Centralizes all environment variable access
 */

require("dotenv").config();

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/workshop",
  geminiApiKey: process.env.GEMINI_API_KEY,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  adminSecret: process.env.ADMIN_SECRET,
  nodeEnv: process.env.NODE_ENV || "development",
};

// Validate required configuration
const requiredEnvVars = ["GEMINI_API_KEY", "ADMIN_SECRET"];
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0 && config.nodeEnv === "production") {
  throw new Error(`Missing required environment variables: ${missingVars.join(", ")}`);
}

module.exports = config;
