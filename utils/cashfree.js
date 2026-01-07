const crypto = require("crypto");
require("dotenv").config();

/**
 * Environment detection
 * More robust detection to handle various env value formats
 */
const NODE_ENV = (process.env.NODE_ENV || "development").toLowerCase();
const PAYMENT_MODE = (process.env.PAYMENT_MODE || "").toUpperCase();

// Match BICCSL-Server logic: check for production-like values
const IS_PRODUCTION =
    NODE_ENV === "production" ||
    NODE_ENV === "prod" ||
    PAYMENT_MODE === "PROD" ||
    PAYMENT_MODE === "PRODUCTION";

console.log("🔍 Environment Detection:");
console.log("  - NODE_ENV raw:", process.env.NODE_ENV);
console.log("  - NODE_ENV normalized:", NODE_ENV);
console.log("  - PAYMENT_MODE raw:", process.env.PAYMENT_MODE);
console.log("  - PAYMENT_MODE normalized:", PAYMENT_MODE);
console.log("  - IS_PRODUCTION:", IS_PRODUCTION);

/**
 * Cashfree Credentials
 * Simplified: Use CASHFREE_APP_ID and CASHFREE_SECRET_KEY directly (like BICCSL-Server)
 * The correct credentials should be set in the environment based on production/sandbox
 */
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.CASHFREE_WEBHOOK_SECRET || CASHFREE_SECRET_KEY;

console.log("🔐 Credentials:");
console.log("  - APP_ID present:", !!CASHFREE_APP_ID);
console.log("  - APP_ID (first 10 chars):", CASHFREE_APP_ID?.substring(0, 10) + "...");
console.log("  - SECRET_KEY present:", !!CASHFREE_SECRET_KEY);
console.log("  - WEBHOOK_SECRET present:", !!WEBHOOK_SECRET);

/**
 * Validation
 */
if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    console.warn("⚠️ Cashfree credentials missing - Payment functionality will be disabled");
    // Don't exit - just log warning and continue
} else {
    console.log("✅ Cashfree credentials found");
}

/**
 * API Base URL
 */
const CASHFREE_BASE_URL = IS_PRODUCTION
    ? "https://api.cashfree.com"
    : "https://sandbox.cashfree.com";

const X_API_VERSION = "2022-09-01";

/**
 * Logs (safe)
 */
console.log("================================");
console.log("💳 Cashfree Configuration");
console.log("ENV:", NODE_ENV);
console.log("MODE:", IS_PRODUCTION ? "PRODUCTION" : "SANDBOX");
console.log("BASE URL:", CASHFREE_BASE_URL);
console.log("API VERSION:", X_API_VERSION);
console.log("APP ID:", CASHFREE_APP_ID);
console.log("WEBHOOK SECRET SET:", !!WEBHOOK_SECRET);
console.log("================================");

module.exports = {
    CASHFREE_APP_ID,
    CASHFREE_SECRET_KEY,
    CASHFREE_BASE_URL,
    X_API_VERSION,
    WEBHOOK_SECRET,
    IS_PRODUCTION,
    IS_SANDBOX: !IS_PRODUCTION,

    // Backward compatibility
    XClientId: CASHFREE_APP_ID,
    XClientSecret: CASHFREE_SECRET_KEY,
};
