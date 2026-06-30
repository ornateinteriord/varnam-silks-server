const Razorpay = require('razorpay');
require("dotenv").config();

/**
 * Environment detection
 */
const NODE_ENV = (process.env.NODE_ENV || "development").toLowerCase();
const PAYMENT_MODE = (process.env.PAYMENT_MODE || "").toUpperCase();

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
 * Razorpay Credentials
 */
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || RAZORPAY_KEY_SECRET;

console.log("🔐 Credentials:");
console.log("  - KEY_ID present:", !!RAZORPAY_KEY_ID);
console.log("  - KEY_ID (first 10 chars):", RAZORPAY_KEY_ID?.substring(0, 10) + "...");
console.log("  - KEY_SECRET present:", !!RAZORPAY_KEY_SECRET);
console.log("  - WEBHOOK_SECRET present:", !!RAZORPAY_WEBHOOK_SECRET);

let razorpayInstance = null;

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    console.warn("⚠️ Razorpay credentials missing - Payment functionality will be disabled");
} else {
    console.log("✅ Razorpay credentials found");
    razorpayInstance = new Razorpay({
        key_id: RAZORPAY_KEY_ID,
        key_secret: RAZORPAY_KEY_SECRET,
    });
}

/**
 * Logs (safe)
 */
console.log("================================");
console.log("💳 Razorpay Configuration");
console.log("ENV:", NODE_ENV);
console.log("MODE:", IS_PRODUCTION ? "PRODUCTION" : "SANDBOX");
console.log("KEY ID:", RAZORPAY_KEY_ID);
console.log("WEBHOOK SECRET SET:", !!RAZORPAY_WEBHOOK_SECRET);
console.log("================================");

module.exports = {
    RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET,
    IS_PRODUCTION,
    IS_SANDBOX: !IS_PRODUCTION,
    razorpay: razorpayInstance
};
