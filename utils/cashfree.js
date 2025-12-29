const { Cashfree } = require("cashfree-pg");
require("dotenv").config();

// Determine payment mode from environment
const PAYMENT_MODE = process.env.PAYMENT_MODE || 'SANDBOX';
const isSandbox = PAYMENT_MODE.toUpperCase() === 'SANDBOX';

// Select appropriate credentials based on payment mode
const appId = isSandbox
    ? process.env.CASHFREE_SANDBOX_APP_ID
    : process.env.CASHFREE_PRODUCTION_APP_ID;

const secretKey = isSandbox
    ? process.env.CASHFREE_SANDBOX_SECRET_KEY
    : process.env.CASHFREE_PRODUCTION_SECRET_KEY;

// Validation
if (!appId || !secretKey) {
    console.error(`❌ ERROR: Missing Cashfree credentials for ${PAYMENT_MODE} mode!`);
    console.error(`Please check your .env file and ensure ${isSandbox ? 'CASHFREE_SANDBOX_APP_ID and CASHFREE_SANDBOX_SECRET_KEY' :
            'CASHFREE_PRODUCTION_APP_ID and CASHFREE_PRODUCTION_SECRET_KEY'
        } are set.`);
    process.exit(1);
}

// Create Cashfree instance
const cashfree = new Cashfree();

// Configure Cashfree SDK
cashfree.XClientId = appId;
cashfree.XClientSecret = secretKey;
cashfree.XApiVersion = "2023-08-01";

// Set environment
if (isSandbox) {
    cashfree.XEnvironment = Cashfree.Environment ? Cashfree.Environment.SANDBOX : "SANDBOX";
    console.log("🧪 Cashfree Mode: SANDBOX (Test)");
    console.log(`   App ID: ${appId.substring(0, 20)}...`);
} else {
    cashfree.XEnvironment = Cashfree.Environment ? Cashfree.Environment.PRODUCTION : "PRODUCTION";
    console.log("🚀 Cashfree Mode: PRODUCTION (Live)");
    console.log(`   App ID: ${appId.substring(0, 20)}...`);
}

// Export both cashfree instance and helper info
module.exports = cashfree;
module.exports.PAYMENT_MODE = PAYMENT_MODE;
module.exports.IS_SANDBOX = isSandbox;
module.exports.WEBHOOK_SECRET = isSandbox
    ? process.env.CASHFREE_SANDBOX_WEBHOOK_SECRET
    : process.env.CASHFREE_PRODUCTION_WEBHOOK_SECRET;
