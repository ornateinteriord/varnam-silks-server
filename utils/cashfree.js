const crypto = require("crypto");
require("dotenv").config();

// Determine environment mode (matching BICCSL-Server approach)
// In Vercel, NODE_ENV is automatically set to "production"
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production' || NODE_ENV === 'PROD';

// Select appropriate credentials based on environment
// BICCSL-Server uses single variables: CASHFREE_APP_ID, CASHFREE_SECRET_KEY
// For backward compatibility, we support both patterns
const CASHFREE_APP_ID = isProduction
    ? (process.env.CASHFREE_PRODUCTION_APP_ID || process.env.CASHFREE_APP_ID)
    : (process.env.CASHFREE_SANDBOX_APP_ID || process.env.CASHFREE_APP_ID);

const CASHFREE_SECRET_KEY = isProduction
    ? (process.env.CASHFREE_PRODUCTION_SECRET_KEY || process.env.CASHFREE_SECRET_KEY)
    : (process.env.CASHFREE_SANDBOX_SECRET_KEY || process.env.CASHFREE_SECRET_KEY);

const WEBHOOK_SECRET = isProduction
    ? (process.env.CASHFREE_PRODUCTION_WEBHOOK_SECRET || process.env.CASHFREE_WEBHOOK_SECRET)
    : (process.env.CASHFREE_SANDBOX_WEBHOOK_SECRET || process.env.CASHFREE_WEBHOOK_SECRET);

// Validation
if (!CASHFREE_APP_ID || !CASHFREE_SECRET_KEY) {
    console.error(`❌ ERROR: Missing Cashfree credentials for ${NODE_ENV} environment!`);
    console.error(`Please check your .env file and ensure ${!isProduction ? 'CASHFREE_SANDBOX_APP_ID and CASHFREE_SANDBOX_SECRET_KEY' :
        'CASHFREE_PRODUCTION_APP_ID and CASHFREE_PRODUCTION_SECRET_KEY (or CASHFREE_APP_ID and CASHFREE_SECRET_KEY)'
        } are set.`);
    process.exit(1);
}

// Cashfree API Base URLs
const CASHFREE_BASE_URL = isProduction
    ? "https://api.cashfree.com"
    : "https://sandbox.cashfree.com";

const X_API_VERSION = "2023-08-01";

// Log environment and credential info for debugging
console.log("=== Cashfree Configuration ===");
console.log(`NODE_ENV: ${NODE_ENV}`);
console.log(`Environment: ${isProduction ? 'PRODUCTION (Live)' : 'SANDBOX (Test)'}`);
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
    IS_PRODUCTION: isProduction,
    IS_SANDBOX: !isProduction,  // For backward compatibility
    NODE_ENV,

    // For backward compatibility with existing code
    XClientId: CASHFREE_APP_ID,
    XClientSecret: CASHFREE_SECRET_KEY
};
