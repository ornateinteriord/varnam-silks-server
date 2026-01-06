const crypto = require("crypto");
require("dotenv").config();

/**
 * Environment detection
 * Vercel => production
 */
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION =
    NODE_ENV === "production" ||
    NODE_ENV === "PROD" ||
    process.env.PAYMENT_MODE === "PROD";

/**
 * Cashfree Credentials
 * (Supports single & split env pattern)
 */
const CASHFREE_APP_ID = IS_PRODUCTION
    ? process.env.CASHFREE_PRODUCTION_APP_ID || process.env.CASHFREE_APP_ID
    : process.env.CASHFREE_SANDBOX_APP_ID || process.env.CASHFREE_APP_ID;

const CASHFREE_SECRET_KEY = IS_PRODUCTION
    ? process.env.CASHFREE_PRODUCTION_SECRET_KEY || process.env.CASHFREE_SECRET_KEY
    : process.env.CASHFREE_SANDBOX_SECRET_KEY || process.env.CASHFREE_SECRET_KEY;

const WEBHOOK_SECRET = IS_PRODUCTION
    ? process.env.CASHFREE_PRODUCTION_WEBHOOK_SECRET
    : process.env.CASHFREE_SANDBOX_WEBHOOK_SECRET || process.env.CASHFREE_WEBHOOK_SECRET;

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

const X_API_VERSION = "2023-08-01";

/**
 * Logs (safe)
 */
console.log("================================");
console.log("💳 Cashfree Configuration");
console.log("ENV:", NODE_ENV);
console.log("MODE:", IS_PRODUCTION ? "PRODUCTION" : "SANDBOX");
console.log("BASE URL:", CASHFREE_BASE_URL);
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
