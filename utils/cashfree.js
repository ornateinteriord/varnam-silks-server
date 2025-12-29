const { Cashfree, CFEnvironment } = require("cashfree-pg");
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

// Get environment enum value
const environment = isSandbox ? CFEnvironment.SANDBOX : CFEnvironment.PRODUCTION;

// Create Cashfree instance with correct constructor order: (Environment, ClientId, ClientSecret)
const cashfree = new Cashfree(environment, appId, secretKey);

// Log payment mode and credential info for debugging
console.log("=== Cashfree SDK Initialization ===");
console.log(`Mode: ${isSandbox ? 'SANDBOX (Test)' : 'PRODUCTION (Live)'}`);
console.log(`App ID: ${appId}`);
console.log(`Secret Key Length: ${secretKey?.length || 0} chars`);
console.log(`Secret Key (first 10): ${secretKey?.substring(0, 10)}...`);
console.log(`Environment: ${environment}`);
console.log(`Instance XClientId: ${cashfree.XClientId}`);
console.log(`Instance XClientSecret length: ${cashfree.XClientSecret?.length}`);
console.log("===================================");

// Export the cashfree instance with helper info
module.exports = cashfree;
module.exports.PAYMENT_MODE = PAYMENT_MODE;
module.exports.IS_SANDBOX = isSandbox;
module.exports.WEBHOOK_SECRET = isSandbox
    ? process.env.CASHFREE_SANDBOX_WEBHOOK_SECRET
    : process.env.CASHFREE_PRODUCTION_WEBHOOK_SECRET;
