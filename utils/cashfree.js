const crypto = require("crypto");
require("dotenv").config();

// Determine payment mode from environment
const PAYMENT_MODE = process.env.PAYMENT_MODE || 'SANDBOX';
const isSandbox = PAYMENT_MODE.toUpperCase() === 'SANDBOX';

// Select appropriate credentials based on payment mode
const CASHFREE_APP_ID = isSandbox
    ? process.env.CASHFREE_SANDBOX_APP_ID
    : process.env.CASHFREE_PRODUCTION_APP_ID;

const CASHFREE_SECRET_KEY = isSandbox
    ? process.env.CASHFREE_SANDBOX_SECRET_KEY
    : process.env.CASHFREE_PRODUCTION_SECRET_KEY;

const WEBHOOK_SECRET = isSandbox
    ? process.env.CASHFREE_SANDBOX_WEBHOOK_SECRET
    : process.env.CASHFREE_PRODUCTION_WEBHOOK_SECRET;

// Validation
if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    console.error(`❌ ERROR: Missing Cashfree credentials for ${PAYMENT_MODE} mode!`);
    console.error(`Please check your .env file and ensure ${isSandbox ? 'CASHFREE_SANDBOX_APP_ID and CASHFREE_SANDBOX_SECRET_KEY' :
        'CASHFREE_PRODUCTION_APP_ID and CASHFREE_PRODUCTION_SECRET_KEY'
        } are set.`);
    process.exit(1);
}

// Cashfree API Base URLs
const CASHFREE_BASE_URL = isSandbox
    ? "https://sandbox.cashfree.com"
    : "https://api.cashfree.com";

const X_API_VERSION = "2023-08-01";

// Log payment mode and credential info for debugging
console.log("=== Cashfree Configuration ===");
console.log(`PAYMENT_MODE: ${PAYMENT_MODE}`);
console.log(`Environment: ${isSandbox ? 'SANDBOX (Test)' : 'PRODUCTION (Live)'}`);
console.log(`Base URL: ${CASHFREE_BASE_URL}`);
console.log(`App ID: ${CASHFREE_APP_ID}`);
console.log(`Secret Key Length: ${CASHFREE_SECRET_KEY?.length || 0} chars`);
console.log(`Webhook Secret Configured: ${!!WEBHOOK_SECRET}`);
console.log("==============================");

// Export configuration constants
module.exports = {
    CASHFREE_APP_ID,
    CASHFREE_SECRET_KEY,
    CASHFREE_BASE_URL,
    X_API_VERSION,
    WEBHOOK_SECRET,
    IS_SANDBOX: isSandbox,
    PAYMENT_MODE,

    // For backward compatibility with existing code
    XClientId: CASHFREE_APP_ID,
    XClientSecret: CASHFREE_SECRET_KEY
};
